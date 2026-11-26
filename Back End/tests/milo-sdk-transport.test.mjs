import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAgentModel } from '../dist/milo-agent/model.js';
import { tools } from '../dist/milo-agent/prompts.js';
import { fixture, create, send, draft } from './milo-agent.helpers.mjs';
import { agentConfig } from '../dist/milo-agent/config.js';

// Exercise the installed SDK and its HTTP serializer, not a replacement models.step.
// The network is intercepted: no Google requests, keys or paid generation.
test('CV output budget defaults to 4096 and retains bounded explicit configuration', () => {
  const key = 'MILO_AGENT_MAX_OUTPUT_TOKENS';
  const previous = process.env[key];
  try {
    delete process.env[key];
    assert.equal(agentConfig().maxOutputTokens, 4096);
    process.env[key] = '700';
    assert.equal(agentConfig().maxOutputTokens, 700);
    process.env[key] = '8192';
    assert.equal(agentConfig().maxOutputTokens, 8192);
    process.env[key] = '8193';
    assert.throws(() => agentConfig(), { code: 'MILO_CONFIGURACION' });
  } finally { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; }
});

test('six-job CV survives an empty follow-up through the real SDK, preserving dates and requiring confirmation', async t => {
  t.mock.method(console, 'error', () => {});
  const f = fixture({ timeoutMs: 1000, maxOutputTokens: 4096 });
  const datos = { ...draft(), plantilla: 'moderna', experiencias: Array.from({ length: 6 }, (_, i) => ({
    empresa: 'Empresa de ejemplo ' + i, puesto: 'Soporte tecnico',
    descripcion: 'Soporte a representantes, mantenimiento y capacitacion declarados.',
    fechaInicio: `${2022 - i}-01`, ...(i === 0 ? { actual: true } : { fechaFin: `${2023 - i}-01` })
  })) };
  const mensaje = 'Esta todo? EXPERIENCIA PROFESIONAL\n' + datos.experiencias.map(item =>
    `${item.empresa}\n${item.fechaInicio} - ${item.fechaFin ?? 'Actualidad'}\n${item.descripcion}`).join('\n');
  assert(mensaje.length < 1500);
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async (_input, options) => {
    const request = JSON.parse(options.body);
    requests++;
    assert.equal(request.generationConfig.maxOutputTokens, 4096);
    const parts = requests === 1 ? [{ functionCall: { name: 'prepararCurriculum', args: datos } }] : [];
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  f.ports.model = createAgentModel(undefined, () => f.settings);
  const result = await send(f.agent, 'user-a', mensaje);
  assert.equal(requests, 2);
  assert.deepEqual(result.propuesta.datos, datos);
  assert.equal(result.curriculums.length, 0);
  assert.match(result.messages.at(-1).text, /confirm/);
  assert.equal(f.locks.size, 0);
  await f.agent.confirm('user-a', { propuestaId: result.propuesta.id, confirmar: true });
  assert.deepEqual(f.records.get('user-a').cvs[0].datos.experiencias, datos.experiencias);
});

test('truncated, malformed and blocked responses never execute tools, retry or leak provider content', async t => {
  const logger = t.mock.method(console, 'error', () => {});
  const f = fixture({ timeoutMs: 1000, maxOutputTokens: 4096 });
  await create(f);
  const before = structuredClone(f.records.get('user-a'));
  let current;
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    return new Response(JSON.stringify({ ...current,
      usageMetadata: { candidatesTokenCount: 700, thoughtsTokenCount: 600 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  f.ports.model = createAgentModel(undefined, () => f.settings);
  for (const finishReason of ['MAX_TOKENS', 'MALFORMED_FUNCTION_CALL', 'SAFETY', 'unknown-private-value']) {
    current = { candidates: [{ finishReason, finishMessage: 'private-provider-detail', content: {
      role: 'model', parts: [{ text: 'private-profile-content', functionCall: { name: 'prepararCurriculum', args: draft() } }]
    } }] };
    await assert.rejects(send(f.agent), { status: 502,
      code: finishReason === 'MAX_TOKENS' ? 'MILO_RESPUESTA_TRUNCADA' : 'MILO_RESPUESTA_RECHAZADA' });
    assert.deepEqual(f.records.get('user-a'), before);
    assert.equal(f.locks.size, 0);
  }
  current = { promptFeedback: { blockReason: 'SAFETY', blockReasonMessage: 'private-prompt' } };
  await assert.rejects(send(f.agent), { code: 'MILO_RESPUESTA_RECHAZADA' });
  assert.equal(requests, 5);
  const logs = logger.mock.calls.map(call => call.arguments[0]);
  assert.equal(logs.length, 5);
  assert.doesNotMatch(logs.join(''), /private-|unit-test-placeholder|mock-private-key/);
  assert.deepEqual(logs.map(line => JSON.parse(line).reason),
    ['MAX_TOKENS', 'MALFORMED_FUNCTION_CALL', 'SAFETY', 'UNKNOWN', 'PROMPT_BLOCKED']);
});

test('empty response without a validated proposal remains a failure without saving fabricated content', async t => {
  const logger = t.mock.method(console, 'error', () => {});
  const f = fixture({ timeoutMs: 1000 });
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ candidates: [{
    finishReason: 'STOP', content: { role: 'model', parts: [] }
  }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  f.ports.model = createAgentModel(undefined, () => f.settings);
  await assert.rejects(send(f.agent), { code: 'MILO_RESPUESTA_INVALIDA' });
  assert.equal(f.records.size, 0);
  assert.equal(f.locks.size, 0);
  assert.equal(JSON.parse(logger.mock.calls[0].arguments[0]).reason, 'EMPTY_RESPONSE');
});

test('real Gemini SDK serializes the Milo request and decodes a synthetic response without network', async t => {
  const captured = [];
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url ?? input.toString());
    const body = JSON.parse(options.body);
    captured.push({ url, options, body });
    return new Response(JSON.stringify({ candidates: [{ content: {
      role: 'model', parts: [{ text: 'Respuesta de prueba sin consumo.' }]
    } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const config = { model: 'gemini-3.5-flash-lite', apiKey: 'unit-test-placeholder', timeoutMs: 1000, maxOutputTokens: 100 };
  const model = createAgentModel(undefined, () => config);
  const answer = await model.step([{ role: 'user', parts: [{ text: 'Contenido ficticio' }] }], new AbortController().signal);
  assert.equal(answer.text, 'Respuesta de prueba sin consumo.');
  assert.equal(captured.length, 1);
  const { url, options, body } = captured[0];
  assert.equal(url.origin, 'https://generativelanguage.googleapis.com');
  assert.equal(url.pathname, '/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assert.equal(options.method, 'POST');
  assert.equal(url.searchParams.has('key'), false);
  assert.equal(body.generationConfig.maxOutputTokens, 100);
  assert.deepEqual(body.tools[0].functionDeclarations, tools);
  assert.equal(body.systemInstruction.parts.length, 1);
  assert.equal(body.contents[0].role, 'user');
  assert.equal(JSON.stringify(body).includes(config.apiKey), false);
});

test('real SDK 404 is translated once without retrying generation or leaking provider data', async t => {
  const logger = t.mock.method(console, 'error', () => {});
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response(JSON.stringify({ error: { code: 404, status: 'NOT_FOUND',
      message: 'Model unavailable for generateContent; private-request-value' } }),
    { status: 404, headers: { 'Content-Type': 'application/json' } });
  });
  const model = createAgentModel(undefined, () => ({
    model: 'gemini-2.5-flash-lite', apiKey: 'unit-test-placeholder', timeoutMs: 1000, maxOutputTokens: 100
  }));
  await assert.rejects(model.step([{ role: 'user', parts: [{ text: 'Ficticio' }] }], new AbortController().signal),
    { status: 503, code: 'MILO_GEMINI_MODELO_NO_DISPONIBLE' });
  assert.equal(calls, 1);
  assert.equal(logger.mock.calls.length, 1);
  const diagnostic = logger.mock.calls[0].arguments[0];
  assert.equal(diagnostic.includes('private-request-value'), false);
  assert.equal(JSON.parse(diagnostic).httpStatusCode, 404);
});

test('complete agent round trip uses real SDK serialization for tool calls and own CV results without network', async t => {
  const f = fixture({ model: 'gemini-3.5-flash-lite', apiKey: 'unit-test-placeholder' });
  const id = await create(f);
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url ?? input.toString());
    assert.equal(url.pathname, '/v1beta/models/gemini-3.5-flash-lite:generateContent');
    const body = JSON.parse(options.body);
    requests.push(body);
    if (requests.length === 1) {
      return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: {
        role: 'model', parts: [{ functionCall: { name: 'listarCurriculums', args: {} }, thoughtSignature: 'opaque-test-signature' }]
      } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    assert.equal(requests.length, 2);
    const response = body.contents.at(-1).parts[0].functionResponse;
    assert.equal(response.name, 'listarCurriculums');
    assert.equal(response.response.result.length, 1);
    assert.equal(response.response.result[0].id, id);
    const modelTurn = body.contents.at(-2);
    assert.equal(modelTurn.parts[0].thoughtSignature, 'opaque-test-signature');
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: {
      role: 'model', parts: [{ text: 'Tenés un CV guardado: Desarrollo web.' }]
    } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  f.ports.model = createAgentModel(undefined, () => f.settings);
  const result = await send(f.agent, 'user-a', 'Mostrame mis CV guardados');
  assert.equal(requests.length, 2);
  assert.equal(requests[0].contents[0].role, 'user', 'The fixed UI greeting must not start the Gemini history as a model turn');
  for (let index = 1; index < requests[0].contents.length; index++) {
    assert.notEqual(requests[0].contents[index].role, requests[0].contents[index - 1].role, 'Adjacent history turns must be normalized');
  }
  assert.equal(result.messages.at(-1).text, 'Tenés un CV guardado: Desarrollo web.');
  assert.equal(result.curriculums[0].id, id);
  assert.equal(result.propuesta, null);
  assert.equal(f.records.get('user-a').cvs[0].revision, 1);
});


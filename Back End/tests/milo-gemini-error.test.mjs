import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAgentModel } from '../dist/milo-agent/model.js';

test('Gemini failures expose specific safe reasons without logging secrets or submitted content', async t => {
  const logger = t.mock.method(console, 'error', () => {});
  const secret = 'private-api-key-value';
  const personal = 'persona@example.com';
  const cases = [
    [403, 'Your API key was reported as leaked.', 'PERMISSION_DENIED', 'API_KEY_BLOCKED', 'MILO_GEMINI_CLAVE_BLOQUEADA', 503],
    [400, 'API key not valid. API_KEY_INVALID', 'INVALID_ARGUMENT', 'API_KEY_INVALID', 'MILO_GEMINI_CLAVE_INVALIDA', 503],
    [403, 'SERVICE_DISABLED: API is disabled', 'PERMISSION_DENIED', 'SERVICE_DISABLED', 'MILO_GEMINI_API_DESHABILITADA', 503],
    [403, 'User location is not supported', 'PERMISSION_DENIED', 'REGION_UNSUPPORTED', 'MILO_GEMINI_REGION', 503],
    [401, 'Authentication rejected', 'UNAUTHENTICATED', 'UNAUTHENTICATED', 'MILO_GEMINI_AUTENTICACION', 503],
    [403, 'Restricted method', 'PERMISSION_DENIED', 'PERMISSION_DENIED', 'MILO_GEMINI_PERMISOS', 503],
    [404, 'Unknown model', 'NOT_FOUND', 'MODEL_NOT_FOUND', 'MILO_GEMINI_MODELO_NO_DISPONIBLE', 503],
    [429, 'Quota exceeded', 'RESOURCE_EXHAUSTED', 'QUOTA_EXHAUSTED', 'MILO_CUOTA_PROVEEDOR', 429],
    [400, 'Invalid function schema', 'INVALID_ARGUMENT', 'INVALID_ARGUMENT', 'MILO_GEMINI_SOLICITUD_INVALIDA', 502],
    [500, 'Unexpected provider failure', 'INTERNAL', 'UNCLASSIFIED', 'MILO_PROVEEDOR_NO_DISPONIBLE', 502]
  ];
  for (const [status, message, providerStatus, reason, code, publicStatus] of cases) {
    const model = createAgentModel(() => ({ models: {
      generateContent: async () => { throw Object.assign(new Error(JSON.stringify({
        error: { code: status, status: providerStatus, message: message + ' ' + secret + ' ' + personal }
      })), { status, request: { headers: { Authorization: secret }, contents: personal } }); }
    } }), () => ({ model: 'gemini-2.5-flash-lite', apiKey: secret, timeoutMs: 100, maxOutputTokens: 100 }));
    await assert.rejects(model.step([{ role: 'user', parts: [{ text: personal }] }], new AbortController().signal), error => {
      assert.equal(error.code, code);
      assert.equal(error.status, publicStatus);
      assert.equal(error.message.includes(secret), false);
      assert.equal(error.message.includes(personal), false);
      return true;
    });
    const entry = JSON.parse(logger.mock.calls.at(-1).arguments[0]);
    assert.deepEqual(entry, { event: 'MILO_GEMINI_REQUEST_FAILED', operation: 'generateContent',
      httpStatusCode: status, providerStatus, reason, model: 'gemini-2.5-flash-lite' });
  }
  const output = JSON.stringify(logger.mock.calls.map(call => call.arguments));
  for (const value of [secret, personal, 'Authorization', 'headers', 'contents', 'request:']) {
    assert.equal(output.includes(value), false);
  }
});

test('Gemini diagnostics omit unexpected status labels, model strings and exceptions', async t => {
  const logger = t.mock.method(console, 'error', () => {});
  const privateValue = 'must-not-appear-in-diagnostics';
  const model = createAgentModel(() => ({ models: { generateContent: async () => {
    throw new Error(JSON.stringify({ error: { status: privateValue, message: privateValue, code: privateValue } }));
  } } }), () => ({ model: privateValue, apiKey: privateValue, timeoutMs: 100, maxOutputTokens: 100 }));
  await assert.rejects(model.step([], new AbortController().signal), { code: 'MILO_PROVEEDOR_NO_DISPONIBLE' });
  const entry = JSON.parse(logger.mock.calls[0].arguments[0]);
  assert.equal(entry.model, null);
  assert.equal(entry.providerStatus, null);
  assert.equal(entry.httpStatusCode, null);
  assert.equal(JSON.stringify(entry).includes(privateValue), false);
});


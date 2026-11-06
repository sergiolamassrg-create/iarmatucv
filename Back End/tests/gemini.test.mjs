import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.mjs';
import { createGeminiGateway } from '../dist/services/gemini.service.js';
import { miloConfig } from '../dist/config/milo.js';

test('adaptador Gemini verifica modelo, acota salida y mantiene instrucciones fuera del texto del usuario', async () => {
  miloConfig.model = 'synthetic-model-only-in-tests';
  let checks = 0; const calls = [];
  const gateway = createGeminiGateway(() => ({ models: {
    get: async input => { checks++; assert.equal(input.model, miloConfig.model); return { supportedActions: ['generateContent'] }; },
    generateContent: async input => { calls.push(input); return { text: '  Consejo de CV  ' }; }
  } }));
  const signal = new AbortController().signal;
  assert.equal(await gateway.generate('Mi consulta', [], signal), 'Consejo de CV');
  await gateway.generate('Otra consulta', [], signal);
  assert.equal(checks, 1);
  assert.equal(calls[0].config.maxOutputTokens, miloConfig.maxOutputTokens);
  assert.equal(calls[0].config.automaticContinuation, false);
  assert.equal(calls[0].config.abortSignal, signal);
  assert.ok(calls[0].config.systemInstruction.includes('No inventes'));
  assert.deepEqual(calls[0].contents, [{ role: 'user', parts: [{ text: 'Mi consulta' }] }]);
  assert.ok(!JSON.stringify(calls).includes('apiKey'));
});

test('modelo sin generación se rechaza antes de generar contenido', async () => {
  const gateway = createGeminiGateway(() => ({ models: {
    get: async () => ({ supportedActions: ['embedContent'] }),
    generateContent: async () => assert.fail('No debe generar')
  } }));
  await assert.rejects(gateway.generate('CV', [], new AbortController().signal), { code: 'MILO_MODELO_INVALIDO' });
});

test('respuesta vacía, bloqueada o excesiva nunca llega como éxito', async () => {
  for (const text of ['', undefined, 'x'.repeat(8001)]) {
    const gateway = createGeminiGateway(() => ({ models: {
      get: async () => ({ supportedActions: ['generateContent'] }), generateContent: async () => ({ text })
    } }));
    await assert.rejects(gateway.generate('CV', [], new AbortController().signal), { code: 'MILO_RESPUESTA_INVALIDA' });
  }
});

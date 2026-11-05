import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { createLambdaHandler, handler, cognitoClient, state, resetMock, verify, token, credentials, event, context } from './helpers.mjs';

beforeEach(resetMock);
after(() => cognitoClient.destroy());

test('exported Lambda handler accepts HTTP API v2 without listening on a port', async () => {
  const result = await handler(event('/health'), context());
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).data.estado, 'ok');
  assert.equal((await handler(event('/plantillas'), context())).statusCode, 200);
  assert.equal((await handler(event('/missing'), context())).statusCode, 404);
  assert.equal((await handler({ version: '1.0' }, context())).statusCode, 400);
  assert.equal(state.calls.length, 0);
});

test('HTTP API base64 JSON and multi-cookie responses preserve the contracts', async () => {
  const invoke = createLambdaHandler(verify);
  const result = await invoke(event('/auth/ingreso', { method: 'POST', body: credentials, base64: true }), context());
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).data.id, 'user-a');
  assert.equal(result.cookies.length, 2);
  assert(result.cookies.every(cookie => cookie.includes('Secure') && cookie.includes('HttpOnly')));
  assert(!result.cookies.some(cookie => cookie.startsWith('iarmatucv.sid=')));
  assert(!result.body.includes('test-refresh-token'));
  const cookies = result.cookies.map(cookie => cookie.split(';')[0]);
  const reloaded = await createLambdaHandler(verify)(event('/auth/sesion', { cookies }), context());
  assert.equal(JSON.parse(reloaded.body).data.id, 'user-a');
  const logout = await invoke(event('/auth/salida', { method: 'POST', body: {}, cookies }), context());
  assert.equal(logout.statusCode, 200);
  assert(logout.cookies.every(cookie => cookie.includes('Expires=Thu, 01 Jan 1970')));
  assert(state.calls.some(call => call.name === 'RevokeTokenCommand'));
});

test('warm invocations never retain a user between requests', async () => {
  const invoke = createLambdaHandler(verify);
  const a = await invoke(event('/auth/perfil', { authorization: `Bearer ${token()}` }), context());
  const anonymous = await invoke(event('/auth/sesion'), context());
  const b = await invoke(event('/auth/perfil', { authorization: `Bearer ${token({ sub: 'user-b' })}` }), context());
  assert.equal(JSON.parse(a.body).data.id, 'user-a');
  assert.equal(JSON.parse(anonymous.body).data, null);
  assert.equal(JSON.parse(b.body).data.id, 'user-b');
});

test('Lambda handles CORS preflight, JSON errors and protected routes', async () => {
  const invoke = createLambdaHandler(verify);
  const preflight = await invoke(event('/auth/ingreso', { method: 'OPTIONS' }), context());
  assert.equal(preflight.statusCode, 204);
  assert.equal(preflight.headers['access-control-allow-origin'], 'http://127.0.0.1:4200');
  assert.equal(preflight.headers['access-control-allow-credentials'], 'true');
  assert.equal((await invoke(event('/auth/perfil'), context())).statusCode, 401);
  const malformed = event('/auth/ingreso', { method: 'POST', body: {} });
  malformed.body = '{invalid';
  assert.equal((await invoke(malformed, context())).statusCode, 400);
  const oversized = event('/auth/ingreso', { method: 'POST', body: { data: 'x'.repeat(40000) } });
  assert.equal((await invoke(oversized, context())).statusCode, 413);
  const badOrigin = await invoke(event('/auth/ingreso', { method: 'POST', body: credentials, origin: 'https://evil.example' }), context());
  assert.equal(badOrigin.statusCode, 403);
  assert.equal(badOrigin.headers['access-control-allow-origin'], undefined);
});

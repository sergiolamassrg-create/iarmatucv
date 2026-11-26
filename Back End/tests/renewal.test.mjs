import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { createApp, createLambdaHandler, cognitoClient, state, resetMock, credentials, serve, token, verify, event, context, cookieHeader } from './helpers.mjs';
import { renewalCookieName } from '../dist/services/auth-transport.service.js';
beforeEach(resetMock);
after(() => cognitoClient.destroy());
const loginBody = { ...credentials, transport: 'bearer-cookie' };

test('same-origin login exposes only memory access token and sets a host-only HttpOnly Secure Strict renewal session cookie', async () => {
  await serve(createApp({ mode: 'jwt', verifyAccessToken: verify }), async request => {
    const login = await request('/auth/ingreso', { body: loginBody });
    assert.equal(login.response.status, 200);
    assert.equal(login.cookies.length, 1);
    const cookie = login.cookies[0];
    assert(cookie.startsWith(renewalCookieName + '='));
    for (const option of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/api/v1/auth']) assert(cookie.includes(option));
    assert(!/Domain=|Max-Age=|Expires=/.test(cookie));
    assert(!JSON.stringify(login.data).includes('test-refresh-token'));
    const restored = await request('/auth/renovar', { body: {}, headers: { Cookie: cookieHeader(login.cookies) } });
    assert.equal(restored.response.status, 200);
    assert.equal(restored.data.data.id, login.data.data.id);
    assert(restored.data.session.expiresAt > Date.now());
    assert.notEqual(restored.data.session.accessToken, login.data.session.accessToken);
    assert(!JSON.stringify(restored.data).includes('refreshToken'));
    assert.equal(restored.response.headers.get('cache-control'), 'no-store');
    assert.equal((await request('/auth/perfil', { headers: { Authorization: 'Bearer ' + restored.data.session.accessToken } })).response.status, 200);
  });
});
test('renewal without cookie stays anonymous; JSON/origin and body-injected refresh/identity are rejected', async () => {
  await serve(createApp({ mode: 'jwt', verifyAccessToken: verify }), async request => {
    assert.deepEqual((await request('/auth/renovar', { body: {} })).data, { data: null });
    assert.equal(state.calls.length, 0);
    for (const body of [[], { refreshToken: 'test-refresh-token' }, { userId: 'marta' }]) assert.equal((await request('/auth/renovar', { body })).response.status, 400);
    assert.equal((await request('/auth/renovar', { body: {}, headers: { Origin: 'https://evil.example', Cookie: renewalCookieName + '=test-refresh-token' } })).response.status, 403);
    assert.equal(state.calls.length, 0);
  });
});
test('expired renewal clears cookie with 401; transient provider failure preserves it and returns safe retryable error', async () => {
  await serve(createApp({ mode: 'jwt', verifyAccessToken: verify }), async request => {
    const expired = await request('/auth/renovar', { body: {}, headers: { Cookie: renewalCookieName + '=expired-token' } });
    assert.equal(expired.response.status, 401); assert.equal(expired.data.error.codigo, 'SESION_VENCIDA');
    assert(expired.cookies[0].includes('Expires=Thu, 01 Jan 1970'));
    state.failure = Object.assign(new Error('PRIVATE provider message'), { name: 'NetworkingError' });
    const transient = await request('/auth/renovar', { body: {}, headers: { Cookie: renewalCookieName + '=test-refresh-token' } });
    assert.equal(transient.response.status, 503); assert.deepEqual(transient.cookies, []);
    assert(!JSON.stringify(transient.data).includes('PRIVATE'));
  });
});
test('refresh rotation replaces only the HttpOnly cookie; logout clears it and revokes the current token', async () => {
  await serve(createApp({ mode: 'jwt', verifyAccessToken: verify }), async request => {
    state.newRefreshToken = 'rotated-refresh-token';
    const rotated = await request('/auth/renovar', { body: {}, headers: { Cookie: renewalCookieName + '=test-refresh-token' } });
    assert.equal(rotated.response.status, 200);
    assert(rotated.cookies[0].startsWith(renewalCookieName + '=rotated-refresh-token;'));
    assert(!JSON.stringify(rotated.data).includes('rotated-refresh-token'));
    const logout = await request('/auth/salida', { body: {}, headers: { Cookie: cookieHeader(rotated.cookies), Authorization: 'Bearer ' + rotated.data.session.accessToken } });
    assert.equal(logout.response.status, 200); assert(logout.cookies[0].includes('Expires=Thu, 01 Jan 1970'));
    assert(state.calls.some(call => call.name === 'RevokeTokenCommand' && call.input.Token === 'rotated-refresh-token'));
    assert(state.calls.some(call => call.name === 'GlobalSignOutCommand'));
  });
});
test('Lambda HTTP API v2 restores without Authorization and never exposes refresh tokens in JSON', async () => {
  const handler = createLambdaHandler(verify);
  const restored = await handler(event('/auth/renovar', { method: 'POST', body: {}, cookies: [renewalCookieName + '=test-refresh-token'] }), context());
  assert.equal(restored.statusCode, 200);
  assert.equal(JSON.parse(restored.body).data.id, 'user-a');
  assert(!restored.body.includes('test-refresh-token'));
  assert.equal(restored.cookies.length, 1);
});

import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { createApp, createLambdaHandler, cognitoClient, state, resetMock, credentials, serve, token, verify, event, context } from './helpers.mjs';
beforeEach(resetMock);
after(() => cognitoClient.destroy());

for (const mode of ['session', 'jwt']) {
  test(`explicit Bearer login works without cookies in ${mode} mode`, async () => {
    await serve(createApp({ mode, verifyAccessToken: verify }), async request => {
      const login = await request('/auth/ingreso', { body: { ...credentials, transport: 'bearer' } });
      assert.equal(login.response.status, 200);
      assert.equal(login.cookies.length, 0);
      assert.equal(login.response.headers.get('cache-control'), 'no-store');
      assert.equal(typeof login.data.session.accessToken, 'string');
      assert(login.data.session.expiresAt > Date.now());
      assert(!JSON.stringify(login.data).includes('refreshToken'));
      const headers = { Authorization: `Bearer ${login.data.session.accessToken}` };
      assert.equal((await request('/auth/perfil', { headers })).data.data.id, login.data.data.id);
      assert.equal((await request('/auth/perfil')).response.status, 401);
      const logout = await request('/auth/salida', { body: {}, headers });
      assert.equal(logout.response.status, 200);
      assert(state.calls.some(call => call.name === 'GlobalSignOutCommand' && call.input.AccessToken === login.data.session.accessToken));
      assert.equal((await request('/auth/perfil')).response.status, 401);
    });
  });
}

test('Bearer login rejects incorrect credentials and expired signed tokens', async () => {
  await serve(createApp({ mode: 'jwt', verifyAccessToken: verify }), async request => {
    state.failure = Object.assign(new Error('Incorrect password'), { name: 'NotAuthorizedException' });
    const failed = await request('/auth/ingreso', { body: { ...credentials, transport: 'bearer' } });
    assert.equal(failed.response.status, 401);
    assert.equal(failed.data.session, undefined);
    state.failure = undefined;
    state.loginToken = token({ exp: Math.floor(Date.now() / 1000) - 1 });
    const expired = await request('/auth/ingreso', { body: { ...credentials, transport: 'bearer' } });
    assert.equal(expired.response.status, 401);
    assert.equal(expired.data.session, undefined);
  });
});

test('Lambda v2 returns Bearer credentials without Set-Cookie and accepts Authorization preflight', async () => {
  const handler = createLambdaHandler(verify);
  const login = await handler(event('/auth/ingreso', { method: 'POST', body: { ...credentials, transport: 'bearer' } }), context());
  assert.equal(login.statusCode, 200);
  assert.equal(login.cookies?.length ?? 0, 0);
  const { session } = JSON.parse(login.body);
  const result = await handler(event('/auth/perfil', { authorization: `Bearer ${session.accessToken}` }), context());
  assert.equal(result.statusCode, 200);
  const preflight = event('/perfil', { method: 'OPTIONS' });
  preflight.headers['access-control-request-method'] = 'GET';
  preflight.headers['access-control-request-headers'] = 'authorization';
  const cors = await handler(preflight, context());
  assert.equal(cors.statusCode, 204);
  assert.match(cors.headers['access-control-allow-headers'], /authorization/i);
});


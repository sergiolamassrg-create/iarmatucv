import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { FetchError } from 'aws-jwt-verify/error';
import { createApp, cognitoClient, state, resetMock, credentials, serve, cookieHeader, token, otherKeys, verify } from './helpers.mjs';

beforeEach(resetMock);
after(() => cognitoClient.destroy());

test('health, catalog and 404 preserve the public contracts', async () => {
  await serve(createApp(), async request => {
    assert.equal((await request('/health')).data.data.estado, 'ok');
    assert.equal((await request('/plantillas')).data.data.length, 6);
    assert.equal((await request('/missing')).response.status, 404);
    assert.equal(state.calls.length, 0);
  });
});

test('local login, session rotation, reload and logout remain functional', async () => {
  await serve(createApp(), async request => {
    assert.equal((await request('/auth/sesion')).data.data, null);
    const login = await request('/auth/ingreso', { body: credentials });
    assert.equal(login.response.status, 200);
    assert.equal(login.data.data.id, 'user-a');
    assert(!JSON.stringify(login.data).includes('accessToken'));
    assert(login.cookies[0].startsWith('iarmatucv.sid='));
    assert(login.cookies[0].includes('HttpOnly'));
    const cookie = cookieHeader(login.cookies);
    assert.equal((await request('/auth/perfil', { headers: { Cookie: cookie } })).data.data.id, 'user-a');
    const rotated = await request('/auth/ingreso', { body: credentials, headers: { Cookie: cookie } });
    assert.notEqual(cookieHeader(rotated.cookies), cookie);
    assert.equal((await request('/auth/sesion', { headers: { Cookie: cookie } })).data.data, null);
    const nextCookie = cookieHeader(rotated.cookies);
    await request('/auth/salida', { body: {}, headers: { Cookie: nextCookie } });
    assert.equal((await request('/auth/sesion', { headers: { Cookie: nextCookie } })).data.data, null);
    assert(state.calls.some(call => call.name === 'RevokeTokenCommand'));
  });
});

test('public Cognito operations preserve payloads, secret hash and response formats', async () => {
  await serve(createApp(), async request => {
    const registered = await request('/auth/registro', { body: credentials });
    assert.equal(registered.response.status, 201);
    assert.deepEqual(registered.data, { data: { confirmed: false } });
    const signup = state.calls.find(call => call.name === 'SignUpCommand').input;
    assert.deepEqual(signup.UserAttributes.map(item => item.Name), ['email', 'name', 'family_name', 'nickname']);
    for (const path of ['/confirmacion', '/reenviar-codigo', '/recuperacion', '/restablecer']) {
      const result = await request(`/auth${path}`, { body: { ...credentials, code: '123456' } });
      assert.equal(result.response.status, 200);
      assert.equal(typeof result.data.data.message, 'string');
    }
  });
});

test('invalid fields, disallowed origins, missing JSON and unimplemented MFA fail closed', async () => {
  await serve(createApp(), async request => {
    assert.equal((await request('/auth/registro', { body: { email: 'invalid' } })).response.status, 400);
    assert.equal((await request('/auth/ingreso', { body: credentials, headers: { Origin: 'https://evil.example' } })).response.status, 403);
    assert.equal((await request('/auth/ingreso', { body: credentials, headers: { 'Content-Type': 'text/plain' } })).response.status, 403);
    assert.equal(state.calls.length, 0);
    state.challenge = true;
    const result = await request('/auth/ingreso', { body: credentials });
    assert.equal(result.response.status, 409);
    assert.equal(result.cookies.length, 0);
  });
});

test('Cognito errors do not leak passwords, tokens or internal diagnostics', async () => {
  await serve(createApp(), async request => {
    state.failure = Object.assign(new Error('sensitive-internal-diagnostic'), { name: 'NotAuthorizedException' });
    const result = await request('/auth/ingreso', { body: credentials });
    assert.equal(result.response.status, 401);
    assert(!JSON.stringify(result.data).includes('sensitive-internal-diagnostic'));
    assert(!JSON.stringify(result.data).includes(credentials.password));
  });
});

test('JWT cookies preserve the Angular contract and valid Bearer tokens are accepted', async () => {
  const { environment } = await import('../dist/config/environment.js');
  const previousSecret = environment.sessionSecret;
  environment.sessionSecret = '';
  try {
  await serve(createApp({ mode: 'jwt', verifyAccessToken: verify }), async request => {
    const login = await request('/auth/ingreso', { body: credentials });
    assert.equal(login.response.status, 200);
    assert.equal(login.cookies.length, 2);
    assert(login.cookies.every(cookie => cookie.includes('HttpOnly')));
    assert(login.cookies.every(cookie => cookie.includes('Path=/api/v1')));
    assert(!login.cookies.some(cookie => cookie.startsWith('iarmatucv.sid=')));
    const saved = cookieHeader(login.cookies);
    assert.equal((await request('/auth/sesion', { headers: { Cookie: saved } })).data.data.id, 'user-a');
    assert.equal((await request('/auth/perfil', { headers: { Authorization: `Bearer ${token()}` } })).data.data.id, 'user-a');
    state.revoked = true;
    assert.equal((await request('/auth/perfil', { headers: { Cookie: saved } })).response.status, 401);
  });
  } finally { environment.sessionSecret = previousSecret; }
});

test('JWT verification fails closed when configuration is missing or JWKS cannot be fetched', async () => {
  const { environment } = await import('../dist/config/environment.js');
  const previousPool = environment.cognito.userPoolId;
  environment.cognito.userPoolId = '';
  try {
    await serve(createApp({ mode: 'jwt' }), async request => {
      const result = await request('/auth/perfil', { headers: { Authorization: `Bearer ${token()}` } });
      assert.equal(result.response.status, 503);
      assert.equal(state.calls.length, 0);
    });
  } finally { environment.cognito.userPoolId = previousPool; }
  await serve(createApp({ mode: 'jwt', verifyAccessToken: async () => { throw new FetchError('https://issuer.example.invalid', 'test-network-failure'); } }), async request => {
    const result = await request('/auth/perfil', { headers: { Authorization: `Bearer ${token()}` } });
    assert.equal(result.response.status, 503);
    assert.equal(result.cookies.length, 0);
    assert.equal(state.calls.length, 0);
  });
});

const rejectedTokens = {
  tamperedSignature: () => token({}, { privateKey: otherKeys.privateKey }),
  expired: () => token({ exp: Math.floor(Date.now() / 1000) - 60 }),
  issuer: () => token({ iss: 'https://evil.example' }),
  client: () => token({ client_id: 'otherclient' }),
  idToken: () => token({ token_use: 'id', aud: 'testclient' }),
  algorithm: () => token({}, { header: { alg: 'HS256' } }),
  unknownKey: () => token({}, { header: { kid: 'unknown-key' } }),
  missingSubject: () => token({ sub: undefined }),
  missingExpiry: () => token({ exp: undefined }),
  futureNotBefore: () => token({ nbf: Math.floor(Date.now() / 1000) + 3600 })
};

for (const [name, makeToken] of Object.entries(rejectedTokens)) {
  test(`JWT rejects ${name} before calling Cognito`, async () => {
    await serve(createApp({ mode: 'jwt', verifyAccessToken: verify }), async request => {
      const result = await request('/auth/perfil', { headers: { Authorization: `Bearer ${makeToken()}` } });
      assert.equal(result.response.status, 401);
      assert.equal(state.calls.length, 0);
    });
  });
}

test('protected profile requires identity and ignores client-supplied identity headers', async () => {
  await serve(createApp({ mode: 'jwt', verifyAccessToken: verify }), async request => {
    assert.equal((await request('/auth/sesion')).data.data, null);
    assert.equal((await request('/auth/perfil', { headers: { 'x-user-id': 'user-a' } })).response.status, 401);
    assert.equal((await request('/auth/perfil', { headers: { Authorization: 'Basic invalid' } })).response.status, 401);
  });
});

test('production refuses MemoryStore and origins that are not exact HTTPS origins', () => {
  const run = overrides => spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./dist/config/environment.js')"], {
    cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production', AUTH_MODE: 'jwt', ...overrides }, encoding: 'utf8'
  });
  assert.notEqual(run({ AUTH_MODE: 'session', FRONTEND_ORIGINS: 'https://app.example.invalid' }).status, 0);
  assert.notEqual(run({ FRONTEND_ORIGINS: '*' }).status, 0);
  assert.notEqual(run({ FRONTEND_ORIGINS: 'http://app.example.invalid' }).status, 0);
  assert.equal(run({ FRONTEND_ORIGINS: 'https://app.example.invalid' }).status, 0);
});

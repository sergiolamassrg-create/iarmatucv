import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync, sign } from 'node:crypto';
import { SimpleJwksCache } from 'aws-jwt-verify/jwk';

Object.assign(process.env, {
  NODE_ENV: 'test', AUTH_MODE: 'session', AWS_LAMBDA_FUNCTION_NAME: '',
  FRONTEND_ORIGINS: 'http://127.0.0.1:4200,https://app.example.invalid',
  COGNITO_REGION: 'us-east-1', COGNITO_USER_POOL_ID: 'us-east-1_TestPool',
  COGNITO_CLIENT_ID: 'testclient', COGNITO_CLIENT_SECRET: 'test-client-secret',
  SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
  AUTH_COOKIE_SAME_SITE: 'lax', AUTH_COOKIE_PATH: '/api/v1'
});

export const { createApp } = await import('../dist/app.js');
export const { createLambdaHandler, handler } = await import('../dist/lambda.js');
export const { cognitoClient } = await import('../dist/services/auth.service.js');
const { createCognitoVerifier } = await import('../dist/services/jwt.service.js');

export const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const otherKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const jwk = { ...keys.publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
export const issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TestPool';
const cache = new SimpleJwksCache({ fetcher: { fetch: async () => { throw new Error('Network disabled in tests'); } } });
export const verifier = createCognitoVerifier('us-east-1_TestPool', 'testclient', cache);
verifier.cacheJwks({ keys: [jwk] });
export const verify = token => verifier.verify(token);

export function token(changes = {}, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: issuer, sub: 'user-a', client_id: 'testclient', token_use: 'access',
    iat: now - 5, exp: now + 3600, username: 'test-user', scope: 'aws.cognito.signin.user.admin', ...changes };
  const header = { alg: 'RS256', kid: 'test-key', ...options.header };
  const body = [header, payload].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
  const signature = header.alg === 'HS256'
    ? createHmac('sha256', 'test-only-hmac').update(body).digest()
    : sign('RSA-SHA256', Buffer.from(body), options.privateKey ?? keys.privateKey);
  return `${body}.${signature.toString('base64url')}`;
}

export const profile = { name: 'Persona Ejemplo', familyName: 'Ejemplo', nickname: 'Persona' };
export const credentials = { email: 'test@example.com', password: 'Example123!', ...profile };
export const state = { challenge: false, revoked: false, calls: [], loginToken: undefined, failure: undefined };

export function resetMock() {
  state.challenge = false; state.revoked = false; state.calls = []; state.loginToken = undefined; state.failure = undefined;
}

cognitoClient.send = async command => {
  const name = command.constructor.name;
  const input = command.input;
  state.calls.push({ name, input });
  if (state.failure) throw state.failure;
  if ('SecretHash' in input) {
    assert.equal(input.SecretHash, createHmac('sha256', process.env.COGNITO_CLIENT_SECRET)
      .update(input.Username + process.env.COGNITO_CLIENT_ID).digest('base64'));
  }
  if (name === 'InitiateAuthCommand') {
    assert.equal(input.AuthFlow, 'USER_PASSWORD_AUTH');
    assert.equal(input.AuthParameters.SECRET_HASH, createHmac('sha256', process.env.COGNITO_CLIENT_SECRET)
      .update(input.AuthParameters.USERNAME + process.env.COGNITO_CLIENT_ID).digest('base64'));
    if (state.challenge) return { ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: 'test-challenge' };
    return { AuthenticationResult: { AccessToken: state.loginToken ?? token(), RefreshToken: 'test-refresh-token', ExpiresIn: 3600 } };
  }
  if (name === 'GetUserCommand') {
    if (state.revoked) throw Object.assign(new Error('Revoked'), { name: 'NotAuthorizedException' });
    const payload = JSON.parse(Buffer.from(input.AccessToken.split('.')[1], 'base64url').toString());
    return { Username: 'test-user', UserAttributes: [
      { Name: 'sub', Value: payload.sub }, { Name: 'email', Value: 'test@example.com' }, { Name: 'email_verified', Value: 'true' }
    ] };
  }
  if (name === 'SignUpCommand') return { UserConfirmed: false };
  return {};
};

export async function serve(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const request = async (path, options = {}) => {
    const response = await fetch(base + path, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      headers: { Origin: 'http://127.0.0.1:4200', ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
    });
    return { response, data: response.status === 204 ? null : await response.json(), cookies: response.headers.getSetCookie() };
  };
  try { await run(request); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

export function cookieHeader(cookies) { return cookies.map(value => value.split(';')[0]).join('; '); }

export function event(path, { method = 'GET', body, cookies, authorization, origin = 'http://127.0.0.1:4200', base64 = false } = {}) {
  return {
    version: '2.0', routeKey: 'ANY /{proxy+}', rawPath: `/api/v1${path}`, rawQueryString: '',
    headers: { host: 'api.example.invalid', origin, 'x-forwarded-proto': 'https',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(authorization ? { authorization } : {}) },
    ...(cookies ? { cookies } : {}),
    requestContext: { accountId: '000000000000', apiId: 'test', domainName: 'api.example.invalid', domainPrefix: 'api',
      http: { method, path: `/api/v1${path}`, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'node-test' },
      requestId: 'test-request', routeKey: 'ANY /{proxy+}', stage: '$default', time: '', timeEpoch: Date.now() },
    ...(body === undefined ? {} : { body: base64 ? Buffer.from(JSON.stringify(body)).toString('base64') : JSON.stringify(body) }),
    isBase64Encoded: base64
  };
}

export const context = () => ({ callbackWaitsForEmptyEventLoop: true, getRemainingTimeInMillis: () => 30000 });

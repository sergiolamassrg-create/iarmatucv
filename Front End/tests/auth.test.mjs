import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as rx from 'rxjs';
await import('@angular/compiler');
const http = await import('@angular/common/http');

function compile(path, modules, globals = {}) {
  const source = readFileSync(new URL('../src/app/core/' + path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true
  } }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports, Date, Number, Boolean, Error, ...globals, require: name => {
    assert(name in modules, name);
    return modules[name];
  } });
  return exports;
}
const { AuthService } = compile('services/auth.service.ts', {
  '@angular/core': { Injectable: () => value => value },
  '@angular/common/http': http, rxjs: rx,
  '../config/api.config': { apiUrl: path => 'https://api.example/api/v1/' + path, ApiConfigurationError: class extends Error {} }
});
const user = { id: 'user-a', nickname: 'Persona' };
function setup() {
  const calls = [];
  let failure;
  let expiresAt = Date.now() + 3600000;
  let serial = 0;
  const client = { post: (...args) => {
    calls.push(args);
    return failure ? rx.throwError(() => failure) : rx.of({ data: user,
      session: { accessToken: 'signed-token-' + ++serial, expiresAt } });
  } };
  const auth = new AuthService(client);
  const { authInterceptor } = compile('interceptors/auth.interceptor.ts', {
    '@angular/core': { inject: () => auth }, '@angular/common/http': http, rxjs: rx,
    '../config/api.config': { apiUrl: () => 'https://api.example/api/v1/' },
    '../services/auth.service': { AuthService }
  });
  return { auth, calls, intercept: authInterceptor, setFailure: value => failure = value, setExpiry: value => expiresAt = value };
}

test('legacy absolute API keeps Bearer only in memory without enabling cross-site renewal cookies', async () => {
  const { auth, calls } = setup();
  assert.equal(await rx.firstValueFrom(auth.waitForSession()), null);
  await rx.firstValueFrom(auth.login('test@example.com', 'password'));
  assert(auth.isAuthenticated());
  assert.equal(auth.getAccessToken(), 'signed-token-1');
  assert.equal(calls[0][1].transport, 'bearer');
  assert.equal(calls[0][2].withCredentials, false);
  assert.equal(setup().auth.isAuthenticated(), false);
});

function persistentSetup(storage = new Map()) {
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const { AuthService: PersistentAuth } = compile('services/auth.service.ts', {
    '@angular/core': { Injectable: () => value => value }, '@angular/common/http': http, rxjs: rx,
    '../config/api.config': { apiUrl: path => '/api/v1/' + path, ApiConfigurationError: class extends Error {} }
  }, { localStorage });
  const calls = []; let respond = () => rx.of({ data: null });
  const client = { post: (...args) => { calls.push(args); return respond(...args); } };
  const auth = new PersistentAuth(client);
  return { auth, calls, storage, respond: handler => respond = handler };
}
const sessionResponse = (token = 'memory-access', id = 'user-a') => ({ data: { ...user, id }, session: { accessToken: token, expiresAt: Date.now() + 3600000 } });

test('same-origin startup waits for one renewal before guards resolve and restores access only in memory', async () => {
  const f = persistentSetup(); const pending = new rx.Subject(); f.respond(() => pending);
  const a = rx.firstValueFrom(f.auth.waitForSession()); const b = rx.firstValueFrom(f.auth.waitForSession());
  assert.equal(f.calls.length, 1); assert.equal(f.auth.isAuthenticated(), false);
  pending.next(sessionResponse()); pending.complete();
  assert.equal((await a).id, 'user-a'); assert.equal((await b).id, 'user-a');
  assert.equal(f.auth.getAccessToken(), 'memory-access'); assert.equal(f.calls[0][2].withCredentials, true);
  assert.equal(f.calls[0][0], '/api/v1/auth/renovar'); assert.equal(f.storage.size, 0);
});
test('reload restores through cookie; new login selects bearer-cookie and leaves storage free of tokens', async () => {
  const f = persistentSetup(); f.respond(() => rx.of(sessionResponse()));
  await rx.firstValueFrom(f.auth.login('a', 'password'));
  assert.equal(f.calls[0][1].transport, 'bearer-cookie');
  const fresh = persistentSetup(f.storage); fresh.respond(() => rx.of(sessionResponse('new-memory-access')));
  await rx.firstValueFrom(fresh.auth.waitForSession());
  assert.equal(fresh.auth.getAccessToken(), 'new-memory-access'); assert.equal(f.storage.size, 0);
});
test('expired memory access renews once for simultaneous requests and transient renewal failures preserve identity', async () => {
  const f = persistentSetup(); f.respond(() => rx.of(sessionResponse())); await rx.firstValueFrom(f.auth.login('a', 'password'));
  f.auth.expiresAt = Date.now() - 1;
  f.respond(() => rx.throwError(() => new http.HttpErrorResponse({ status: 503 })));
  await assert.rejects(rx.firstValueFrom(f.auth.ensureAccess()));
  assert.equal(f.auth.user.id, 'user-a'); assert(f.auth.sessionError);
  const pending = new rx.Subject(); f.respond(() => pending);
  const count = f.calls.length;
  const a = rx.firstValueFrom(f.auth.ensureAccess()); const b = rx.firstValueFrom(f.auth.ensureAccess());
  assert.equal(f.calls.length, count + 1);
  pending.next(sessionResponse('renewed-access')); pending.complete();
  assert.equal(await a, 'renewed-access'); assert.equal(await b, 'renewed-access');
});
test('startup outage supports explicit retry; expired cookie resolves anonymous without repeated renewal loops', async () => {
  const f = persistentSetup(); f.respond(() => rx.throwError(() => new http.HttpErrorResponse({ status: 0 })));
  assert.equal(await rx.firstValueFrom(f.auth.waitForSession()), null); assert(f.auth.sessionError);
  f.respond(() => rx.of(sessionResponse())); await rx.firstValueFrom(f.auth.restoreSession(true)); assert(f.auth.isAuthenticated());
  f.respond(() => rx.throwError(() => new http.HttpErrorResponse({ status: 401 })));
  assert.equal(await rx.firstValueFrom(f.auth.restoreSession(true)), null);
  const count = f.calls.length;
  assert.equal(await rx.firstValueFrom(f.auth.waitForSession()), null); assert.equal(f.calls.length, count);
  assert.match(f.auth.takeLogoutNotice(), /venció/);
});
test('logout blocks late restoration and reload resurrection even if the logout request fails', async () => {
  const f = persistentSetup(); const pending = new rx.Subject(); f.respond(() => pending);
  const restore = rx.firstValueFrom(f.auth.restoreSession());
  f.respond(() => rx.throwError(() => new http.HttpErrorResponse({ status: 0 })));
  await rx.firstValueFrom(f.auth.logout());
  pending.next(sessionResponse()); pending.complete();
  assert.equal(await restore, null); assert.equal(f.auth.user, null);
  assert.equal(f.storage.get('iarmatucv.signedOut'), 'true');
  const fresh = persistentSetup(f.storage); assert.equal(await rx.firstValueFrom(fresh.auth.waitForSession()), null); assert.equal(fresh.calls.length, 0);
  fresh.respond(() => rx.of(sessionResponse())); await rx.firstValueFrom(fresh.auth.login('a', 'password'));
  assert.equal(f.storage.size, 0);
});
test('malformed proxy responses produce a recoverable error instead of discarding an existing identity', async () => {
  const f = persistentSetup(); f.respond(() => rx.of(sessionResponse()));
  await rx.firstValueFrom(f.auth.login('a', 'password'));
  f.respond(() => rx.of({ unexpected: 'HTML fallback or invalid API contract' }));
  await assert.rejects(rx.firstValueFrom(f.auth.restoreSession(true)), { status: 503 });
  assert.equal(f.auth.user.id, 'user-a'); assert(f.auth.sessionError);
});

test('incorrect password does not authenticate; expired login is rejected', async () => {
  const fixture = setup();
  fixture.setFailure(new http.HttpErrorResponse({ status: 401 }));
  await assert.rejects(rx.firstValueFrom(fixture.auth.login('a', 'bad')));
  assert.equal(fixture.auth.isAuthenticated(), false);
  fixture.setFailure(undefined);
  fixture.setExpiry(Date.now() - 1);
  await assert.rejects(rx.firstValueFrom(fixture.auth.login('a', 'password')));
  assert.equal(fixture.auth.isAuthenticated(), false);
});

test('interceptor attaches Bearer to profile and Milo, excludes external URLs and public login', async () => {
  const { auth, intercept } = setup();
  await rx.firstValueFrom(auth.login('a', 'password'));
  for (const path of ['perfil', 'milo/chat']) {
    await rx.firstValueFrom(intercept(new http.HttpRequest('GET', 'https://api.example/api/v1/' + path, { withCredentials: true }), req => {
      assert.equal(req.headers.get('Authorization'), auth.getAccessToken() ? 'Bearer ' + auth.getAccessToken() : null);
      assert.equal(req.withCredentials, false);
      return rx.of(null);
    }));
  }
  for (const url of ['https://api.example.evil/api/v1/perfil', 'https://other.example/api/v1/perfil', 'https://api.example/api/v1/auth/ingreso']) {
    await rx.firstValueFrom(intercept(new http.HttpRequest('GET', url), req => {
      assert.equal(req.headers.has('Authorization'), false);
      return rx.of(null);
    }));
  }
});

test('401 clears session with notice exactly once and never retries; transient failures preserve it', async () => {
  for (const status of [0, 403, 500, 503, 401]) {
    const { auth, intercept } = setup();
    await rx.firstValueFrom(auth.login('a', 'password'));
    let calls = 0;
    await assert.rejects(rx.firstValueFrom(intercept(new http.HttpRequest('GET', 'https://api.example/api/v1/perfil'), () => {
      calls++;
      return rx.throwError(() => new http.HttpErrorResponse({ status }));
    })));
    assert.equal(calls, 1);
    assert.equal(auth.isAuthenticated(), status !== 401);
    if (status === 401) assert.match(auth.takeLogoutNotice(), /venció/);
  }
});

test('late 401 from an old token cannot erase a new session', async () => {
  const { auth, intercept } = setup();
  await rx.firstValueFrom(auth.login('a', 'password'));
  const pending = new rx.Subject();
  const result = rx.firstValueFrom(intercept(new http.HttpRequest('GET', 'https://api.example/api/v1/perfil'), () => pending));
  await rx.firstValueFrom(auth.login('b', 'password'));
  pending.error(new http.HttpErrorResponse({ status: 401 }));
  await assert.rejects(result);
  assert(auth.isAuthenticated());
  assert.equal(auth.getAccessToken(), 'signed-token-2');
});

test('expiration clears identity; logout clears memory even when server is unreachable', async () => {
  const fixture = setup();
  await rx.firstValueFrom(fixture.auth.login('a', 'password'));
  fixture.auth.expiresAt = Date.now() - 1;
  assert.equal(fixture.auth.getAccessToken(), null);
  assert.equal(fixture.auth.user, null);
  await rx.firstValueFrom(fixture.auth.login('a', 'password'));
  fixture.setFailure(new http.HttpErrorResponse({ status: 0 }));
  const result = await rx.firstValueFrom(fixture.auth.logout());
  assert.equal(fixture.auth.isAuthenticated(), false);
  assert.equal(fixture.calls.at(-1)[2].headers.Authorization, 'Bearer signed-token-2');
  assert.match(result.data.message, /este navegador/);
  assert.match(fixture.auth.takeLogoutNotice(), /remoto/);
});

test('private guard permits valid sessions and returns one login UrlTree without credentials', async () => {
  const { auth } = setup();
  const tree = { url: '/acceso' };
  const Router = class {};
  const { authGuard } = compile('guards/auth.guard.ts', {
    '@angular/core': { inject: type => type === AuthService ? auth : { createUrlTree: () => tree } },
    '@angular/router': { Router }, rxjs: rx, '../services/auth.service': { AuthService }
  });
  assert.equal(await rx.firstValueFrom(authGuard()), tree);
  await rx.firstValueFrom(auth.login('a', 'password'));
  assert.equal(authGuard(), true);
  auth.invalidateSession();
  assert.equal(await rx.firstValueFrom(authGuard()), tree);
});
test('admin guard waits for session and restricts the panel to server-provided admin identity', async () => {
  const f = persistentSetup(); const Router = class {};
  const { adminGuard } = compile('guards/admin.guard.ts', {
    '@angular/core': { inject: type => type === Router ? { createUrlTree: value => value[0] } : f.auth },
    '@angular/router': { Router }, rxjs: rx, '../services/auth.service': { AuthService }
  });
  assert.equal(await rx.firstValueFrom(adminGuard()), '/acceso');
  f.respond(() => rx.of(sessionResponse())); await rx.firstValueFrom(f.auth.login('a', 'password'));
  assert.equal(await rx.firstValueFrom(adminGuard()), '/panel');
  f.respond(() => rx.of({ ...sessionResponse(), data: { ...user, isAdmin: true } }));
  await rx.firstValueFrom(f.auth.login('a', 'password'));
  assert.equal(await rx.firstValueFrom(adminGuard()), true);
});


import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/app/core/config/api.config.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function config(apiBaseUrl, production = true) {
  const exports = {};
  runInNewContext(compiled, {
    exports, URL, Error,
    require: path => {
      assert.equal(path, '../../../environments/environment');
      return { environment: { production, apiBaseUrl } };
    }
  });
  return exports;
}

test('production accepts root-relative API paths and keeps requests on the same origin', () => {
  const { apiUrl } = config('/api/v1/');
  for (const path of ['auth/ingreso', 'auth/sesion', 'auth/salida', 'auth/registro']) {
    const result = apiUrl(path);
    assert.equal(result, `/api/v1/${path}`);
    assert.equal(new URL(result, 'https://app.example.com').origin, 'https://app.example.com');
  }
});

test('production accepts absolute HTTPS API URLs', () => {
  const { apiUrl } = config('https://w6og1akmjh.execute-api.us-east-1.amazonaws.com/api/v1/');
  assert.equal(apiUrl('/auth/ingreso'), 'https://w6og1akmjh.execute-api.us-east-1.amazonaws.com/api/v1/auth/ingreso');
});

test('production rejects unsafe, ambiguous or missing API bases', () => {
  for (const base of ['', '/', '//evil.example/api', '/\\evil.example/api', '/api/../other',
    '/api/%2e%2e/other', '/%2f%2fevil.example', '/api?next=other', '/api#other', '/api\n/v1',
    'api/v1', 'http://api.example.com/api/v1', 'javascript:alert(1)',
    'https://user:password@api.example.com/api/v1', 'https://api.example.com/api?x=1',
    'https://api.example.com/api#fragment', 'https://localhost/api', 'https://app.localhost/api',
    'https://127.0.0.1/api', 'https://[::1]/api', 'https://0.0.0.0/api']) {
    const { apiUrl, ApiConfigurationError } = config(base);
    assert.throws(() => apiUrl('auth/ingreso'), ApiConfigurationError, base);
  }
});

test('development keeps its local HTTP API URL', () => {
  const { apiUrl } = config('http://127.0.0.1:3000/api/v1', false);
  assert.equal(apiUrl('auth/ingreso'), 'http://127.0.0.1:3000/api/v1/auth/ingreso');
});

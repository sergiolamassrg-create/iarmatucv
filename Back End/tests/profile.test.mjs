import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';

Object.assign(process.env, { AWS_REGION: 'us-east-1', DYNAMODB_PERFILES_TABLE: 'test-profiles' });
const { createApp, createLambdaHandler, token, verify, otherKeys, serve, event, context, cognitoClient } = await import('./helpers.mjs');
const { profileClient } = await import('../dist/repositories/profile.repository.js');
const { environment } = await import('../dist/config/environment.js');
const { validateProfile } = await import('../dist/services/profile.service.js');
const records = new Map();
let calls = [];
let failure;

profileClient.send = async command => {
  calls.push(command);
  if (failure) throw failure;
  const input = command.input;
  assert.equal(input.TableName, 'test-profiles');
  assert.deepEqual(Object.keys(input.Key), ['userId']);
  const id = input.Key.userId;
  assert.notEqual(id, 'DEMO_USER_SUB_REEMPLAZAR');
  if (command.constructor.name === 'GetCommand') return { Item: structuredClone(records.get(id)) };
  if (command.constructor.name === 'DeleteCommand') { records.delete(id); return {}; }
  assert.equal(command.constructor.name, 'UpdateCommand');
  assert(input.UpdateExpression.includes('#createdAt = if_not_exists(#createdAt, :now)'));
  assert.equal(input.ReturnValues, 'ALL_NEW');
  const values = input.ExpressionAttributeValues;
  const saved = { userId: id, createdAt: records.get(id)?.createdAt ?? values[':now'],
    updatedAt: values[':now'], schemaVersion: values[':version'] };
  for (const [name, field] of Object.entries(input.ExpressionAttributeNames)) {
    if (name.startsWith('#f')) saved[field] = values[':v' + name.slice(2)];
  }
  records.set(id, structuredClone(saved));
  return { Attributes: saved };
};

function profile() {
  return {
    datosPersonales: { nombre: 'Persona', apellido: 'Ejemplo', email: 'persona@example.com', telefono: null,
      ubicacion: { ciudad: 'Ciudad', pais: 'Argentina' }, linkedin: null },
    perfilProfesional: { titulo: 'Desarrollo', resumen: 'Mi experiencia', puestosObjetivo: ['Desarrollo'], modalidadesPreferidas: [], disponibilidad: null },
    experiencias: [{ id: 'exp-1', empresa: 'Empresa', puesto: 'Desarrollo', fechaInicio: '2025', fechaFin: null,
      actual: true, ubicacion: { pais: 'Argentina' }, responsabilidades: ['Desarrollar'], logros: [], tecnologias: ['Node.js'], habilidadesIds: ['node'] }],
    educacion: [{ id: 'edu-1', institucion: 'Instituto', titulo: 'Software', nivel: 'terciario', estado: 'en_curso', fechaInicio: null, fechaFin: null }],
    habilidades: [{ id: 'node', nombre: 'Node.js', categoria: 'herramienta', nivel: null }],
    idiomas: [{ idioma: 'Ingles', nivel: null, estado: 'en_formacion' }],
    certificaciones: [{ nombre: 'Certificacion', emisor: 'Instituto', fecha: '2025' }],
    proyectos: [{ nombre: 'Proyecto', tecnologias: ['Angular'], url: null }],
    licencias: [{ nombre: 'Licencia' }], voluntariados: [{ organizacion: 'Organizacion' }],
    reconocimientos: [{ descripcion: 'Reconocimiento' }],
    preferenciasPrivacidad: { mostrarTelefono: false, mostrarUbicacionCompleta: false },
    camposPendientesDeValidacion: ['telefono']
  };
}

beforeEach(() => { records.clear(); calls = []; failure = undefined; });
after(() => { profileClient.destroy(); cognitoClient.destroy(); });

test('profile CRUD retains every section, preserves createdAt and isolates authenticated users', async () => {
  await serve(createApp({ verifyAccessToken: verify }), async request => {
    const a = { Authorization: `Bearer ${token()}` };
    const b = { Authorization: `Bearer ${token({ sub: 'user-b' })}` };
    assert.equal((await request('/perfil', { headers: a })).response.status, 404);
    const body = profile();
    const created = await request('/perfil', { method: 'PUT', headers: a, body });
    assert.equal(created.response.status, 200);
    assert.equal(created.response.headers.get('cache-control'), 'no-store');
    assert.equal(created.data.data.userId, 'user-a');
    for (const field of Object.keys(body)) assert.deepEqual(created.data.data[field], body[field]);
    assert.equal(created.data.data.schemaVersion, 1);
    assert.equal(created.data.data.createdAt, created.data.data.updatedAt);
    assert.equal((await request('/perfil', { headers: b })).response.status, 404);
    await new Promise(resolve => setTimeout(resolve, 5));
    body.perfilProfesional.resumen = 'Experiencia actualizada';
    const updated = await request('/perfil', { method: 'PUT', headers: a, body });
    assert.equal(updated.data.data.createdAt, created.data.data.createdAt);
    assert(updated.data.data.updatedAt > created.data.data.updatedAt);
    assert.deepEqual((await request('/perfil', { headers: a })).data, updated.data);
    await request('/perfil', { method: 'PUT', headers: b, body: profile() });
    assert.equal((await request('/perfil', { method: 'DELETE', headers: a })).response.status, 204);
    assert.equal((await request('/perfil', { headers: a })).response.status, 404);
    assert.equal((await request('/perfil', { headers: b })).data.data.userId, 'user-b');
    assert.equal((await request('/perfil', { method: 'DELETE', headers: a })).response.status, 204);
    assert(calls.filter(call => call.constructor.name === 'GetCommand').every(call => call.input.ConsistentRead));
  });
});

test('profile routes require a cryptographically valid access token before accessing DynamoDB', async () => {
  await serve(createApp({ verifyAccessToken: verify }), async request => {
    for (const method of ['GET', 'PUT', 'DELETE']) {
      for (const value of [undefined, token({}, { privateKey: otherKeys.privateKey }),
        token({ exp: 1 }), token({ iss: 'https://evil.example' }), token({ client_id: 'other' }),
        token({ token_use: 'id', aud: 'testclient' })]) {
        const headers = value ? { Authorization: `Bearer ${value}` } : { 'x-user-id': 'user-a' };
        assert.equal((await request('/perfil', { method, headers, ...(method === 'PUT' ? { body: profile() } : {}) })).response.status, 401);
      }
    }
    assert.equal(calls.length, 0);
  });
});

test('demo identity and client-supplied ownership or metadata are rejected', async () => {
  await serve(createApp({ verifyAccessToken: verify }), async request => {
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const result = await request('/perfil', { method, headers: { Authorization: `Bearer ${token({ sub: 'DEMO_USER_SUB_REEMPLAZAR' })}` },
        ...(method === 'PUT' ? { body: profile() } : {}) });
      assert.equal(result.response.status, 403);
    }
    for (const field of ['userId', 'createdAt', 'updatedAt', 'schemaVersion', 'unknown']) {
      assert.equal((await request('/perfil', { method: 'PUT', headers: { Authorization: `Bearer ${token()}` },
        body: { ...profile(), [field]: 'user-b' } })).response.status, 400);
    }
    const forged = await request('/perfil?userId=user-b', { method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'x-user-id': 'user-b' }, body: profile() });
    assert.equal(forged.data.data.userId, 'user-a');
    assert.equal(records.has('user-b'), false);
  });
});

test('invalid sections, nested values, privacy, dangerous keys and oversized bodies are rejected', async () => {
  const cases = [null, [], {}, { ...profile(), experiencias: {} }, { ...profile(), datosPersonales: [] },
    { ...profile(), habilidades: ['Node'] }, { ...profile(), perfilProfesional: { puestosObjetivo: [1] } },
    { ...profile(), preferenciasPrivacidad: { mostrarTelefono: 'true' } },
    { ...profile(), datosPersonales: { email: 'invalid' } },
    { ...profile(), datosPersonales: { portfolio: 'javascript:alert(1)' } },
    { ...profile(), proyectos: [{ url: 'https://user:password@example.com' }] },
    { ...profile(), experiencias: [{ actual: 'true' }] },
    { ...profile(), camposPendientesDeValidacion: [1] },
    { ...profile(), datosPersonales: { nombre: 'x'.repeat(5001) } },
    { ...profile(), idiomas: Array(101).fill({}) },
    { ...profile(), datosPersonales: JSON.parse('{"__proto__":{"admin":true}}') }];
  for (const body of cases) assert.throws(() => validateProfile(body), { code: 'PERFIL_INVALIDO' });
  const { camposPendientesDeValidacion, ...withoutPending } = profile();
  assert.deepEqual(validateProfile(withoutPending).camposPendientesDeValidacion, []);
  await serve(createApp({ verifyAccessToken: verify }), async request => {
    const headers = { Authorization: `Bearer ${token()}` };
    assert.equal((await request('/perfil', { method: 'PUT', headers, body: {} })).response.status, 400);
    assert.equal((await request('/perfil', { method: 'PUT', headers, body: { text: 'x'.repeat(40000) } })).response.status, 413);
    assert.equal(calls.length, 0);
  });
});

test('cookie writes enforce origin and PUT requires JSON', async () => {
  await serve(createApp({ verifyAccessToken: verify }), async request => {
    const cookie = { Cookie: `iarmatucv.access=${token()}` };
    for (const method of ['PUT', 'DELETE']) {
      for (const Origin of ['', 'https://evil.example']) {
        assert.equal((await request('/perfil', { method, headers: { ...cookie, Origin },
          ...(method === 'PUT' ? { body: profile() } : {}) })).response.status, 403);
      }
    }
    assert.equal((await request('/perfil', { method: 'PUT', headers: { ...cookie, 'Content-Type': 'text/plain' }, body: profile() })).response.status, 415);
    assert.equal(calls.length, 0);
    assert.equal((await request('/perfil', { method: 'PUT', headers: cookie, body: profile() })).response.status, 200);
    assert.equal((await request('/perfil', { method: 'DELETE', headers: cookie })).response.status, 204);
    const bearer = await request('/perfil', { method: 'PUT', body: profile(), headers: { Authorization: `Bearer ${token()}`, Origin: '' } });
    assert.equal(bearer.response.status, 200);
  });
});

test('missing configuration and DynamoDB failures return safe errors', async () => {
  await serve(createApp({ verifyAccessToken: verify }), async request => {
    const headers = { Authorization: `Bearer ${token()}` };
    const previous = environment.dynamodb.perfilesTable;
    environment.dynamodb.perfilesTable = '';
    try {
      const missing = await request('/perfil', { headers });
      assert.equal(missing.response.status, 503);
      assert.equal(missing.data.error.codigo, 'PERFIL_NO_CONFIGURADO');
      assert.equal(calls.length, 0);
    } finally { environment.dynamodb.perfilesTable = previous; }
    failure = new Error('sensitive-credentials-or-internal-table-details');
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const result = await request('/perfil', { method, headers, ...(method === 'PUT' ? { body: profile() } : {}) });
      assert.equal(result.response.status, 503);
      assert.equal(result.data.error.codigo, 'PERFIL_NO_DISPONIBLE');
      assert(!JSON.stringify(result.data).includes('sensitive'));
    }
  });
});

test('Lambda HTTP API v2 supports cookie CRUD without retaining another users profile', async () => {
  const invoke = createLambdaHandler(verify);
  const cookies = [`iarmatucv.access=${token()}`];
  const saved = await invoke(event('/perfil', { method: 'PUT', body: profile(), cookies }), context());
  assert.equal(saved.statusCode, 200);
  const get = await invoke(event('/perfil', { cookies }), context());
  assert.equal(JSON.parse(get.body).data.userId, 'user-a');
  assert.equal((await invoke(event('/perfil'), context())).statusCode, 401);
  assert.equal((await invoke(event('/perfil', { authorization: `Bearer ${token({ sub: 'user-b' })}` }), context())).statusCode, 404);
  assert.equal((await invoke(event('/perfil', { method: 'DELETE', cookies }), context())).statusCode, 204);
  assert.equal((await invoke(event('/perfil', { cookies }), context())).statusCode, 404);
});

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test, after } from 'node:test';
import express from 'express';
import { verify, token, serve, cognitoClient } from './milo-agent-auth.helpers.mjs';
import { fixture, call, answer, send, draft, prepare } from './milo-agent.helpers.mjs';
import { createMiloAgentRouter } from '../dist/milo-agent/router.js';
import { createCurriculumsRouter } from '../dist/routes/curriculums.routes.js';
import { errorHandler } from '../dist/middlewares/error.middleware.js';
import { agentStore, miloDocumentClient, stateKey } from '../dist/milo-agent/store.js';
import { environment } from '../dist/config/environment.js';

after(() => { cognitoClient.destroy(); miloDocumentClient.destroy(); });
const changes = () => ({ cambios: [{ campo: 'datosPersonales.nombre', valor: 'Sergio' },
  { campo: 'perfilProfesional.titulo', valor: 'Soporte informatico' }] });
async function propose(f, args = changes()) {
  f.script.push(call('prepararEdicionPerfil', args), answer('Revisa los cambios.'));
  return (await send(f.agent)).propuestaPerfil;
}
test('own profile: preview only, explicit confirmation, preserved contacts, isolated owner, idempotent retry', async () => {
  const f = fixture();
  const before = await f.ports.profile('user-a');
  const proposal = await propose(f);
  assert.equal(proposal.cambios[0].anterior, before.datosPersonales.nombre);
  assert.deepEqual(await f.ports.profile('user-a'), before);
  assert.equal(f.profiles.size, 0);
  const confirm = { propuestaId: proposal.id, confirmar: true };
  await assert.rejects(f.agent.confirmProfile('user-b', confirm), { status: 409 });
  await assert.rejects(async () => f.agent.confirmProfile('user-a', { ...confirm, userId: 'user-b' }), { status: 400 });
  await assert.rejects(async () => f.agent.confirmProfile('user-a', { ...confirm, confirmar: false }), { status: 400 });
  const saved = await f.agent.confirmProfile('user-a', confirm);
  const updated = await f.ports.profile('user-a');
  assert.equal(updated.userId, 'user-a');
  assert.equal(updated.datosPersonales.nombre, 'Sergio');
  assert.equal(updated.perfilProfesional.titulo, 'Soporte informatico');
  assert.equal(updated.datosPersonales.email, before.datosPersonales.email);
  assert.equal(updated.datosPersonales.telefono, before.datosPersonales.telefono);
  assert.deepEqual(updated.habilidades, before.habilidades);
  assert.equal(saved.propuestaPerfil, null);
  assert.equal(f.profiles.has('user-b'), false);
  assert.deepEqual(await f.agent.confirmProfile('user-a', confirm), saved);
  assert.equal(f.locks.size, 0);
  // The tool response to Gemini contains only confirmation metadata, never the profile snapshot.
  const response = f.modelCalls[1].at(-1).parts[0].functionResponse.response.result;
  assert.deepEqual(Object.keys(response).sort(), ['estado', 'propuestaId']);
});
test('profile proposal rejects identity/contact paths and additional properties from the model', async () => {
  for (const args of [
    { ...changes(), userId: 'marta' },
    { cambios: [{ campo: 'userId', valor: 'marta' }] },
    { cambios: [{ campo: 'datosPersonales.email', valor: 'other@example.com' }] },
    { cambios: [{ campo: '__proto__.nombre', valor: 'bad' }] },
    { cambios: [changes().cambios[0], changes().cambios[0]] },
    { cambios: [] }
  ]) {
    const f = fixture();
    await assert.rejects(propose(f, args), { status: 400 });
    assert.equal(f.profiles.size, 0);
    assert.equal(f.records.size, 0);
    assert.equal(f.locks.size, 0);
  }
});
test('profile edits reject stale/expired/canceled proposals and retain state after failed commit', async () => {
  const f = fixture();
  let proposal = await propose(f);
  const current = await f.ports.profile('user-a');
  f.profiles.set('user-a', { ...current, updatedAt: '2026-11-26T00:00:00Z' });
  await assert.rejects(f.agent.confirmProfile('user-a', { propuestaId: proposal.id, confirmar: true }), { status: 409, code: 'MILO_PERFIL_MODIFICADO' });
  proposal = await propose(f);
  f.records.get('user-a').profilePending.expiresAt = Date.now() - 1;
  await assert.rejects(f.agent.confirmProfile('user-a', { propuestaId: proposal.id, confirmar: true }), { status: 409 });
  proposal = await propose(f);
  await f.agent.cancel('user-a', { propuestaId: proposal.id });
  await assert.rejects(f.agent.confirmProfile('user-a', { propuestaId: proposal.id, confirmar: true }), { status: 409 });
  proposal = await propose(f);
  const original = f.ports.store.saveProfile;
  f.ports.store.saveProfile = async () => { throw new Error('mock unavailable'); };
  await assert.rejects(f.agent.confirmProfile('user-a', { propuestaId: proposal.id, confirmar: true }));
  assert.equal(f.records.get('user-a').profilePending.id, proposal.id);
  assert.equal(f.profiles.get('user-a').datosPersonales.nombre, current.datosPersonales.nombre);
  f.ports.store.saveProfile = original;
  await f.agent.confirmProfile('user-a', { propuestaId: proposal.id, confirmar: true });
  assert.equal(f.profiles.get('user-a').datosPersonales.nombre, 'Sergio');
});
test('DynamoDB commits canonical JWT-owned profile and consumed proposal in one conditional transaction', async () => {
  environment.dynamodb.perfilesTable = 'test-profiles';
  const f = fixture();
  const profile = await f.ports.profile('user-a');
  const { userId, createdAt, updatedAt, schemaVersion, ...data } = profile;
  const original = miloDocumentClient.send;
  const calls = [];
  miloDocumentClient.send = async command => { calls.push(command); return {}; };
  try {
    await f.agent.history('user-a');
    await agentStore.saveProfile('user-a', 'lease-owner', f.records.get('user-a'), data, updatedAt);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].constructor.name, 'TransactWriteCommand');
    const [canonical, consumed] = calls[0].input.TransactItems.map(item => item.Update);
    assert.deepEqual(canonical.Key, { userId: 'user-a' });
    assert.equal(canonical.ConditionExpression, '#updatedAt = :expected');
    assert.equal(canonical.ExpressionAttributeValues[':expected'], updatedAt);
    assert.equal('ReturnValues' in canonical, false);
    assert.deepEqual(consumed.Key, { userId: stateKey('user-a') });
    assert.match(consumed.ConditionExpression, /leaseOwner = :owner/);
    miloDocumentClient.send = async () => { throw Object.assign(new Error('stale'), { name: 'TransactionCanceledException', CancellationReasons: [{ Code: 'ConditionalCheckFailed' }] }); };
    await assert.rejects(agentStore.saveProfile('user-a', 'lease-owner', f.records.get('user-a'), data, updatedAt), { status: 409 });
  } finally { miloDocumentClient.send = original; }
});
test('profile confirmation HTTP endpoint enforces JWT, origin, owner and exact body', async () => {
  const f = fixture();
  const proposal = await propose(f);
  const app = express(); app.use(express.json());
  app.use('/api/v1/milo/agente', createMiloAgentRouter({ mode: 'jwt', verifyAccessToken: verify }, f.agent));
  app.use(errorHandler);
  await serve(app, async request => {
    const body = { propuestaId: proposal.id, confirmar: true };
    const headers = { Authorization: 'Bearer ' + token() };
    assert.equal((await request('/milo/agente/confirmaciones-perfil', { body })).response.status, 401);
    assert.equal((await request('/milo/agente/confirmaciones-perfil', { body, headers: { ...headers, Origin: 'https://evil.example' } })).response.status, 403);
    assert.equal((await request('/milo/agente/confirmaciones-perfil', { body, headers: { Authorization: 'Bearer ' + token({ sub: 'user-b' }) } })).response.status, 409);
    assert.equal((await request('/milo/agente/confirmaciones-perfil', { body: { ...body, userId: 'marta' }, headers })).response.status, 400);
    assert.equal((await request('/milo/agente/confirmaciones-perfil', { body, headers })).response.status, 200);
  });
});
test('multiple CV library shares Milo storage, works without Gemini, keeps versions/owners isolated', async () => {
  const f = fixture({ enabled: false, model: '', apiKey: '' });
  const requestId = randomUUID();
  const support = { ...draft(), titulo: 'Soporte', experiencias: [{ ...draft().experiencias[0], fechaInicio: '2025-01', actual: true }] };
  const first = await f.agent.createCv('user-a', { requestId, datos: support });
  assert.deepEqual(await f.agent.createCv('user-a', { requestId, datos: support }), first);
  const logistics = await f.agent.duplicateCv('user-a', first.id, { requestId: randomUUID() });
  const changed = { ...logistics.datos, titulo: 'Logistica', habilidades: ['Inventario'] };
  const edit = { requestId: randomUUID(), revision: logistics.revision, datos: changed };
  await f.agent.updateCv('user-a', logistics.id, edit);
  assert.equal((await f.agent.getCv('user-a', first.id)).datos.titulo, 'Soporte');
  assert.equal((await f.agent.getCv('user-a', logistics.id)).datos.titulo, 'Logistica');
  assert.equal((await f.agent.updateCv('user-a', logistics.id, edit)).revision, 2);
  await assert.rejects(f.agent.updateCv('user-a', logistics.id, { ...edit, requestId: randomUUID() }), { status: 409 });
  await assert.rejects(f.agent.getCv('user-b', first.id), { status: 404 });
  await assert.rejects(f.agent.updateCv('user-b', first.id, edit), { status: 404 });
  await assert.rejects(f.agent.duplicateCv('user-b', first.id, { requestId: randomUUID() }), { status: 404 });
  assert.equal((await f.agent.listCvs('user-b')).length, 0);
  assert.equal((await f.agent.listCvs('user-a')).length, 2);
  assert.equal(f.modelCalls.length, 0); assert.equal(f.counts.size, 0); assert.equal(f.profiles.size, 0);
});
test('manual CV endpoints require JWT and reject client-supplied ownership', async () => {
  const f = fixture({ enabled: false, apiKey: '' });
  const app = express(); app.use(express.json());
  app.use('/api/v1/curriculums', createCurriculumsRouter({ mode: 'jwt', verifyAccessToken: verify }, f.agent));
  app.use(errorHandler);
  await serve(app, async request => {
    assert.equal((await request('/curriculums')).response.status, 401);
    const headers = { Authorization: 'Bearer ' + token() };
    const body = { requestId: randomUUID(), datos: draft() };
    assert.equal((await request('/curriculums', { headers, body: { ...body, userId: 'marta' } })).response.status, 400);
    const created = await request('/curriculums', { headers, body });
    assert.equal(created.response.status, 201);
    assert.equal((await request('/curriculums/' + created.data.data.id, { headers: { Authorization: 'Bearer ' + token({ sub: 'user-b' }) } })).response.status, 404);
    assert.equal((await request('/curriculums', { headers })).data.data.length, 1);
  });
});
test('CV dates survive normalization; duplication retries and pending confirmations respect capacity', async () => {
  const f = fixture({ maxCvs: 2 });
  const pending = await prepare(f);
  const original = await f.agent.createCv('user-a', { requestId: randomUUID(), datos: { ...draft(),
    experiencias: [{ ...draft().experiencias[0], fechaInicio: '2025-01-15', fechaFin: '2026-11-26' }] } });
  assert.equal(original.datos.experiencias[0].fechaInicio, '2025-01-15');
  const requestId = randomUUID();
  const copy = await f.agent.duplicateCv('user-a', original.id, { requestId });
  assert.deepEqual(await f.agent.duplicateCv('user-a', original.id, { requestId }), copy);
  await assert.rejects(f.agent.duplicateCv('user-a', copy.id, { requestId: original.id }), { status: 409 });
  await assert.rejects(f.agent.confirm('user-a', { propuestaId: pending.id, confirmar: true }), { status: 409, code: 'MILO_MAX_CVS' });
  assert.equal((await f.agent.listCvs('user-a')).length, 2);
});
test('Milo and manual edits persist either design on the same CV, with legacy compatibility and owner isolation', async () => {
  const f = fixture();
  const datos = { ...draft(), plantilla: 'moderna' };
  const proposal = await prepare(f, 'user-a', datos);
  await f.agent.confirm('user-a', { propuestaId: proposal.id, confirmar: true });
  const original = await f.agent.getCv('user-a', proposal.curriculumId);
  assert.equal(original.datos.plantilla, 'moderna');
  const changed = await f.agent.updateCv('user-a', original.id, { requestId: randomUUID(), revision: original.revision,
    datos: { ...original.datos, plantilla: 'ats' } });
  assert.deepEqual(changed.datos, { ...datos, plantilla: 'ats' });
  assert.equal((await f.agent.getCv('user-a', original.id)).datos.plantilla, 'ats');
  assert.equal((await f.agent.listCvs('user-a')).length, 1);
  assert.equal((await f.agent.listCvs('user-a'))[0].plantilla, 'ats');
  assert.equal((await f.agent.listCvs('user-b')).length, 0);
  const legacy = await f.agent.createCv('user-a', { requestId: randomUUID(), datos: draft() });
  assert.equal('plantilla' in legacy.datos, false);
  assert.equal((await f.agent.listCvs('user-a')).find(cv => cv.id === legacy.id).plantilla, 'ats');
  for (const plantilla of [null, true, 'otra', {}, 'https://example.com']) {
    await assert.rejects(async () => f.agent.createCv('user-a', { requestId: randomUUID(), datos: { ...datos, plantilla } }),
      { status: 400, code: 'MILO_PLANTILLA_INVALIDA' });
  }
});

test('new conversation removes unconfirmed profile edits', async () => {
  const f = fixture(); const proposal = await propose(f);
  assert.equal((await f.agent.newConversation('user-a', {})).propuestaPerfil, null);
  await assert.rejects(f.agent.confirmProfile('user-a', { propuestaId: proposal.id, confirmar: true }), { status: 409 });
  assert.equal(f.profiles.size, 0);
});
test('profile edits accept persisted profiles without optional validation metadata', async () => {
  const f = fixture();
  const profile = await f.ports.profile('user-a'); delete profile.camposPendientesDeValidacion;
  f.profiles.set('user-a', profile);
  const proposal = await propose(f);
  await f.agent.confirmProfile('user-a', { propuestaId: proposal.id, confirmar: true });
  assert.equal(f.profiles.get('user-a').datosPersonales.nombre, 'Sergio');
  assert.deepEqual(f.profiles.get('user-a').camposPendientesDeValidacion, []);
});
test('CV internal name and optional professional heading round-trip independently in manual and Milo edits', async () => {
  const f = fixture();
  const datos = { ...draft(), titulo: 'Sergio - Analista de Operaciones', tituloProfesional: 'Analista de Operaciones' };
  const proposal = await prepare(f, 'user-a', datos);
  assert.deepEqual(proposal.datos, datos);
  await f.agent.confirm('user-a', { propuestaId: proposal.id, confirmar: true });
  const renamed = await f.agent.updateCv('user-a', proposal.curriculumId, { requestId: randomUUID(), revision: 1,
    datos: { ...datos, titulo: 'Postulacion Logistica - copia interna' } });
  assert.equal(renamed.datos.tituloProfesional, 'Analista de Operaciones');
  assert.equal((await f.agent.listCvs('user-a'))[0].titulo, 'Postulacion Logistica - copia interna');
  const legacy = await f.agent.createCv('user-a', { requestId: randomUUID(), datos: draft() });
  assert.equal('tituloProfesional' in legacy.datos, false);
  await assert.rejects(async () => f.agent.createCv('user-a', { requestId: randomUUID(), datos: { ...datos, tituloProfesional: 123 } }), { status: 400 });
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/app/core/models/professional-profile.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { profileDraft, listSections } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('a new draft contains every section without invented professional information', () => {
  const draft = profileDraft();
  for (const key of listSections) assert.deepEqual(draft[key], []);
  assert.deepEqual(draft.datosPersonales, {});
  assert.deepEqual(draft.perfilProfesional, {});
  assert.deepEqual(draft.preferenciasPrivacidad, {});
  assert.deepEqual(draft.camposPendientesDeValidacion, []);
});

test('editing preserves hidden fields, nested values, nulls and every list without mutating the loaded document', () => {
  const profile = { ...profileDraft(), datosPersonales: { nombre: 'Persona', telefono: null,
    ubicacion: { pais: 'Argentina', codigoPostal: '1234' }, campoNoVisible: { preservar: true } },
    experiencias: [{ id: 'exp-1', habilidadesIds: ['python'], campoNoVisible: { valor: null } }],
    preferenciasPrivacidad: { otraPreferencia: true }, camposPendientesDeValidacion: ['fechas'],
    userId: 'user-a', schemaVersion: 1, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
  for (const key of listSections.filter(key => key !== 'experiencias')) profile[key] = [{ campoNoVisible: { conservar: true } }];
  const snapshot = structuredClone(profile);
  const draft = profileDraft(profile);
  draft.datosPersonales.nombre = 'Nombre nuevo';
  assert.deepEqual(draft.datosPersonales.campoNoVisible, { preservar: true });
  assert.deepEqual(draft.datosPersonales.ubicacion, snapshot.datosPersonales.ubicacion);
  assert.equal(draft.datosPersonales.telefono, null);
  for (const key of listSections) assert.deepEqual(draft[key], snapshot[key]);
  draft.experiencias[0].campoNoVisible.valor = 'editado';
  draft.camposPendientesDeValidacion.push('otros datos');
  assert.deepEqual(profile, snapshot);
});

test('the PUT draft excludes ownership, timestamps, version and unknown root metadata', () => {
  const draft = profileDraft({ ...profileDraft(), userId: 'other-user', schemaVersion: 99,
    createdAt: 'forged', updatedAt: 'forged', unknownRootMetadata: 'do not send' });
  for (const key of ['userId', 'schemaVersion', 'createdAt', 'updatedAt', 'unknownRootMetadata']) assert.equal(key in draft, false);
  assert.equal(Object.keys(draft).length, 13);
});

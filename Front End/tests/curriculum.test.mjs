import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const dataModule = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
function compile(name) {
  return ts.transpileModule(readFileSync(new URL(`../src/app/core/models/${name}.ts`, import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
}
const profileModule = dataModule(compile('professional-profile'));
const { profileDraft } = await import(profileModule);
const { curriculumFromProfile, profileForCurriculum } = await import(dataModule(compile('curriculum').replace("'./professional-profile'", JSON.stringify(profileModule))));
const { buildCvDocument, defaultCvOptions } = await import(dataModule(compile('cv-document')));

test('CV versions share current personal data and retain independent professional content without mutations', () => {
  const shared = { ...profileDraft(), datosPersonales: { nombre: 'Persona', apellido: 'Ejemplo', telefono: '55555555' },
    perfilProfesional: { titulo: 'Original', resumen: 'Resumen original' },
    idiomas: [{ idioma: 'NO_HEREDAR' }], preferenciasPrivacidad: { mostrarTelefono: false } };
  const before = structuredClone(shared);
  const support = { ...curriculumFromProfile(shared), titulo: 'Version interna soporte', tituloProfesional: 'Soporte', habilidades: ['Redes'] };
  const sales = { ...curriculumFromProfile(shared), titulo: 'Version interna ventas', tituloProfesional: 'Ventas', habilidades: ['Comercial'] };
  const a = profileForCurriculum(shared, support);
  const b = profileForCurriculum(shared, sales);
  assert.deepEqual(a.datosPersonales, b.datosPersonales);
  assert.equal(a.perfilProfesional.titulo, 'Soporte');
  assert.equal(b.perfilProfesional.titulo, 'Ventas');
  assert.deepEqual(a.idiomas, []);
  const exported = buildCvDocument(a, defaultCvOptions(a));
  assert.match(JSON.stringify(exported), /Soporte/);
  assert.doesNotMatch(JSON.stringify(exported), /55555555|NO_HEREDAR|Ventas|Version interna/);
  shared.datosPersonales.nombre = 'Nombre actualizado';
  assert.equal(profileForCurriculum(shared, support).datosPersonales.nombre, 'Nombre actualizado');
  a.datosPersonales.nombre = 'Copia modificada';
  assert.equal(shared.datosPersonales.nombre, 'Nombre actualizado');
  assert.deepEqual({ ...shared, datosPersonales: before.datosPersonales }, before);
});

test('internal CV names never become body headings, including existing CVs without a professional title', () => {
  const shared = { ...profileDraft(), datosPersonales: { nombre: 'Sergio', apellido: 'Lamas' },
    perfilProfesional: { titulo: 'Titulo del perfil compartido' } };
  const internal = 'Sergio - Analista de Operaciones y Automatizacion';
  const legacy = { titulo: internal, resumen: 'Experiencia declarada', experiencias: [], educacion: [], habilidades: [] };
  const before = structuredClone(legacy);
  for (const professional of [undefined, '', 'Analista de Operaciones']) {
    const cv = { ...legacy, ...(professional === undefined ? {} : { tituloProfesional: professional }) };
    const profile = profileForCurriculum(shared, cv);
    const document = buildCvDocument(profile, defaultCvOptions(profile));
    assert.equal(document.title, professional ?? '');
    assert.equal(document.name, 'Sergio Lamas');
    assert.doesNotMatch(JSON.stringify(document), /Sergio - Analista|Titulo del perfil compartido/);
  }
  assert.deepEqual(legacy, before);
  const seeded = curriculumFromProfile(shared);
  assert.equal(seeded.tituloProfesional, shared.perfilProfesional.titulo);
  seeded.titulo = 'Otro nombre interno';
  assert.equal(profileForCurriculum(shared, seeded).perfilProfesional.titulo, shared.perfilProfesional.titulo);
});
test('switching designs preserves document content and the shared profile', () => {
  const profile = { ...profileDraft(), datosPersonales: { nombre: 'Persona', apellido: 'Ejemplo' },
    perfilProfesional: { titulo: 'Soporte', resumen: 'Experiencia real' } };
  const before = structuredClone(profile);
  const cv = curriculumFromProfile(profile);
  assert.equal(cv.plantilla, 'ats');
  const documents = ['ats', 'moderna'].map(plantilla => {
    const adapted = profileForCurriculum(profile, { ...cv, plantilla });
    return buildCvDocument(adapted, defaultCvOptions(adapted));
  });
  assert.deepEqual(documents[0], documents[1]);
  assert.deepEqual(profile, before);
});

test('seeding a new CV copies dates, achievements and skills without persisting personal data', () => {
  const profile = { ...profileDraft(), datosPersonales: { nombre: 'NO_COPIAR' },
    perfilProfesional: { titulo: 'Logistica' }, experiencias: [{ empresa: 'Deposito', puesto: 'Inventario',
      fechaInicio: '2025-01-15', actual: true, logros: ['Orden de stock'] }], habilidades: [{ nombre: 'Excel' }] };
  const cv = curriculumFromProfile(profile);
  assert.equal(cv.experiencias[0].fechaInicio, '2025-01-15');
  assert.equal(cv.experiencias[0].actual, true);
  assert.equal(cv.experiencias[0].descripcion, 'Orden de stock');
  assert.deepEqual(cv.habilidades, ['Excel']);
  assert.doesNotMatch(JSON.stringify(cv), /NO_COPIAR/);
  assert.equal(profileForCurriculum(profile, cv).experiencias[0].fechaInicio, '2025-01-15');
});

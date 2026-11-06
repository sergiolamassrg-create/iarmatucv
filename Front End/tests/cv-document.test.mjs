import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

async function model(file) {
  const source = readFileSync(new URL(`../src/app/core/models/${file}.ts`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
const { profileDraft, listSections } = await model('professional-profile');
const { buildCvDocument, defaultCvOptions, cvExportIssues, profileProgress, orderedCvSections, cvHref } = await model('cv-document');

function profile() {
  return { ...profileDraft(), datosPersonales: { nombre: 'Persona', apellido: 'Ejemplo', email: 'persona@example.com',
    telefono: '123456', ubicacion: { ciudad: 'Ciudad', provincia: 'Provincia', pais: 'Argentina' },
    linkedin: 'https://linkedin.com/in/persona', campoOculto: 'NO_EXPORTAR' },
    perfilProfesional: { titulo: 'Desarrollo', resumen: 'Mi experiencia' },
    experiencias: [{ id: 'NO_EXPORTAR_ID', puesto: 'Desarrollo', empresa: 'Empresa', fechaInicio: '2025', fechaFin: null,
      actual: true, responsabilidades: ['Desarrollar'], logros: ['Automatizar'], tecnologias: ['Node.js'], habilidadesIds: ['NO_EXPORTAR_REFERENCIA'] }],
    preferenciasPrivacidad: { mostrarTelefono: false, mostrarUbicacionCompleta: false } };
}

test('export requires names but partial drafts and profiles without experience remain valid', () => {
  const empty = profileDraft();
  assert.equal(cvExportIssues(empty).length, 2);
  empty.datosPersonales = { nombre: ' Persona ', apellido: ' Ejemplo ' };
  assert.deepEqual(cvExportIssues(empty), []);
  const cv = buildCvDocument(empty, defaultCvOptions(empty));
  assert.equal(cv.name, 'Persona Ejemplo');
  assert.deepEqual(cv.sections, []);
  assert.deepEqual(cv.contact, []);
});

test('the CV honors privacy defaults and explicit contact choices', () => {
  const input = profile();
  const options = defaultCvOptions(input);
  const cv = buildCvDocument(input, options);
  assert(cv.contact.includes('persona@example.com'));
  assert(cv.contact.includes('Argentina'));
  assert(!cv.contact.includes('123456'));
  assert(!cv.contact.some(value => value.includes('Provincia')));
  options.phone = true; options.fullLocation = true;
  const explicit = buildCvDocument(input, options);
  assert(explicit.contact.includes('123456'));
  assert(explicit.contact.includes('Ciudad, Provincia, Argentina'));
  options.email = false; options.phone = false; options.location = false; options.links = false;
  assert.deepEqual(buildCvDocument(input, options).contact, []);
});

test('only selected, nonempty sections and known professional fields are exported without mutating the profile', () => {
  const input = profile();
  for (const key of listSections.filter(key => key !== 'experiencias')) input[key] = [{ nombre: 'Dato', idioma: 'Idioma', titulo: 'Titulo', rol: 'Rol' }];
  const snapshot = structuredClone(input);
  const options = defaultCvOptions(input);
  const cv = buildCvDocument(input, options);
  assert.equal(cv.sections.length, 10);
  assert.equal(cv.sections.find(section => section.key === 'experiencias').entries[0].dates, '2025 — Actualidad');
  assert(cv.sections.find(section => section.key === 'experiencias').entries[0].lines.includes('Logro: Automatizar'));
  assert(!JSON.stringify(cv).includes('NO_EXPORTAR'));
  options.sections.experiencias = false; options.sections.resumen = false;
  assert(!buildCvDocument(input, options).sections.some(section => ['resumen', 'experiencias'].includes(section.key)));
  assert.deepEqual(input, snapshot);
});

test('completion derives from meaningful data and ignores empty items or identifiers alone', () => {
  const input = profileDraft();
  assert.equal(profileProgress(input).percent, 0);
  input.experiencias = [{ id: 'only-id', actual: true }];
  assert.equal(profileProgress(input).percent, 0);
  input.datosPersonales = { nombre: 'Persona', apellido: 'Ejemplo' };
  assert.equal(profileProgress(input).completed, 1);
  input.perfilProfesional = { titulo: 'Desarrollo', resumen: 'Experiencia' };
  input.experiencias = [{ puesto: 'Desarrollo' }];
  input.educacion = [{ titulo: 'Estudios' }];
  input.habilidades = [{ nombre: 'Node.js' }];
  input.idiomas = [{ idioma: 'Ingles' }];
  assert.equal(profileProgress(input).percent, 100);
});

test('unsafe links, nulls and empty values do not leak into the CV', () => {
  const input = profile();
  input.datosPersonales.linkedin = 'javascript:alert(1)';
  input.datosPersonales.github = 'https://user:password@example.com';
  input.proyectos = [{ nombre: 'Proyecto', url: 'data:text/html,test' }];
  const cv = buildCvDocument(input, defaultCvOptions(input));
  assert(!JSON.stringify(cv).includes('javascript:'));
  assert(!JSON.stringify(cv).includes('password'));
  assert(!JSON.stringify(cv).includes('data:text'));
});

test('templates and section order stay separate from the saved profile', () => {
  const input = profile();
  input.proyectos = [{ nombre: 'Proyecto' }];
  const snapshot = structuredClone(input);
  const options = defaultCvOptions(input);
  assert.equal(options.template, 'ats');
  options.template = 'moderna';
  options.order = ['proyectos', 'resumen', 'proyectos'];
  const keys = orderedCvSections(options).map(section => section.key);
  assert.equal(keys[0], 'proyectos');
  assert.equal(new Set(keys).size, 10);
  assert.deepEqual(buildCvDocument(input, options).sections.map(section => section.key), ['proyectos', 'resumen', 'experiencias']);
  assert.deepEqual(input, snapshot);
});

test('clickable contacts accept only safe web, email and telephone targets', () => {
  assert.equal(cvHref('https://example.com/perfil'), 'https://example.com/perfil');
  assert.equal(cvHref('persona@example.com'), 'mailto:persona@example.com');
  assert.equal(cvHref('+54 (11) 1234-5678'), 'tel:+541112345678');
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'https://user:password@example.com', 'mailto:persona@example.com', 'Ciudad, Argentina']) assert.equal(cvHref(value), null);
});

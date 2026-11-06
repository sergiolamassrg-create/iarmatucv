import { profileFields, profileLists, profileMaps } from '../models/professional-profile.js';
import type { JsonObject, ProfileInput } from '../models/professional-profile.js';
import { ProfileError } from './profile-error.js';
import * as repository from '../repositories/profile.repository.js';

function invalid(): never {
  throw new ProfileError(400, 'PERFIL_INVALIDO', 'Revisá la estructura y los datos del perfil.');
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateJson(value: unknown, depth = 0): void {
  if (depth > 8) invalid();
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') { if (value.length > 5000) invalid(); return; }
  if (typeof value === 'number') { if (!Number.isFinite(value)) invalid(); return; }
  if (Array.isArray(value)) {
    if (value.length > 100) invalid();
    for (const item of value) validateJson(item, depth + 1);
    return;
  }
  if (!isObject(value) || Object.keys(value).length > 50) invalid();
  for (const [key, item] of Object.entries(value)) {
    if (!key || key.length > 80 || ['__proto__', 'prototype', 'constructor'].includes(key)) invalid();
    validateJson(item, depth + 1);
  }
}

function textFields(value: JsonObject, fields: string[]): void {
  for (const field of fields) {
    const item = value[field];
    if (item !== undefined && item !== null && typeof item !== 'string') invalid();
  }
}

function stringLists(value: JsonObject, fields: string[]): void {
  for (const field of fields) {
    const items = value[field];
    if (items !== undefined && (!Array.isArray(items) || !items.every(item => typeof item === 'string'))) invalid();
  }
}

function webLinks(value: JsonObject, fields: string[]): void {
  for (const field of fields) {
    const item = value[field];
    if (item === undefined || item === null || item === '') continue;
    if (typeof item !== 'string') invalid();
    let url: URL;
    try { url = new URL(item); } catch { invalid(); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) invalid();
  }
}

export function validateProfile(body: unknown): ProfileInput {
  if (!isObject(body) || Object.keys(body).some(key => !profileFields.includes(key as typeof profileFields[number]))) invalid();
  validateJson(body);
  for (const field of profileMaps) if (!isObject(body[field])) invalid();
  for (const field of profileLists) {
    if (!Array.isArray(body[field]) || !body[field].every(isObject)) invalid();
    for (const item of body[field]) {
      textFields(item, ['id', 'nombre', 'empresa', 'puesto', 'institucion', 'titulo', 'nivel', 'estado',
        'categoria', 'idioma', 'tipo', 'rol', 'descripcion', 'url', 'fechaInicio', 'fechaFin']);
      if (item['actual'] !== undefined && typeof item['actual'] !== 'boolean') invalid();
      if (item['ubicacion'] !== undefined && item['ubicacion'] !== null && !isObject(item['ubicacion'])) invalid();
      stringLists(item, ['responsabilidades', 'logros', 'tecnologias', 'habilidadesIds']);
      webLinks(item, ['url']);
    }
  }
  const personal = body['datosPersonales'] as JsonObject;
  textFields(personal, ['nombre', 'apellido', 'nombreProfesional', 'email', 'telefono', 'linkedin', 'github', 'portfolio']);
  webLinks(personal, ['linkedin', 'github', 'portfolio']);
  const location = personal['ubicacion'];
  if (location !== undefined && location !== null) {
    if (!isObject(location)) invalid();
    textFields(location, ['ciudad', 'provincia', 'pais']);
  }
  if (typeof personal['email'] === 'string' && personal['email'] &&
      (personal['email'].length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal['email']))) invalid();
  const professional = body['perfilProfesional'] as JsonObject;
  textFields(professional, ['titulo', 'resumen', 'disponibilidad']);
  stringLists(professional, ['puestosObjetivo', 'modalidadesPreferidas']);
  if (!Object.values(body['preferenciasPrivacidad'] as JsonObject).every(value => typeof value === 'boolean')) invalid();
  const pending = body['camposPendientesDeValidacion'];
  if (pending !== undefined && (!Array.isArray(pending) || !pending.every(item => typeof item === 'string'))) invalid();
  return { ...body, camposPendientesDeValidacion: pending ?? [] } as ProfileInput;
}

export async function getProfile(userId: string) {
  const profile = await repository.getProfile(userId);
  if (!profile) throw new ProfileError(404, 'PERFIL_NO_ENCONTRADO', 'Todavía no creaste tu perfil profesional.');
  return profile;
}

export function saveProfile(userId: string, body: unknown) {
  return repository.saveProfile(userId, validateProfile(body));
}

export const deleteProfile = repository.deleteProfile;

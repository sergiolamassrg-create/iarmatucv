import { MiloError } from '../services/milo-error.js';
import type { CvDraft } from './types.js';

export const fail = (status: number, code: string, message: string): never => { throw new MiloError(status, code, message); };
export function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !keys.includes(key))) {
    return fail(400, 'MILO_ARGUMENTOS_INVALIDOS', 'Los datos enviados no son válidos.');
  }
  return value as Record<string, unknown>;
}
export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) {
    return fail(400, 'MILO_IDENTIFICADOR_INVALIDO', 'El identificador no es válido.');
  }
  return value;
}
export function text(value: unknown, max: number, empty = false): string {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > max) {
    return fail(400, 'MILO_TEXTO_INVALIDO', 'Revisá la longitud y el contenido del texto.');
  }
  return value.trim();
}
export function privateText(value: string): string {
  return value
    .replace(/\b(?:Bearer\s+)?eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gi, '[token omitido]')
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|AIza[\w-]{35}/g, '[clave omitida]')
    .replace(/(?:password|contraseña|secret|api[_ -]?key|session[_ -]?token)\s*[:=]\s*\S+/gi, '[secreto omitido]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[correo omitido]')
    .replace(/https?:\/\/\S+/gi, '[enlace omitido]')
    .replace(/(?<![A-Za-z0-9-])(?:\+?\d[\d ().-]{6,}\d)(?![A-Za-z0-9-])/g, value =>
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value) ? value : '[número omitido]');
}
export function cvDraft(value: unknown): CvDraft {
  const data = object(value, ['titulo', 'tituloProfesional', 'plantilla', 'resumen', 'experiencias', 'educacion', 'habilidades']);
  if (data['plantilla'] !== undefined && !['ats', 'moderna'].includes(data['plantilla'] as string)) {
    return fail(400, 'MILO_PLANTILLA_INVALIDA', 'Elegí ATS Clásica o Profesional Moderna.');
  }
  const string = (value: unknown, max: number, empty = false) => privateText(text(value, max, empty));
  const dates = (entry: Record<string, unknown>) => Object.fromEntries(['fechaInicio', 'fechaFin']
    .filter(key => entry[key] !== undefined).map(key => {
      const value = text(entry[key], 40, true);
      return [key, /^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(value) ? value : privateText(value)];
    }));
  const list = (value: unknown): unknown[] => {
    if (!Array.isArray(value) || value.length > 12) return fail(400, 'MILO_CV_INVALIDO', 'El CV contiene demasiados elementos.');
    return value;
  };
  return {
    titulo: string(data['titulo'], 120),
    ...(data['plantilla'] !== undefined ? { plantilla: data['plantilla'] as 'ats' | 'moderna' } : {}),
    ...(data['tituloProfesional'] !== undefined ? { tituloProfesional: string(data['tituloProfesional'], 120, true) } : {}),
    resumen: string(data['resumen'], 1500, true),
    experiencias: list(data['experiencias']).map(item => {
      const entry = object(item, ['empresa', 'puesto', 'descripcion', 'fechaInicio', 'fechaFin', 'actual']);
      if (entry['actual'] !== undefined && typeof entry['actual'] !== 'boolean') return fail(400, 'MILO_CV_INVALIDO', 'Revisá las fechas de la experiencia.');
      return { empresa: string(entry['empresa'], 120, true), puesto: string(entry['puesto'], 120),
        descripcion: string(entry['descripcion'], 800, true), ...dates(entry),
        ...(entry['actual'] !== undefined ? { actual: entry['actual'] as boolean } : {}) };
    }),
    educacion: list(data['educacion']).map(item => {
      const entry = object(item, ['institucion', 'titulo', 'fechaInicio', 'fechaFin']);
      return { institucion: string(entry['institucion'], 120, true), titulo: string(entry['titulo'], 160), ...dates(entry) };
    }),
    habilidades: list(data['habilidades']).map(item => string(item, 100))
  };
}
// Only professional fields leave the backend. No userId, name, contact or privacy metadata.
export function professionalProfile(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  const profile = value as Record<string, unknown>;
  const map = (value: unknown, fields: string[]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const source = value as Record<string, unknown>;
    return Object.fromEntries(fields.flatMap(key => typeof source[key] === 'string'
      ? [[key, privateText(source[key].slice(0, 1000))]] : []));
  };
  return {
    perfilProfesional: map(profile['perfilProfesional'], ['titulo', 'resumen']),
    ...Object.fromEntries(['experiencias', 'educacion', 'habilidades', 'idiomas', 'proyectos'].map(key => [key,
      Array.isArray(profile[key]) ? profile[key].slice(0, 12).map(item => map(item,
        ['empresa', 'puesto', 'institucion', 'titulo', 'nombre', 'idioma', 'nivel', 'descripcion'])) : []]))
  };
}


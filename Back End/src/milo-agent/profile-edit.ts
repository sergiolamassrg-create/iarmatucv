import { profileFields, type ProfileInput } from '../models/professional-profile.js';
import { validateProfile } from '../services/profile.service.js';
import { fail, object, text } from './validation.js';
import type { ProfileField, ProfileProposal } from './types.js';

export const profileEditableFields = [
  'datosPersonales.nombre', 'datosPersonales.apellido', 'datosPersonales.nombreProfesional',
  'perfilProfesional.titulo', 'perfilProfesional.resumen'
] as const;

export function editableProfile(value: unknown): { data: ProfileInput; updatedAt: string } {
  if (!value || typeof value !== 'object') return fail(409, 'MILO_PERFIL_REQUERIDO', 'Primero creá tu perfil desde Mi perfil.');
  const raw = value as Record<string, unknown>;
  if (typeof raw['updatedAt'] !== 'string' || !raw['updatedAt']) return fail(409, 'MILO_PERFIL_SIN_VERSION', 'Guardá tu perfil desde Mi perfil antes de editarlo con Milo.');
  const data = validateProfile(Object.fromEntries(profileFields.filter(field => raw[field] !== undefined)
    .map(field => [field, structuredClone(raw[field])])));
  return { data, updatedAt: raw['updatedAt'] };
}

export function profileChanges(args: unknown, data: ProfileInput): ProfileProposal['cambios'] {
  const input = object(args, ['cambios']);
  if (!Array.isArray(input['cambios']) || !input['cambios'].length || input['cambios'].length > 5) {
    return fail(400, 'MILO_CAMBIOS_INVALIDOS', 'Indicá entre uno y cinco campos del perfil.');
  }
  const seen = new Set<string>();
  return input['cambios'].map(change => {
    const row = object(change, ['campo', 'valor']);
    const field = row['campo'];
    if (typeof field !== 'string' || !profileEditableFields.includes(field as ProfileField) || seen.has(field)) {
      return fail(400, 'MILO_CAMPO_NO_PERMITIDO', 'Ese campo no se puede editar con Milo.');
    }
    seen.add(field);
    const [section, key] = field.split('.') as ['datosPersonales' | 'perfilProfesional', string];
    const previous = data[section][key];
    return { campo: field as ProfileField, anterior: typeof previous === 'string' ? previous : '',
      valor: text(row['valor'], field.endsWith('.resumen') ? 1500 : 120) };
  });
}

export function applyProfileChanges(data: ProfileInput, changes: ProfileProposal['cambios']): ProfileInput {
  const next = structuredClone(data);
  for (const change of changes) {
    const [section, key] = change.campo.split('.') as ['datosPersonales' | 'perfilProfesional', string];
    next[section][key] = change.valor;
  }
  return validateProfile(next);
}

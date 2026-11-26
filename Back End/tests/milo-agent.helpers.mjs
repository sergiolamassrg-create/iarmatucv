import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {MiloAgent} from '../dist/milo-agent/agent.js';
import {MiloError} from '../dist/services/milo-error.js';
import {profileLists} from '../dist/models/professional-profile.js';
export const config = {
  enabled: true, table: 'test-profiles', model: 'mock-model', apiKey: 'mock-private-key',
  timeoutMs: 200, maxMessageChars: 1500, maxHistory: 4, maxOutputTokens: 700,
  maxTools: 3, maxCvs: 10, userMinute: 30, userDay: 100, globalMinute: 100, globalDay: 500, retentionDays: 30
};
export const draft = () => ({ titulo: 'Desarrollo web', resumen: 'Proyecto académico real',
  experiencias: [{ empresa: 'Ejemplo', puesto: 'Desarrollo', descripcion: 'Trabajo declarado por el usuario' }],
  educacion: [{ institucion: 'Instituto', titulo: 'Software' }], habilidades: ['Angular'] });
export const answer = text => ({ text, calls: [], content: { role: 'model', parts: [{ text }] } });
export const call = (name, args = {}) => ({ text: '', calls: [{ id: 'call-1', name, args }],
  content: { role: 'model', parts: [{ functionCall: { id: 'call-1', name, args } }] } });

export function fixture(overrides = {}) {
  const records = new Map();
  const locks = new Map();
  const counts = new Map();
  const script = [];
  const modelCalls = [];
  const profileCalls = [];
  const profiles = new Map();
  const defaultProfile = subject => ({ userId: subject, schemaVersion: 1, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z',
    datosPersonales: { nombre: 'Persona Privada', email: 'privado@example.com', telefono: '1122334455' },
    perfilProfesional: { titulo: 'Desarrollo', resumen: 'Proyecto real' },
    ...Object.fromEntries(profileLists.map(field => [field, []])), habilidades: [{ nombre: 'Angular' }],
    preferenciasPrivacidad: {}, camposPendientesDeValidacion: [] });
  const settings = { ...config, ...overrides };
  const store = {
    async read(subject) { return structuredClone(records.get(subject) ?? null); },
    async acquire(subject, owner, cfg, consume) {
      if (locks.has(subject)) throw new MiloError(429, 'MILO_LIMITE_O_EN_CURSO', 'En curso');
      const keys = [subject + ':minute', subject + ':day', 'global:minute', 'global:day'];
      const maxima = [cfg.userMinute, cfg.userDay, cfg.globalMinute, cfg.globalDay];
      if (consume && keys.some((key, index) => (counts.get(key) ?? 0) >= maxima[index])) {
        throw new MiloError(429, 'MILO_LIMITE_O_EN_CURSO', 'Límite');
      }
      if (consume) keys.forEach(key => counts.set(key, (counts.get(key) ?? 0) + 1));
      locks.set(subject, owner);
    },
    async save(subject, owner, state) {
      assert.equal(locks.get(subject), owner);
      records.set(subject, structuredClone(state));
      locks.delete(subject);
    },
    async saveProfile(subject, owner, state, profile, expectedUpdatedAt) {
      assert.equal(locks.get(subject), owner);
      const current = profiles.get(subject) ?? defaultProfile(subject);
      if (current.updatedAt !== expectedUpdatedAt) throw new MiloError(409, 'MILO_PERFIL_MODIFICADO', 'Perfil modificado');
      profiles.set(subject, { ...structuredClone(profile), userId: subject, schemaVersion: 1,
        createdAt: current.createdAt, updatedAt: new Date().toISOString() });
      records.set(subject, structuredClone(state)); locks.delete(subject);
    },
    async release(subject, owner) { if (locks.get(subject) === owner) locks.delete(subject); }
  };
  const ports = { store, config: () => settings, model: {
    async step(contents, signal) {
      modelCalls.push(structuredClone(contents));
      const next = script.shift() ?? answer('Podemos trabajar con tu experiencia real.');
      if (typeof next === 'function') return next(contents, signal);
      return next;
    }
  }, profile: async subject => {
    profileCalls.push(subject);
    return structuredClone(profiles.get(subject) ?? defaultProfile(subject));
  } };
  return { agent: new MiloAgent(ports), ports, settings, records, locks, counts, script, modelCalls, profileCalls, profiles };
}
export const send = (agent, subject = 'user-a', mensaje = 'Ayudame con mi CV', requestId = randomUUID()) => agent.message(subject, { mensaje, requestId });
export async function prepare(f, subject = 'user-a', data = draft()) {
  f.script.push(call('prepararCurriculum', data), answer('La propuesta está lista.'));
  return (await send(f.agent, subject)).propuesta;
}
export async function create(f, subject = 'user-a') {
  const proposal = await prepare(f, subject);
  const result = await f.agent.confirm(subject, { propuestaId: proposal.id, confirmar: true });
  return result.curriculums[0].id;
}


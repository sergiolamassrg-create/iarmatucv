import { randomUUID } from 'node:crypto';
import type { Content } from '@google/genai';
import { MiloError } from '../services/milo-error.js';
import { greeting } from './prompts.js';
import { cvDraft, fail, object, privateText, professionalProfile, text, uuid } from './validation.js';
import { stateKey } from './store.js';
import type { AgentConfig, AgentPorts, AgentState, Proposal } from './types.js';
import { applyProfileChanges, editableProfile, profileChanges } from './profile-edit.js';

export class MiloAgent {
  constructor(private readonly ports: AgentPorts) {}

  private config(requireModel = true): AgentConfig {
    const config = this.ports.config();
    if (requireModel && !config.enabled) return fail(503, 'MILO_DESHABILITADO', 'Milo todavía no está habilitado.');
    if (!config.table || requireModel && (!config.model || !config.apiKey)) {
      return fail(503, 'MILO_NO_CONFIGURADO', 'Falta configurar el asistente en el servidor.');
    }
    return config;
  }
  private async load(subject: string, config: AgentConfig): Promise<AgentState> {
    if (!subject || subject.length > 128 || subject === 'DEMO_USER_SUB_REEMPLAZAR') {
      return fail(403, 'MILO_IDENTIDAD_INVALIDA', 'Ingresá con una cuenta válida.');
    }
    const saved = await this.ports.store.read(subject);
    if (saved && saved.userId !== stateKey(subject)) return fail(403, 'MILO_PROPIETARIO_INVALIDO', 'No se permite acceder a esos datos.');
    const now = Date.now();
    const state: AgentState = saved ?? {
      userId: stateKey(subject), conversationId: randomUUID(), messages: [],
      cvs: [], pending: null, completed: [], requests: [], historyExpiresAt: 0
    };
    const cutoff = now - config.retentionDays * 86400000;
    state.messages = state.messages.filter((message, index) => index === 0 || message.at >= cutoff);
    if (state.historyExpiresAt <= now || !state.messages.length) {
      state.conversationId = randomUUID();
      state.messages = [{ role: 'model', text: greeting, at: now }];
      state.pending = null;
      state.profilePending = null;
      state.requests = [];
    }
    if (state.pending && state.pending.expiresAt <= now) state.pending = null;
    if (state.profilePending && state.profilePending.expiresAt <= now) state.profilePending = null;
    state.historyExpiresAt = now + config.retentionDays * 86400000;
    return state;
  }
  private view(state: AgentState) {
    return {
      conversationId: state.conversationId, messages: state.messages, propuesta: state.pending,
      propuestaPerfil: state.profilePending ?? null,
      curriculums: state.cvs.map(cv => ({ id: cv.id, titulo: cv.datos.titulo, plantilla: cv.datos.plantilla ?? 'ats', revision: cv.revision, updatedAt: cv.updatedAt }))
    };
  }
  private async locked<T>(subject: string, consume: boolean, run: (state: AgentState, config: AgentConfig) => Promise<T>, requireModel = true) {
    const config = this.config(requireModel);
    if (!subject || subject.length > 128 || subject === 'DEMO_USER_SUB_REEMPLAZAR') {
      return fail(403, 'MILO_IDENTIDAD_INVALIDA', 'Ingresá con una cuenta válida.');
    }
    const owner = randomUUID();
    await this.ports.store.acquire(subject, owner, config, consume);
    try {
      const state = await this.load(subject, config);
      const result = await run(state, config);
      await this.ports.store.save(subject, owner, state);
      return result;
    } finally { await this.ports.store.release(subject, owner); }
  }
  history(subject: string) { return this.locked(subject, false, async state => this.view(state)); }
  listCvs(subject: string) {
    return this.locked(subject, false, async state => this.view(state).curriculums, false);
  }
  createCv(subject: string, body: unknown) {
    const input = object(body, ['requestId', 'datos']);
    const id = uuid(input['requestId']);
    const datos = cvDraft(input['datos']);
    return this.locked(subject, false, async (state, config) => {
      const existing = state.cvs.find(cv => cv.id === id);
      if (existing) {
        if (JSON.stringify(existing.datos) !== JSON.stringify(datos)) return fail(409, 'CV_SOLICITUD_REUTILIZADA', 'La solicitud ya se usó con otros datos. Recargá tus CV.');
        return existing;
      }
      if (state.cvs.length >= config.maxCvs) return fail(409, 'MILO_MAX_CVS', 'Alcanzaste el máximo de CV guardados.');
      const cv = { id, datos, revision: 1, updatedAt: new Date().toISOString(), lastRequestId: id };
      state.cvs.push(cv);
      return cv;
    }, false);
  }
  updateCv(subject: string, id: unknown, body: unknown) {
    const key = uuid(id);
    const input = object(body, ['requestId', 'revision', 'datos']);
    const requestId = uuid(input['requestId']);
    const revision = input['revision'];
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1) return fail(400, 'CV_REVISION_INVALIDA', 'La revisión del CV no es válida.');
    const datos = cvDraft(input['datos']);
    return this.locked(subject, false, async state => {
      const cv = state.cvs.find(item => item.id === key);
      if (!cv) return fail(404, 'MILO_CV_NO_ENCONTRADO', 'No encontramos ese CV en tu cuenta.');
      if (cv.lastRequestId === requestId) {
        if (JSON.stringify(cv.datos) !== JSON.stringify(datos)) return fail(409, 'CV_SOLICITUD_REUTILIZADA', 'La solicitud ya se usó con otros datos. Recargá el CV.');
        return cv;
      }
      if (cv.revision !== revision) return fail(409, 'CV_MODIFICADO', 'El CV cambió en otra ventana o en Milo. Recargalo antes de guardar.');
      cv.datos = datos; cv.revision++; cv.updatedAt = new Date().toISOString(); cv.lastRequestId = requestId;
      return cv;
    }, false);
  }
  duplicateCv(subject: string, id: unknown, body: unknown) {
    const key = uuid(id);
    const input = object(body, ['requestId']);
    const requestId = uuid(input['requestId']);
    return this.locked(subject, false, async (state, config) => {
      const original = state.cvs.find(cv => cv.id === key);
      if (!original) return fail(404, 'MILO_CV_NO_ENCONTRADO', 'No encontramos ese CV en tu cuenta.');
      if (key === requestId) return fail(400, 'CV_IDENTIFICADOR_INVALIDO', 'La copia necesita un identificador nuevo.');
      const existing = state.cvs.find(cv => cv.id === requestId);
      if (existing) {
        if (existing.duplicatedFrom !== key) return fail(409, 'CV_SOLICITUD_REUTILIZADA', 'La solicitud ya se usó para otro CV. Recargá tus CV.');
        return existing;
      }
      if (state.cvs.length >= config.maxCvs) return fail(409, 'MILO_MAX_CVS', 'Alcanzaste el máximo de CV guardados.');
      const datos = structuredClone(original.datos);
      datos.titulo = datos.titulo.slice(0, 112) + ' (copia)';
      const cv = { id: requestId, datos, revision: 1, updatedAt: new Date().toISOString(), lastRequestId: requestId, duplicatedFrom: key };
      state.cvs.push(cv);
      return cv;
    }, false);
  }
  newConversation(subject: string, body: unknown) {
    object(body, []);
    return this.locked(subject, false, async state => {
      state.conversationId = randomUUID();
      state.messages = [{ role: 'model', text: greeting, at: Date.now() }];
      state.pending = null;
      state.profilePending = null;
      state.requests = [];
      return this.view(state);
    });
  }
  getCv(subject: string, id: unknown) {
    const key = uuid(id);
    return this.locked(subject, false, async state => {
      const cv = state.cvs.find(cv => cv.id === key);
      if (!cv) return fail(404, 'MILO_CV_NO_ENCONTRADO', 'No encontramos ese CV en tu cuenta.');
      return cv;
    }, false);
  }
  private async tool(subject: string, state: AgentState, name: string | undefined, args: unknown, config: AgentConfig) {
    switch (name) {
      case 'obtenerPerfilUsuario': {
        object(args, []);
        try { return professionalProfile(await this.ports.profile(subject)); }
        catch (error) {
          if (error && typeof error === 'object' && 'code' in error && error.code === 'PERFIL_NO_ENCONTRADO') {
            return { disponible: false };
          }
          throw error;
        }
      }
      case 'listarCurriculums':
        object(args, []);
        return state.cvs.map(cv => ({ id: cv.id, titulo: cv.datos.titulo, plantilla: cv.datos.plantilla ?? 'ats', revision: cv.revision }));
      case 'obtenerCurriculum': {
        const input = object(args, ['id']);
        const cv = state.cvs.find(cv => cv.id === uuid(input['id']));
        if (!cv) return fail(404, 'MILO_CV_NO_ENCONTRADO', 'No encontramos ese CV en tu cuenta.');
        return { id: cv.id, revision: cv.revision, datos: cv.datos };
      }
      case 'prepararCurriculum': {
        state.profilePending = null;
        if (state.cvs.length >= config.maxCvs) return fail(409, 'MILO_MAX_CVS', 'Alcanzaste el máximo de CV guardados en Milo.');
        const propuesta: Proposal = { id: randomUUID(), tipo: 'crear', curriculumId: randomUUID(),
          revision: 0, datos: cvDraft(args), anterior: null, expiresAt: Date.now() + 600000 };
        state.pending = propuesta;
        return { estado: 'requiere_confirmacion_humana', propuestaId: propuesta.id };
      }
      case 'prepararEdicionCurriculum': {
        state.profilePending = null;
        const input = object(args, ['id', 'datos']);
        const cv = state.cvs.find(cv => cv.id === uuid(input['id']));
        if (!cv) return fail(404, 'MILO_CV_NO_ENCONTRADO', 'No encontramos ese CV en tu cuenta.');
        state.pending = { id: randomUUID(), tipo: 'editar', curriculumId: cv.id,
          revision: cv.revision, datos: cvDraft(input['datos']), anterior: structuredClone(cv.datos), expiresAt: Date.now() + 600000 };
        return { estado: 'requiere_confirmacion_humana', propuestaId: state.pending.id };
      }
      case 'prepararEdicionPerfil': {
        const profile = editableProfile(await this.ports.profile(subject));
        const cambios = profileChanges(args, profile.data);
        applyProfileChanges(profile.data, cambios);
        state.pending = null;
        state.profilePending = { id: randomUUID(), cambios, expectedUpdatedAt: profile.updatedAt, expiresAt: Date.now() + 600000 };
        return { estado: 'requiere_confirmacion_humana', propuestaId: state.profilePending.id };
      }
      default: return fail(403, 'MILO_HERRAMIENTA_NO_PERMITIDA', 'Milo intentó usar una herramienta no autorizada.');
    }
  }
  message(subject: string, body: unknown, verifiedAdmin = false) {
    const input = object(body, ['mensaje', 'requestId']);
    const requestId = uuid(input['requestId']);
    const message = privateText(text(input['mensaje'], this.config().maxMessageChars));
    return this.locked(subject, !verifiedAdmin, async (state, config) => {
      if (state.requests.includes(requestId)) return this.view(state);
      // The fixed greeting belongs to the UI, not to a model-first chat history.
      const context = state.messages.slice(1).slice(-config.maxHistory).map(turn => ({ ...turn, text: turn.text.slice(0, 2000) }));
      while (context.reduce((size, turn) => size + turn.text.length, 0) > 16000) context.shift();
      while (context[0]?.role === 'model') context.shift();
      const contents: Content[] = [];
      for (const turn of [...context, { role: 'user' as const, text: message }]) {
        const previous = contents.at(-1);
        if (previous?.role === turn.role) previous.parts = [...(previous.parts ?? []), { text: turn.text }];
        else contents.push({ role: turn.role, parts: [{ text: turn.text }] });
      }
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new MiloError(504, 'MILO_TIMEOUT', 'Milo tardó demasiado. Intentá más tarde.')); }, config.timeoutMs);
      });
      const work = async () => {
        let toolCount = 0;
        let proposed = false;
        for (let step = 0; step <= config.maxTools; step++) {
          if (controller.signal.aborted) return fail(504, 'MILO_TIMEOUT', 'Milo tardó demasiado.');
          const answer = await this.ports.model.step(contents, controller.signal);
          if (controller.signal.aborted) return fail(504, 'MILO_TIMEOUT', 'Milo tardó demasiado.');
          if (!answer.calls.length) {
            // A validated proposal already supplies the UI with its content;
            // an empty follow-up must not discard it. Confirmation is still mandatory.
            if (proposed) return 'Preparé una propuesta. Revisá los datos y confirmá con el botón si querés guardarla. En Mis CV podés elegir el diseño ATS Clásica o Profesional Moderna para cada versión.';
            if (!answer.text || answer.text.length > 8000) return fail(502, 'MILO_RESPUESTA_INVALIDA', 'Milo no pudo preparar una respuesta válida.');
            return privateText(answer.text);
          }
          if (toolCount + answer.calls.length > config.maxTools) return fail(429, 'MILO_LIMITE_HERRAMIENTAS', 'La consulta requiere demasiadas herramientas. Probá un pedido más específico.');
          contents.push(answer.content);
          const parts = [];
          for (const call of answer.calls) {
            if (controller.signal.aborted) return fail(504, 'MILO_TIMEOUT', 'Milo tardó demasiado.');
            toolCount++;
            const result = await this.tool(subject, state, call.name, call.args ?? {}, config);
            proposed ||= ['prepararCurriculum', 'prepararEdicionCurriculum', 'prepararEdicionPerfil'].includes(call.name ?? '');
            parts.push({ functionResponse: { name: call.name, ...(call.id ? { id: call.id } : {}), response: { result } } });
          }
          contents.push({ role: 'user', parts });
        }
        return fail(429, 'MILO_LIMITE_HERRAMIENTAS', 'La consulta requiere demasiadas herramientas.');
      };
      try {
        const reply = await Promise.race([work(), deadline]);
        state.messages.push({ role: 'user', text: message, at: Date.now() }, { role: 'model', text: reply, at: Date.now() });
        // Keep the greeting exactly once and a bounded persistent transcript.
        state.messages = [state.messages[0], ...state.messages.slice(1).slice(-40)];
        state.requests = [...state.requests, requestId].slice(-20);
        return this.view(state);
      } catch (error) {
        controller.abort();
        if (error instanceof MiloError) throw error;
        const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
        if (status === 429) return fail(429, 'MILO_CUOTA_PROVEEDOR', 'Gemini alcanzó un límite de cuota. Intentá más tarde.');
        if ([401, 403, 404].includes(status)) return fail(503, 'MILO_PROVEEDOR_CONFIGURACION', 'Revisá el modelo y la configuración privada de Gemini.');
        if ([408, 504].includes(status) || error instanceof Error && /Timeout|Abort/.test(error.name)) {
          return fail(504, 'MILO_TIMEOUT', 'Milo tardó demasiado. Intentá más tarde.');
        }
        return fail(502, 'MILO_PROVEEDOR_NO_DISPONIBLE', 'No pudimos conectar con Milo. Intentá más tarde.');
      } finally { clearTimeout(timer); }
    });
  }
  confirm(subject: string, body: unknown) {
    const input = object(body, ['propuestaId', 'confirmar']);
    const proposalId = uuid(input['propuestaId']);
    if (input['confirmar'] !== true) return fail(400, 'MILO_CONFIRMACION_REQUERIDA', 'Confirmá explícitamente los datos de la propuesta.');
    return this.locked(subject, false, async (state, config) => {
      if (state.completed.includes(proposalId)) return this.view(state);
      const proposal = state.pending;
      if (!proposal || proposal.id !== proposalId || proposal.expiresAt <= Date.now()) {
        return fail(409, 'MILO_PROPUESTA_NO_VIGENTE', 'La propuesta no está vigente. Pedí una nueva.');
      }
      const existing = state.cvs.find(cv => cv.id === proposal.curriculumId);
      if (proposal.tipo === 'crear' && state.cvs.length >= config.maxCvs) return fail(409, 'MILO_MAX_CVS', 'Alcanzaste el máximo de CV guardados.');
      if (proposal.tipo === 'editar' && (!existing || existing.revision !== proposal.revision)) {
        return fail(409, 'MILO_CV_MODIFICADO', 'El CV cambió desde la propuesta. Pedí una nueva.');
      }
      const cv = { id: proposal.curriculumId, revision: proposal.revision + 1,
        datos: proposal.datos, updatedAt: new Date().toISOString() };
      state.cvs = [...state.cvs.filter(item => item.id !== cv.id), cv];
      state.pending = null;
      state.completed = [...state.completed, proposalId].slice(-20);
      state.messages.push({ role: 'model', text: 'Guardé el CV confirmado: ' + cv.datos.titulo + '. En Mis CV → Vista previa / PDF podés elegir ATS Clásica o Profesional Moderna sin duplicar el contenido.', at: Date.now() });
      state.messages = [state.messages[0], ...state.messages.slice(1).slice(-40)];
      return this.view(state);
    });
  }
  async confirmProfile(subject: string, body: unknown) {
    const input = object(body, ['propuestaId', 'confirmar']);
    const proposalId = uuid(input['propuestaId']);
    if (input['confirmar'] !== true) return fail(400, 'MILO_CONFIRMACION_REQUERIDA', 'Revisá y confirmá los cambios del perfil.');
    const config = this.config();
    if (!subject || subject.length > 128 || subject === 'DEMO_USER_SUB_REEMPLAZAR') return fail(403, 'MILO_IDENTIDAD_INVALIDA', 'Ingresá con una cuenta válida.');
    const owner = randomUUID();
    await this.ports.store.acquire(subject, owner, config, false);
    try {
      const state = await this.load(subject, config);
      if (state.completed.includes(proposalId)) return this.view(state);
      const proposal = state.profilePending;
      if (!proposal || proposal.id !== proposalId || proposal.expiresAt <= Date.now()) return fail(409, 'MILO_PROPUESTA_NO_VIGENTE', 'La propuesta no está vigente. Pedí una nueva.');
      const profile = editableProfile(await this.ports.profile(subject));
      if (profile.updatedAt !== proposal.expectedUpdatedAt) return fail(409, 'MILO_PERFIL_MODIFICADO', 'El perfil cambió desde la propuesta. Pedile a Milo una nueva.');
      const next = applyProfileChanges(profile.data, proposal.cambios);
      state.profilePending = null;
      state.completed = [...state.completed, proposalId].slice(-20);
      state.messages.push({ role: 'model', text: 'Guardé los cambios confirmados en tu perfil. El alias de inicio de sesión de tu cuenta se mantiene.', at: Date.now() });
      state.messages = [state.messages[0], ...state.messages.slice(1).slice(-40)];
      // Canonical profile + consumed proposal commit together: retries cannot apply twice.
      await this.ports.store.saveProfile(subject, owner, state, next, proposal.expectedUpdatedAt);
      return this.view(state);
    } finally { await this.ports.store.release(subject, owner); }
  }
  cancel(subject: string, body: unknown) {
    const input = object(body, ['propuestaId']);
    const id = uuid(input['propuestaId']);
    return this.locked(subject, false, async state => {
      if (state.profilePending?.id === id) {
        state.profilePending = null;
        return this.view(state);
      }
      if (!state.pending || state.pending.id !== id) return fail(409, 'MILO_PROPUESTA_NO_VIGENTE', 'La propuesta no está vigente.');
      state.pending = null;
      return this.view(state);
    });
  }
}


import { miloConfig } from '../config/milo.js';
import { geminiGateway, type ChatTurn } from './gemini.service.js';
import { MiloError } from './milo-error.js';

const users = new Map<string, { started: number; count: number; busy: boolean }>();
let globalWindow = { started: 0, count: 0 };

function validate(body: unknown): { message: string; history: ChatTurn[] } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid();
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(key => !['mensaje', 'historial'].includes(key)) ||
      typeof input['mensaje'] !== 'string' || !input['mensaje'].trim() ||
      input['mensaje'].length > miloConfig.maxMessageChars) throw invalid();
  const history = input['historial'] ?? [];
  if (!Array.isArray(history) || history.length > 6) throw invalid();
  for (const turn of history) {
    if (!turn || typeof turn !== 'object' || Array.isArray(turn) ||
        Object.keys(turn).some(key => !['role', 'text'].includes(key)) ||
        !['user', 'model'].includes(turn.role) || typeof turn.text !== 'string' ||
        !turn.text.trim() || turn.text.length > 1000) throw invalid();
  }
  return { message: input['mensaje'].trim(), history: history as ChatTurn[] };
}
function invalid() { return new MiloError(400, 'MILO_MENSAJE_INVALIDO', 'Enviá un mensaje de hasta 1000 caracteres y un historial válido.'); }

export async function chatWithMilo(userId: string, body: unknown) {
  const { message, history } = validate(body);
  if (!miloConfig.enabled) throw new MiloError(503, 'MILO_DESHABILITADO', 'Milo está deshabilitado durante la preparación de las pruebas.');
  // In-memory limits cannot enforce quotas or locks across Lambda instances.
  if (miloConfig.production) throw new MiloError(503, 'MILO_SOLO_DESARROLLO', 'La prueba de Milo está disponible únicamente en desarrollo controlado.');
  if (!miloConfig.apiKey || !miloConfig.model) throw new MiloError(503, 'MILO_NO_CONFIGURADO', 'Falta completar la configuración privada de Milo.');
  const now = Date.now();
  for (const [key, entry] of users) if (!entry.busy && now - entry.started >= 60000) users.delete(key);
  const entry = users.get(userId) ?? { started: now, count: 0, busy: false };
  if (entry.busy) throw new MiloError(429, 'MILO_SOLICITUD_EN_CURSO', 'Esperá a que termine tu consulta anterior.');
  if (now - globalWindow.started >= 60000) globalWindow = { started: now, count: 0 };
  if (entry.count >= miloConfig.requestsPerMinute || globalWindow.count >= miloConfig.globalRequestsPerMinute) {
    throw new MiloError(429, 'MILO_LIMITE_LOCAL', 'Se alcanzó el límite de consultas. Esperá un minuto.');
  }
  entry.count++; entry.busy = true; users.set(userId, entry); globalWindow.count++;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new MiloError(504, 'MILO_TIMEOUT', 'Milo tardó demasiado. Intentá nuevamente más tarde.')); }, miloConfig.timeoutMs);
    });
    const respuesta = await Promise.race([geminiGateway.generate(message, history, controller.signal), deadline]);
    return { respuesta, estado: 'ok' as const };
  } catch (error) {
    if (error instanceof MiloError) throw error;
    if (controller.signal.aborted) throw new MiloError(504, 'MILO_TIMEOUT', 'Milo tardó demasiado. Intentá nuevamente más tarde.');
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
    const name = error instanceof Error ? error.name : '';
    if (status === 408 || status === 504 || ['TimeoutError', 'AbortError', 'RequestTimeoutError'].includes(name)) {
      throw new MiloError(504, 'MILO_TIMEOUT', 'Milo tardó demasiado. Intentá nuevamente más tarde.');
    }
    if (status === 429) throw new MiloError(429, 'MILO_CUOTA_AGOTADA', 'Gemini informó un límite de cuota. No se reintentó automáticamente.');
    if (status === 401 || status === 403 || status === 404) throw new MiloError(503, 'MILO_PROVEEDOR_CONFIGURACION', 'Revisá la configuración y los permisos del servicio de IA.');
    throw new MiloError(502, 'MILO_PROVEEDOR_NO_DISPONIBLE', 'No pudimos obtener una respuesta de Milo. Intentá más tarde.');
  } finally {
    clearTimeout(timer);
    entry.busy = false;
  }
}

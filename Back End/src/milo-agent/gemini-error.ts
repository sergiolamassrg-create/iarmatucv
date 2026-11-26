import { MiloError } from '../services/milo-error.js';

export function geminiFailure(error: unknown, model: string): MiloError {
  // Never print the SDK exception: it may embed a key, URL or submitted content.
  const source = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const raw = typeof source['message'] === 'string' ? source['message'].slice(0, 32000) : '';
  let payload: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'error' in parsed && parsed.error && typeof parsed.error === 'object') {
      payload = parsed.error as Record<string, unknown>;
    }
  } catch { /* Some SDK errors contain plain text, not JSON. */ }
  const candidate = Number(source['status'] ?? payload['code']);
  const status = Number.isInteger(candidate) && candidate >= 100 && candidate <= 599 ? candidate : null;
  const providerStatuses = ['UNAUTHENTICATED', 'PERMISSION_DENIED', 'NOT_FOUND', 'INVALID_ARGUMENT',
    'RESOURCE_EXHAUSTED', 'FAILED_PRECONDITION', 'UNAVAILABLE', 'INTERNAL'];
  const providerStatus = providerStatuses.includes(String(payload['status'])) ? String(payload['status']) : null;
  // Only these fixed categories leave the classifier; no arbitrary provider text.
  let reason = 'UNCLASSIFIED';
  let result = new MiloError(502, 'MILO_PROVEEDOR_NO_DISPONIBLE', 'No pudimos conectar con Gemini. Intentá más tarde.');
  if (/API[_ ]?KEY[_ ]?INVALID|API key not valid|invalid API key/i.test(raw)) {
    reason = 'API_KEY_INVALID';
    result = new MiloError(503, 'MILO_GEMINI_CLAVE_INVALIDA', 'Google rechazó la clave de Gemini. Revisá GEMINI_API_KEY en el backend.');
  } else if (/API[_ ]?KEY[_ ]?(?:LEAKED|BLOCKED)|API key.{0,80}(?:leaked|blocked)|leaked.{0,40}API key/i.test(raw)) {
    reason = 'API_KEY_BLOCKED';
    result = new MiloError(503, 'MILO_GEMINI_CLAVE_BLOQUEADA', 'Google bloqueó la clave de Gemini por una posible filtración. Reemplazala por una clave nueva y reiniciá el backend.');
  } else if (/SERVICE_DISABLED|API.{0,80}has not been used|API.{0,80}is disabled/i.test(raw)) {
    reason = 'SERVICE_DISABLED';
    result = new MiloError(503, 'MILO_GEMINI_API_DESHABILITADA', 'La API de Gemini está deshabilitada en el proyecto de Google asociado a la clave.');
  } else if (/location is not supported|country.{0,30}not supported/i.test(raw)) {
    reason = 'REGION_UNSUPPORTED';
    result = new MiloError(503, 'MILO_GEMINI_REGION', 'Google no permite usar Gemini desde la ubicación de este backend.');
  } else if (status === 401) {
    reason = 'UNAUTHENTICATED';
    result = new MiloError(503, 'MILO_GEMINI_AUTENTICACION', 'Google rechazó la autenticación de Gemini (HTTP 401). Revisá la clave configurada en el backend.');
  } else if (status === 403) {
    reason = 'PERMISSION_DENIED';
    result = new MiloError(503, 'MILO_GEMINI_PERMISOS', 'Google rechazó el acceso a Gemini (HTTP 403). Revisá los permisos y restricciones de la clave y del proyecto en Google AI Studio.');
  } else if (status === 404) {
    reason = 'MODEL_NOT_FOUND';
    result = new MiloError(503, 'MILO_GEMINI_MODELO_NO_DISPONIBLE', 'Google no encuentra el modelo para generar respuestas (HTTP 404). Revisá GEMINI_MODEL en el backend.');
  } else if (status === 429) {
    reason = 'QUOTA_EXHAUSTED';
    result = new MiloError(429, 'MILO_CUOTA_PROVEEDOR', 'Gemini alcanzó un límite de cuota. Intentá más tarde.');
  } else if (status === 400) {
    reason = 'INVALID_ARGUMENT';
    result = new MiloError(502, 'MILO_GEMINI_SOLICITUD_INVALIDA', 'Google rechazó el formato de la solicitud a Gemini (HTTP 400). Revisá la integración del backend.');
  } else if ([408, 504].includes(status ?? 0) || error instanceof Error && /Timeout|Abort/.test(error.name)) {
    reason = 'TIMEOUT';
    result = new MiloError(504, 'MILO_TIMEOUT', 'Milo tardó demasiado. Intentá más tarde.');
  }
  console.error(JSON.stringify({
    event: 'MILO_GEMINI_REQUEST_FAILED', operation: 'generateContent', httpStatusCode: status,
    providerStatus, reason,
    model: /^(?:models\/)?gemini-[a-z0-9._-]{1,80}$/.test(model) ? model : null
  }));
  return result;
}


import { environment } from './environment.js';

function integer(name: string, fallback: number, maximum: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`${name} fuera de rango.`);
  return value;
}

export const miloConfig = {
  enabled: process.env['MILO_ENABLED'] === 'true',
  production: environment.production,
  apiKey: process.env['GEMINI_API_KEY']?.trim() ?? '',
  model: process.env['GEMINI_MODEL']?.trim() ?? '',
  maxMessageChars: integer('MILO_MAX_MESSAGE_CHARS', 1000, 1000),
  timeoutMs: integer('MILO_TIMEOUT_MS', 15000, 20000),
  maxOutputTokens: integer('MILO_MAX_OUTPUT_TOKENS', 512, 1024),
  requestsPerMinute: integer('MILO_REQUESTS_PER_MINUTE', 3, 20),
  globalRequestsPerMinute: integer('MILO_GLOBAL_REQUESTS_PER_MINUTE', 10, 100)
};

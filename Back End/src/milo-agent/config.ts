import { environment } from '../config/environment.js';
import { MiloError } from '../services/milo-error.js';
import type { AgentConfig } from './types.js';

export function agentConfig(): AgentConfig {
  // Validate only when Milo is used: optional AI settings must never break /health.
  const integer = (key: string, fallback: number, max: number) => {
    const value = Number(process.env[key] ?? fallback);
    if (!Number.isInteger(value) || value < 1 || value > max) {
      throw new MiloError(503, 'MILO_CONFIGURACION', 'Revisá la configuración del asistente.');
    }
    return value;
  };
  return {
    enabled: process.env['MILO_AGENT_ENABLED'] === 'true',
    table: process.env['MILO_TABLE_NAME']?.trim() || environment.dynamodb.perfilesTable,
    apiKey: process.env['GEMINI_API_KEY']?.trim() || '',
    model: process.env['GEMINI_MODEL']?.trim() || '',
    timeoutMs: integer('MILO_AGENT_TIMEOUT_MS', 15000, 20000),
    maxMessageChars: integer('MILO_AGENT_MAX_MESSAGE_CHARS', 1500, 3000),
    maxHistory: integer('MILO_AGENT_CONTEXT_MESSAGES', 10, 20),
    maxOutputTokens: integer('MILO_AGENT_MAX_OUTPUT_TOKENS', 4096, 8192),
    maxTools: integer('MILO_AGENT_MAX_TOOL_CALLS', 3, 5),
    maxCvs: integer('MILO_AGENT_MAX_CVS', 10, 15),
    userMinute: integer('MILO_AGENT_USER_PER_MINUTE', 3, 30),
    userDay: integer('MILO_AGENT_USER_PER_DAY', 30, 500),
    globalMinute: integer('MILO_AGENT_GLOBAL_PER_MINUTE', 10, 100),
    globalDay: integer('MILO_AGENT_GLOBAL_PER_DAY', 100, 5000),
    retentionDays: integer('MILO_AGENT_RETENTION_DAYS', 30, 90)
  };
}


import { GoogleGenAI, type Content } from '@google/genai';
import { agentConfig } from './config.js';
import { instruction, tools } from './prompts.js';
import type { AgentConfig, AgentModel } from './types.js';
import { geminiFailure } from './gemini-error.js';
import { MiloError } from '../services/milo-error.js';
export function createAgentModel(
  makeClient: (config: AgentConfig) => Pick<GoogleGenAI, 'models'> = config => new GoogleGenAI({
    apiKey: config.apiKey, httpOptions: { timeout: config.timeoutMs, retryOptions: { attempts: 1 } }
  }),
  getConfig = agentConfig
): AgentModel {
  return {
  async step(contents: Content[], signal: AbortSignal) {
    const config = getConfig();
    try {
    const ai = makeClient(config);
    const response = await ai.models.generateContent({
      model: config.model, contents,
      config: { systemInstruction: instruction, tools: [{ functionDeclarations: tools }],
        maxOutputTokens: config.maxOutputTokens, abortSignal: signal, automaticContinuation: false }
    });
    const candidate = response.candidates?.[0];
    const reason = candidate?.finishReason;
    // Fail closed before executing even a partial function call. Never log the
    // provider content, finishMessage or promptFeedback: they may contain PII.
    const knownReasons = ['MAX_TOKENS', 'MALFORMED_FUNCTION_CALL', 'SAFETY', 'RECITATION',
      'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'UNEXPECTED_TOOL_CALL', 'OTHER'];
    const blocked = !!response.promptFeedback?.blockReason;
    const tokenCount = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
    const report = (reason: string) => {
      console.error(JSON.stringify({ event: 'MILO_GEMINI_RESPONSE_REJECTED', operation: 'generateContent',
        reason,
        maxOutputTokens: config.maxOutputTokens,
        outputTokens: tokenCount(response.usageMetadata?.candidatesTokenCount),
        thoughtTokens: tokenCount(response.usageMetadata?.thoughtsTokenCount) }));
    };
    if (blocked || reason && reason !== 'STOP' && reason !== 'FINISH_REASON_UNSPECIFIED') {
      report(blocked ? 'PROMPT_BLOCKED' : knownReasons.includes(reason ?? '') ? reason! : 'UNKNOWN');
      if (reason === 'MAX_TOKENS' && !blocked) {
        throw new MiloError(502, 'MILO_RESPUESTA_TRUNCADA', 'Gemini agotó el espacio para completar la respuesta. Tu CV guardado no cambió. Revisá MILO_AGENT_MAX_OUTPUT_TOKENS en el backend.');
      }
      throw new MiloError(502, 'MILO_RESPUESTA_RECHAZADA', 'Gemini no pudo completar una respuesta válida. Tu CV guardado no cambió. Intentá nuevamente.');
    }
    const calls = response.functionCalls ?? [];
    const content = response.candidates?.[0]?.content;
    const text = calls.length ? '' : response.text?.trim() ?? '';
    if (!calls.length && !text) report('EMPTY_RESPONSE');
    return { content: content ?? { role: 'model', parts: [] }, text, calls };
    } catch (error) {
      if (error instanceof MiloError) throw error;
      throw geminiFailure(error, config.model);
    }
  }
  };
}
export const agentModel = createAgentModel();


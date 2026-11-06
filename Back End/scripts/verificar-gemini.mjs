// Read only model metadata: no generation, messages, profiles or secret output.
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

if (!process.env.GEMINI_API_KEY?.trim()) {
  console.error('Falta GEMINI_API_KEY en el entorno privado del backend.');
  process.exitCode = 1;
} else {
  try {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { timeout: 10000, retryOptions: { attempts: 1 } } });
    const models = await client.models.list({ config: { pageSize: 100, abortSignal: AbortSignal.timeout(15000) } });
    const available = [];
    for await (const model of models) {
      if (model.supportedActions?.includes('generateContent')) available.push(model.name);
    }
    console.log('HTTPS y acceso a catálogo verificados. Modelos con generateContent:');
    for (const name of available) console.log(name);
    if (process.env.GEMINI_MODEL?.trim()) {
      const configured = process.env.GEMINI_MODEL.trim().replace(/^models\//, '');
      const found = available.some(name => name?.replace(/^models\//, '') === configured);
      console.log(found ? 'GEMINI_MODEL aparece en el catálogo.' : 'GEMINI_MODEL no aparece en el catálogo. No habilitar Milo.');
      if (!found) process.exitCode = 1;
    }
    console.log('Esto no confirma cuota ni presupuesto de generación; revisarlos en Google AI Studio.');
  } catch {
    console.error('No se pudo verificar Gemini. Revisar conectividad HTTPS, credenciales y permisos. No se imprimieron detalles privados.');
    process.exitCode = 1;
  }
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

test('bundle de producción no expone SDK Gemini, configuración privada ni claves con formato Google', async () => {
  const root = new URL('../dist/iarmatucv/browser/', import.meta.url);
  const entries = await readdir(root, { recursive: true });
  const scripts = entries.filter(name => name.endsWith('.js'));
  assert.ok(scripts.length > 0, 'Compilar producción antes de ejecutar esta prueba');
  for (const name of scripts) {
    const source = await readFile(new URL(name.replaceAll('\\', '/'), root), 'utf8');
    for (const pattern of [/@google\/genai/, /GEMINI_API_KEY/, /COGNITO_CLIENT_SECRET/, /SESSION_SECRET/, /AIza[\w-]{35}/]) {
      assert.equal(pattern.test(source), false, `Patrón privado detectado en bundle: ${name}`);
    }
  }
});

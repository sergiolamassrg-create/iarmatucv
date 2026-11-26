// Production Angular + real Express/JWT validation, with Cognito/DynamoDB doubles.
// No AWS calls or user credentials. Requires Chrome and a prior frontend/backend build.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { mountBrowserApiProxy } from './browser-proxy.helpers.mjs';
Object.assign(process.env, { AWS_REGION: 'us-east-1', DYNAMODB_PERFILES_TABLE: 'test-profiles' });
const { createApp, cognitoClient, credentials, token, verify, state } = await import('./helpers.mjs');
const { environment } = await import('../dist/config/environment.js');
const { profileClient } = await import('../dist/repositories/profile.repository.js');
const saved = {
  userId: 'user-a', schemaVersion: 1, createdAt: '2026-11-17T00:00:00Z', updatedAt: '2026-11-17T00:00:00Z',
  datosPersonales: { nombre: 'Persona', apellido: 'Browser', email: 'test@example.com' },
  perfilProfesional: { titulo: 'Desarrollo', resumen: 'Perfil de prueba local' },
  experiencias: [], educacion: [], habilidades: [], idiomas: [], certificaciones: [],
  proyectos: [], licencias: [], voluntariados: [], reconocimientos: [],
  preferenciasPrivacidad: {}, camposPendientesDeValidacion: []
};
profileClient.send = async command => {
  assert.equal(command.input.Key.userId, 'user-a');
  assert.equal(command.constructor.name, 'GetCommand');
  return { Item: structuredClone(agentFixture.profiles.get('user-a') ?? saved) };
};
const originalSend = cognitoClient.send;
cognitoClient.send = async command => {
  if (command.constructor.name === 'InitiateAuthCommand' && command.input.AuthParameters.PASSWORD !== credentials.password) {
    throw Object.assign(new Error('Wrong password'), { name: 'NotAuthorizedException' });
  }
  return originalSend(command);
};
const listen = app => new Promise(resolve => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});
const {fixture, draft, call, answer} = await import('./milo-agent.helpers.mjs');
const {miloAgent} = await import('../dist/milo-agent/router.js');
const agentFixture = fixture({timeoutMs:1500});
agentFixture.profiles.set('user-a', structuredClone(saved));
miloAgent.ports = agentFixture.ports;
const backend = await listen(createApp({ mode: 'jwt', verifyAccessToken: verify }));
const traffic = [];
const web = express();
mountBrowserApiProxy(web, { api: () => api, site: () => site, mode: () => mode, traffic, token });
const output = fileURLToPath(new URL('../../Front End/dist/iarmatucv/browser/', import.meta.url));
web.use(express.static(output));
web.use((_req, res) => res.sendFile(output + '/index.html'));
const frontend = await listen(web);
const site = 'http://127.0.0.1:' + frontend.address().port;
environment.frontendOrigins.push(site);
const api = 'http://127.0.0.1:' + backend.address().port;
await mkdir(new URL('../../.verificacion-browser/', import.meta.url), { recursive: true });
const profileDir = await mkdtemp(fileURLToPath(new URL('../../.verificacion-browser/auth-', import.meta.url)));
const browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
  '--user-data-dir=' + profileDir, '--disable-background-networking', 'about:blank'
], { windowsHide: true, stdio: 'ignore' });
let socket;
let mode = 'normal';
let id = 0;
const pending = new Map();
const failures = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await pause(80);
  }
  throw new Error('Timed out: ' + label);
}
function send(method, params = {}) {
  const messageId = ++id;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(messageId); reject(new Error('CDP timeout: ' + method)); }, 15000);
    pending.set(messageId, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitJs(expression) { await until(() => evaluate(expression), expression); }
async function click(selector) { await evaluate('document.querySelector(' + JSON.stringify(selector) + ').click()'); }
async function navigate(path) {
  await send('Page.navigate', { url: site + path });
}
async function login(password = credentials.password) {
  await waitJs('!!document.querySelector("#access-email")');
  await evaluate(`for (const [selector, value] of ${JSON.stringify([['#access-email', credentials.email], ['#access-password', password]])}) {
    const input = document.querySelector(selector); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
  }`);
  await pause(50);
  await click('.access-form button[type="submit"]');
}

try {
  let port;
  await until(async () => {
    try { port = Number((await readFile(profileDir + '/DevToolsActivePort', 'utf8')).split('\n')[0]); return !!port; }
    catch { return false; }
  }, 'Chrome startup');
  const tabs = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = message => {
    const data = JSON.parse(message.data);
    if (data.id) {
      const entry = pending.get(data.id);
      if (!entry) return;
      clearTimeout(entry.timer); pending.delete(data.id);
      if (data.error) entry.reject(new Error(JSON.stringify(data.error)));
      else entry.resolve(data.result);
    }
  };
  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setCookieControls', { enableThirdPartyCookieRestriction: true, disableThirdPartyCookieMetadata: true, disableThirdPartyCookieHeuristics: true });


  const wait = waitJs;
  await navigate('/acceso');
  await wait('!!document.querySelector("#access-email")');
  assert.equal(await evaluate('!!document.querySelector(".milo-launcher")'), false);
  await login();
  await wait('!!document.querySelector(".milo-launcher")');
  await click('.milo-launcher');
  await wait('document.querySelectorAll(".milo-messages article").length === 1');
  await wait('document.querySelector(".milo-window header img").naturalWidth > 0');
  console.log('PASS authenticated widget, original avatar, one initial greeting');

  agentFixture.script.push(call('prepararCurriculum', {...draft(), plantilla: 'moderna'}), answer('Revis? la propuesta.'));
  await click('.milo-quick button');
  await wait('!!document.querySelector(".milo-approval")');
  assert.equal(agentFixture.records.get('user-a').cvs.length, 0);
  assert.equal(await evaluate('document.querySelector(".milo-proposal button.primary").disabled'), true);
  await click('.milo-approval input');
  await click('.milo-proposal button.primary');
  await wait('!document.querySelector(".milo-approval") && document.querySelector(".milo-messages").innerText.includes("el CV confirmado")');
  assert.equal(agentFixture.records.get('user-a').cvs.length, 1);
  const cvId=agentFixture.records.get('user-a').cvs[0].id;
  console.log('PASS review, explicit confirmation and actual backend CV creation');

  const messageCount = await evaluate('document.querySelectorAll(".milo-messages article").length');
  const requestCount = traffic.length;
  await evaluate('document.querySelector("#milo-input").value="Borrador sin enviar"; document.querySelector("#milo-input").dispatchEvent(new Event("input",{bubbles:true}))');
  const compactWidth = await evaluate('document.querySelector(".milo-window").getBoundingClientRect().width');
  await click('.milo-resize');
  await wait('document.querySelector(".milo-window").classList.contains("milo-expanded")');
  assert(await evaluate('document.querySelector(".milo-window").getBoundingClientRect().width') > compactWidth);
  assert.equal(await evaluate('document.querySelector(".milo-resize").getAttribute("aria-pressed")'), 'true');
  assert.equal(await evaluate('document.querySelector("#milo-input").value'), 'Borrador sin enviar');
  assert.equal(await evaluate('document.querySelectorAll(".milo-messages article").length'), messageCount);
  assert.equal(traffic.length, requestCount);
  await evaluate('document.querySelector(".milo-window").dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))');
  await wait('!!document.querySelector(".milo-window") && !document.querySelector(".milo-window").classList.contains("milo-expanded")');
  for (const dark of [false, true]) {
    await evaluate('document.documentElement.classList.toggle("dark-mode", ' + dark + ')');
    const contrast = await evaluate(`(() => {
      const luminance = color => {
        const channels = color.match(/[\\d.]+/g).slice(0,3).map(Number).map(v => {
          v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
        });
        return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
      };
      return [...document.querySelectorAll('.milo-messages article')].map(article => {
        const text = luminance(getComputedStyle(article.querySelector('p')).color);
        const bg = luminance(getComputedStyle(article).backgroundColor);
        return (Math.max(text,bg)+.05)/(Math.min(text,bg)+.05);
      });
    })()`);
    assert(contrast.every(ratio => ratio >= 4.5), 'Messages must remain readable in both themes');
  }
  await evaluate('document.documentElement.classList.remove("dark-mode")');
  console.log('PASS expanded/compact mode preserves draft and messages without requests; text contrast passes in light/dark themes');

  await send('Page.reload');
  await wait('location.pathname === "/panel" && !!document.querySelector(".milo-launcher")');
  await wait('!!document.querySelector(".milo-launcher")');
  await click('.milo-launcher');
  await wait('document.querySelector(".milo-messages")?.innerText.includes("el CV confirmado")');
  assert.equal(await evaluate('[...document.querySelectorAll(".milo-messages article p")].filter(p => p.innerText.includes("Soy Milo")).length'), 1);
  console.log('PASS reload restores session and conversation without login or duplicate greeting');

  await click('.milo-toolbar button');
  await wait('document.querySelectorAll(".milo-messages article").length === 1');
  await evaluate('document.querySelectorAll(".milo-toolbar button")[1].click()');
  await wait('document.querySelector(".milo-proposal")?.innerText.includes("Desarrollo web")');
  await wait(`!document.querySelector('[aria-label="Tus CV guardados en Milo"] button').disabled`);
  await click('[aria-label="Tus CV guardados en Milo"] button');
  await wait('!!document.querySelector(".milo-proposal app-milo-cv")');
  const changed={...draft(),plantilla:'moderna',resumen:'Resumen aprobado desde Chrome'};
  agentFixture.script.push(call('prepararEdicionCurriculum',{id:cvId,datos:changed}),answer('Revis? la edici?n.'));
  await evaluate('document.querySelectorAll(".milo-proposal button")[1].click()');
  await wait('!!document.querySelector(".milo-approval")');
  assert.equal(agentFixture.records.get('user-a').cvs[0].revision,1);
  await click('.milo-approval input');
  await click('.milo-proposal button.primary');
  await wait('!document.querySelector(".milo-approval")');
  assert.equal(agentFixture.records.get('user-a').cvs[0].revision,2);
  console.log('PASS new conversation preserves CV, library preview and confirmed edit');

  // Real widget -> API -> canonical profile -> dashboard cache refresh.
  agentFixture.script.push(call('prepararEdicionPerfil', { cambios: [
    { campo: 'datosPersonales.nombre', valor: 'Sergio' },
    { campo: 'perfilProfesional.titulo', valor: 'Soporte tecnico' }
  ] }), answer('Revisa tu perfil.'));
  await evaluate('document.querySelector("#milo-input").value="Mi nombre es Sergio. Cambia mi nombre y titulo a Soporte tecnico"; document.querySelector("#milo-input").dispatchEvent(new Event("input",{bubbles:true}))');
  await click('.milo-window form button[type="submit"]');
  await wait('!!document.querySelector("#milo-profile-title")');
  assert.equal(agentFixture.profiles.get('user-a').datosPersonales.nombre, 'Persona');
  assert.equal(await evaluate('document.querySelector("#milo-profile-title").parentElement.querySelector("button.primary").disabled'), true);
  await click('#milo-profile-title + p + h4 ~ label input');
  await click('#milo-profile-title ~ button.primary');
  await wait('!document.querySelector("#milo-profile-title") && document.querySelector(".dashboard-account strong")?.innerText === "Sergio"');
  assert.equal(agentFixture.profiles.get('user-a').datosPersonales.nombre, 'Sergio');
  assert.equal(agentFixture.profiles.get('user-a').datosPersonales.email, 'test@example.com');
  assert.equal(agentFixture.profiles.has('user-b'), false);
  console.log('PASS own profile proposal, explicit confirmation, preserved contact and immediate dashboard name refresh');

  // Shared library includes Milo CV; manual duplicate/edit/export stays independent.
  await click('.milo-window header button[aria-label="Minimizar conversacion"]'.replace('conversacion', 'conversaci\u00f3n'));
  await click('.dashboard-nav a[href="/panel/curriculums"]');
  await wait('document.querySelectorAll(".curriculum-card").length === 1');
  await click('.curriculum-card button');
  await wait('!!document.querySelector("#curriculum-title") && location.pathname.startsWith("/panel/curriculums/")');
  const copyId = await evaluate('location.pathname.split("/").at(-1)');
  assert.notEqual(copyId, cvId);
  await evaluate('document.querySelectorAll(".curriculum-tabs button")[1].click()');
  await wait('!!document.querySelector(".curriculum-preview app-profile-cv")');
  assert.equal(await evaluate('document.querySelector("#curriculum-template").value'), 'moderna');
  assert.equal(await evaluate('!!document.querySelector(".curriculum-preview .cv-modern")'), true);
  await evaluate('(() => { const select=document.querySelector("#curriculum-template"); select.value="ats"; select.dispatchEvent(new Event("change",{bubbles:true})); })()');
  assert.equal(await evaluate('document.querySelector(".curriculum-preview").innerText.includes("Desarrollo web")'), false);
  await evaluate('document.querySelectorAll(".curriculum-tabs button")[0].click()');
  await evaluate('for (const [selector,value] of [["#curriculum-title","Logistica"],["#curriculum-professional-title","Analista de Operaciones"],["#curriculum-summary","Control de inventario"]]) {const input=document.querySelector(selector); input.value=value; input.dispatchEvent(new Event("input",{bubbles:true}));}');
  await click('.curriculum-form button[type="submit"]');
  await wait('document.querySelector(".curriculum-heading h1")?.innerText === "Logistica" && !document.querySelector(".curriculum-form fieldset").disabled');
  assert.equal(agentFixture.records.get('user-a').cvs.length, 2);
  assert.equal(agentFixture.records.get('user-a').cvs.find(cv => cv.id === cvId).datos.titulo, 'Desarrollo web');
  assert.equal(agentFixture.records.get('user-a').cvs.find(cv => cv.id === copyId).datos.titulo, 'Logistica');
  await evaluate('document.querySelectorAll(".curriculum-tabs button")[1].click()');
  await wait('!!document.querySelector(".curriculum-preview app-profile-cv")');
  const previewText = await evaluate('document.querySelector(".curriculum-preview").innerText');
  assert(previewText.includes('Sergio')); assert(previewText.includes('Analista de Operaciones'));
  assert(!previewText.includes('Desarrollo web')); assert(!previewText.includes('Logistica'));
  assert.equal(await evaluate('document.querySelector(".curriculum-preview .cv-paper").dataset.template'), 'ats');
  await evaluate('window.__printed=false;window.print=()=>{window.__printed=document.body.classList.contains("curriculum-printing")}');
  await click('.curriculum-export > button');
  await wait('window.__printed === true');
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".curriculum-heading")).display'), 'none');
  const pdf = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
  assert(Buffer.from(pdf.data, 'base64').subarray(0, 4).toString() === '%PDF');
  await send('Emulation.setEmulatedMedia', { media: '' });
  await evaluate('window.dispatchEvent(new Event("afterprint"))');
  assert.equal(await evaluate('document.body.classList.contains("curriculum-printing")'), false);
  await evaluate('(() => { const select=document.querySelector("#curriculum-template"); select.value="moderna"; select.dispatchEvent(new Event("change",{bubbles:true})); })()');
  await wait('document.querySelectorAll(".curriculum-export > button").length === 2');
  assert.equal(await evaluate('document.querySelectorAll(".curriculum-export > button")[1].disabled'), true);
  await click('.curriculum-export > button');
  await wait('document.querySelectorAll(".curriculum-export > button").length === 1 && !document.querySelector(".curriculum-export > button").disabled');
  assert.equal(agentFixture.records.get('user-a').cvs.find(cv => cv.id === copyId).datos.plantilla, 'moderna');
  assert.equal(agentFixture.records.get('user-a').cvs.length, 2);
  await click('.curriculum-heading a');
  await wait('document.querySelectorAll(".curriculum-card").length === 2');
  await click('.curriculum-card a[href="/panel/curriculums/' + copyId + '"]');
  await wait('!!document.querySelector("#curriculum-title") && !document.querySelector(".curriculum-form fieldset").disabled');
  await evaluate('document.querySelectorAll(".curriculum-tabs button")[1].click()');
  await wait('document.querySelector(".curriculum-preview .cv-paper")?.dataset.template === "moderna"');
  assert.equal(await evaluate('document.querySelector("#curriculum-template").value'), 'moderna');
  assert.equal(agentFixture.records.get('user-a').cvs.find(cv => cv.id === cvId).datos.titulo, 'Desarrollo web');
  await click('.curriculum-export > button');
  await wait('document.body.classList.contains("curriculum-printing")');
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  const modernPdf = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
  assert.equal(Buffer.from(modernPdf.data, 'base64').subarray(0, 4).toString(), '%PDF');
  await send('Emulation.setEmulatedMedia', { media: '' });
  await evaluate('window.dispatchEvent(new Event("afterprint"))');
  console.log('PASS Milo design choice, saved template restored on reopening, same CV switches designs and renders both PDFs');
  await click('.curriculum-heading a');
  await wait('document.querySelectorAll(".curriculum-card").length === 2');
  console.log('PASS shared CV library, duplicate/edit isolation, current common personal data and real PDF rendering');
  console.log('PASS legacy/internal CV names omitted from preview; only the separately saved professional heading appears');
  await click('.curriculums-heading a');
  await wait('!!document.querySelector("#curriculum-title") && location.pathname.endsWith("/nuevo")');
  await evaluate('const input=document.querySelector("#curriculum-title"); input.value="Soporte"; input.dispatchEvent(new Event("input",{bubbles:true})); window.__confirm=window.confirm; window.confirm=()=>false;');
  await click('.curriculum-heading a');
  assert.equal(await evaluate('location.pathname.endsWith("/nuevo")'), true);
  await evaluate('window.confirm=window.__confirm');
  await click('.curriculum-form button[type="submit"]');
  await wait('!location.pathname.endsWith("/nuevo") && document.querySelector(".curriculum-heading h1")?.innerText === "Soporte"');
  assert.equal(agentFixture.records.get('user-a').cvs.length, 3);
  await click('.curriculum-heading a');
  await wait('document.querySelectorAll(".curriculum-card").length === 3');
  console.log('PASS manual CV creation, saved URL, and guard protects unsaved content');
  await click('.milo-launcher');

  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate('(() => {const b=document.querySelector(".milo-window").getBoundingClientRect();return b.left>=0 && b.right<=innerWidth && b.top>=0 && b.bottom<=innerHeight;})()'),true);
  await click('.milo-resize');
  await wait('document.querySelector(".milo-window").classList.contains("milo-expanded")');
  assert.equal(await evaluate('(() => {const b=document.querySelector(".milo-window").getBoundingClientRect();const list=document.querySelector(".milo-messages");return b.left>=0 && b.right<=innerWidth && b.top>=0 && b.bottom<=innerHeight && list.clientHeight>0;})()'),true);
  const requests=traffic.filter(item=>item.path.startsWith('/api/v1/milo/agente/')&&item.method!=='OPTIONS');
  assert(requests.length>=6);
  assert(requests.every(item=>item.bearer&&!item.cookie));
  await click('.dashboard-exit');
  await wait('location.pathname === "/acceso" && !document.querySelector(".milo-launcher")');
  assert.deepEqual(failures,[]);
  console.log('PASS mobile layout, Bearer without cookies, logout removes private widget');
  console.log(JSON.stringify({miloRequests:requests.length,modelSteps:agentFixture.modelCalls.length,awsCalls:0,geminiCalls:0}));
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  browser.kill();
  await Promise.all([new Promise(resolve => frontend.close(resolve)), new Promise(resolve => backend.close(resolve))]);
  cognitoClient.destroy(); profileClient.destroy();
}


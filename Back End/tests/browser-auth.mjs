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
  return { Item: structuredClone(saved) };
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

  await navigate('/panel/perfil?vista=cv');
  await waitJs('location.pathname === "/acceso" && !!document.querySelector("#access-email")');
  assert.equal(traffic.length, 1);
  assert.equal(traffic[0].path, '/api/v1/auth/renovar');
  console.log('PASS private route denied without authentication after one anonymous session check');

  await login('Wrong-password!');
  await waitJs('!!document.querySelector(".access-error")');
  assert.equal(await evaluate('location.pathname'), '/acceso');
  console.log('PASS wrong password stays on login');

  mode = 'network';
  await login();
  await waitJs('location.pathname === "/panel" && !!document.querySelector(".dashboard-profile-summary button")');
  assert(await evaluate('document.body.innerText.includes("test@example.com")'));
  mode = 'normal';
  await click('.dashboard-profile-summary button');
  await waitJs('!!document.querySelector(".dashboard-profile-summary a")');
  const loaded = traffic.find(item => item.path === '/api/v1/perfil' && item.status === 200);
  assert(loaded?.bearer);
  assert.equal(loaded.cookie, false);
  console.log('PASS correct login, network failure preserves session, retry loads profile with Bearer and no cookies');

  await navigate('/panel/perfil?vista=cv');
  await waitJs('!!document.querySelector("app-profile-cv") && document.querySelector("app-profile-cv").innerText.includes("Persona Browser")');
  assert.equal(await evaluate('location.pathname'), '/panel/perfil');
  assert.equal(await evaluate(`[...Object.values(localStorage), ...Object.values(sessionStorage)].some(value => /signed-token|eyJ|test-refresh-token/.test(value))`), false);
  console.log('PASS direct private URL reload restores session and CV; no JWT in localStorage/sessionStorage');

  await click('.dashboard-exit');
  await waitJs('location.pathname === "/acceso" && !!document.querySelector("#access-email")');
  assert(state.calls.some(call => call.name === 'GlobalSignOutCommand'));
  assert(traffic.find(item => item.path === '/api/v1/auth/salida' && item.method === 'POST')?.bearer);
  console.log('PASS logout clears memory and requests Cognito sign-out');
  await send('Page.reload');
  await waitJs('location.pathname === "/acceso" && !!document.querySelector("#access-email")');
  const cookies = await send('Network.getCookies', { urls: [site + '/api/v1/auth/renovar'] });
  assert(!cookies.cookies.some(cookie => cookie.name === '__Secure-iarmatucv.renew'));
  console.log('PASS logout clears HttpOnly renewal cookie and cannot resurrect on reload');

  mode = 'expired';
  await login();
  await waitJs('!!document.querySelector(".dashboard-profile-summary") && document.querySelector(".dashboard-profile-summary").innerText.includes("venció")');
  const count = traffic.length;
  await pause(500);
  assert.equal(traffic.length, count);
  assert.equal(await evaluate('location.pathname'), '/panel');
  await click('.dashboard-profile-summary a[href="/acceso"]');
  await waitJs('location.pathname === "/acceso" && !!document.querySelector("#access-email")');
  assert(await evaluate('document.body.innerText.includes("venció")'));
  console.log('PASS expired token shows notice, no automatic redirects/retries, explicit login works');

  mode = 'normal';
  await login();
  await waitJs('!!document.querySelector(".dashboard-profile-summary a")');
  await send('Page.reload');
  await waitJs('location.pathname === "/panel" && !!document.querySelector(".dashboard-profile-summary a")');
  const restoredCookies = await send('Network.getCookies', { urls: [site + '/api/v1/auth/renovar'] });
  const cookie = restoredCookies.cookies.find(cookie => cookie.name === '__Secure-iarmatucv.renew');
  assert(cookie?.httpOnly && cookie.secure && cookie.sameSite === 'Strict');
  assert.equal(await evaluate('document.cookie.includes("iarmatucv.renew")'), false);
  console.log('PASS reload restores memory session via first-party HttpOnly Secure cookie, third-party cookies blocked');
  mode = 'renew-network';
  await send('Page.reload');
  await waitJs('location.pathname === "/acceso" && document.querySelector(".access-error")?.innerText.includes("recuperar")');
  assert((await send('Network.getCookies', { urls: [site + '/api/v1/auth/renovar'] })).cookies.some(cookie => cookie.name === '__Secure-iarmatucv.renew'));
  mode = 'normal';
  await click('.access-panel > button');
  await waitJs('location.pathname === "/panel" && !!document.querySelector(".dashboard-profile-summary a")');
  console.log('PASS startup network outage preserves cookie; explicit retry restores without entering credentials');
  mode = 'renew-expired';
  await send('Page.reload');
  await waitJs('location.pathname === "/acceso" && !!document.querySelector("#access-email")');
  assert(await evaluate('document.body.innerText.includes("venció")'));
  const finalCount = traffic.length; await pause(300); assert.equal(traffic.length, finalCount);
  console.log('PASS expired refresh token requires login once, with notice and no redirect loop');
  mode = 'normal';
  process.env.APP_ADMIN_EMAILS = 'test@example.com';
  const memberId = '22222222-2222-4222-8222-222222222222';
  let memberEnabled = true;
  const adminCalls = [];
  const beforeAdminSend = cognitoClient.send;
  cognitoClient.send = async command => {
    const name = command.constructor.name;
    if (name === 'GetUserCommand') {
      const sub = JSON.parse(Buffer.from(command.input.AccessToken.split('.')[1], 'base64url')).sub;
      if (sub === memberId && !memberEnabled) throw Object.assign(new Error('Disabled'), { name: 'NotAuthorizedException' });
    }
    if (name === 'ListUsersCommand') return { Users: [
      { Username: 'test-user', Enabled: true, UserStatus: 'CONFIRMED', Attributes: [
        { Name: 'sub', Value: 'user-a' }, { Name: 'email', Value: 'test@example.com' }, { Name: 'email_verified', Value: 'true' }, { Name: 'nickname', Value: 'Admin' }
      ] },
      { Username: memberId, Enabled: memberEnabled, UserStatus: 'CONFIRMED', Attributes: [
        { Name: 'sub', Value: memberId }, { Name: 'email', Value: 'member@example.invalid' }, { Name: 'email_verified', Value: 'true' },
        { Name: 'phone_number', Value: 'PRIVATE_PHONE' }, { Name: 'custom:cv', Value: 'PRIVATE_CV' }
      ] }
    ] };
    if (['AdminDisableUserCommand', 'AdminEnableUserCommand'].includes(name)) {
      adminCalls.push(name); memberEnabled = name === 'AdminEnableUserCommand'; return {};
    }
    return beforeAdminSend(command);
  };
  await login();
  await waitJs(`!!document.querySelector('.dashboard-nav a[href="/panel/admin"]')`);
  await click('.dashboard-nav a[href="/panel/admin"]');
  await waitJs('document.querySelectorAll("app-admin tbody tr").length === 2');
  assert.equal(await evaluate('document.querySelector("app-admin").innerText.includes("PRIVATE")'), false);
  assert.equal(await evaluate('document.querySelector("app-admin tbody tr").querySelector("button") === null'), true);
  await click('app-admin tbody tr:last-child button');
  await waitJs('!!document.querySelector(".admin-confirm")');
  assert.equal(adminCalls.length, 0);
  await click('.admin-confirm .btn-gradient');
  await waitJs('!document.querySelector(".admin-confirm") && document.querySelector("app-admin tbody tr:last-child").innerText.includes("Deshabilitada")');
  assert.equal(memberEnabled, false);
  const blockedMember = await fetch(api + '/api/v1/perfil', { headers: { Authorization: 'Bearer ' + token({ sub: memberId }) } });
  assert.equal(blockedMember.status, 401);
  await click('app-admin tbody tr:last-child button');
  await click('.admin-confirm .btn-gradient');
  await waitJs('!document.querySelector(".admin-confirm") && document.querySelector("app-admin tbody tr:last-child").innerText.includes("Habilitada")');
  assert.equal(memberEnabled, true);
  assert.deepEqual(adminCalls, ['AdminDisableUserCommand', 'AdminEnableUserCommand']);
  console.log('PASS minimal admin dashboard, privacy filtering, confirmation, disable/enable and protected admin account');
  await click('.dashboard-exit');
  await waitJs('location.pathname === "/acceso" && !!document.querySelector("#access-email")');
  process.env.APP_ADMIN_EMAILS = 'different@example.invalid';
  await login();
  await waitJs('location.pathname === "/panel" && !!document.querySelector(".dashboard-nav")');
  assert.equal(await evaluate(`document.querySelector('.dashboard-nav a[href="/panel/admin"]') === null`), true);
  await navigate('/panel/admin');
  await waitJs('location.pathname === "/panel" && !document.querySelector("app-admin")');
  const forbidden = await fetch(api + '/api/v1/admin/usuarios', { headers: { Authorization: 'Bearer ' + token() } });
  assert.equal(forbidden.status, 403);
  console.log('PASS non-admin navigation hidden, direct admin route denied and backend rejects access');
  assert.deepEqual(failures, []);
  console.log(JSON.stringify({ requests: traffic.length, authenticatedProfile: loaded.status, thirdPartyCookiesBlocked: true, externalAwsCalls: 0 }));
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  browser.kill();
  await Promise.all([new Promise(resolve => frontend.close(resolve)), new Promise(resolve => backend.close(resolve))]);
  cognitoClient.destroy(); profileClient.destroy();
}


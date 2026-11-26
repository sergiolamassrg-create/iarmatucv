import express from 'express';

// Browser integration double for the HTTPS Amplify reverse proxy. Local loopback is trusted by Chrome.
export function mountBrowserApiProxy(web, options) {
  web.use('/api/v1', express.raw({ type: '*/*', limit: '32kb' }), async (req, res) => {
    const path = new URL(req.originalUrl, options.site()).pathname;
    const mode = options.mode();
    if (path === '/api/v1/perfil' && mode === 'network') { res.destroy(); return; }
    if (path === '/api/v1/auth/renovar' && mode === 'renew-network') {
      options.traffic.push({ path, method: req.method, status: 503 });
      res.status(503).json({ error: { codigo: 'ACCESO_NO_DISPONIBLE', mensaje: 'Servicio temporalmente no disponible.' } }); return;
    }
    const headers = { ...req.headers, origin: req.get('origin') ?? options.site() };
    delete headers.host; delete headers['content-length']; delete headers.connection;
    if (path === '/api/v1/perfil' && mode === 'expired') headers.authorization = 'Bearer ' + options.token({ exp: 1 });
    if (path === '/api/v1/auth/renovar' && mode === 'renew-expired') headers.cookie = '__Secure-iarmatucv.renew=expired-token';
    try {
      const result = await fetch(options.api() + path, {
        method: req.method, headers,
        ...(Buffer.isBuffer(req.body) && req.body.length ? { body: req.body } : {})
      });
      const body = Buffer.from(await result.arrayBuffer());
      options.traffic.push({ path, method: req.method, status: result.status,
        bearer: /^Bearer /.test(req.get('authorization') ?? ''), cookie: Boolean(req.headers.cookie) });
      res.status(result.status);
      for (const [key, value] of result.headers) {
        if (!['set-cookie', 'connection', 'content-length', 'content-encoding', 'transfer-encoding'].includes(key)) res.setHeader(key, value);
      }
      for (const cookie of result.headers.getSetCookie()) res.append('Set-Cookie', cookie);
      res.send(body);
    } catch { res.status(502).json({ error: { codigo: 'PROXY_NO_DISPONIBLE', mensaje: 'No pudimos conectar con la API local.' } }); }
  });
}

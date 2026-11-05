import cors from 'cors';
import express from 'express';
import { environment } from './config/environment.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { createApiRouter } from './routes/api.routes.js';
import type { AuthOptions } from './models/auth-context.js';
import { verifyAccessToken } from './services/jwt.service.js';

export function createApp(options: Partial<AuthOptions> = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: environment.frontendOrigins, credentials: true }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api/v1', createApiRouter({
    mode: options.mode ?? environment.authMode,
    secureCookies: environment.production || options.secureCookies === true,
    verifyAccessToken: options.verifyAccessToken ?? verifyAccessToken
  }));
  app.use((_req, res) => {
    res.status(404).json({
      error: { codigo: 'RUTA_NO_ENCONTRADA', mensaje: 'La ruta solicitada no existe.' }
    });
  });
  app.use(errorHandler);
  return app;
}

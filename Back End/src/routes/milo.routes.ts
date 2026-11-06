import { Router } from 'express';
import { environment } from '../config/environment.js';
import type { AuthOptions } from '../models/auth-context.js';
import { requireAuth } from '../middlewares/require-auth.middleware.js';
import { MiloError } from '../services/milo-error.js';
import { miloChatController } from '../controllers/milo.controller.js';

export function createMiloRouter(options: AuthOptions) {
  const router = Router();
  router.use((_req, res, next) => {
    res.locals['authOptions'] = { ...options, mode: 'jwt' };
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.use(requireAuth);
  router.post('/chat', (req, res, next) => {
    if (!res.locals['authIdentity']?.subject || res.locals['authIdentity'].subject === 'DEMO_USER_SUB_REEMPLAZAR') {
      throw new MiloError(403, 'MILO_IDENTIDAD_INVALIDA', 'Ingresá con una cuenta válida.');
    }
    const origin = req.get('origin');
    if ((origin && !environment.frontendOrigins.includes(origin)) || (!origin && !req.get('authorization'))) {
      throw new MiloError(403, 'ORIGEN_NO_PERMITIDO', 'La solicitud no está permitida.');
    }
    if (!req.is('application/json')) throw new MiloError(415, 'JSON_REQUERIDO', 'Enviá la consulta como application/json.');
    next();
  }, miloChatController);
  return router;
}

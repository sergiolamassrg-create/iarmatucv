import { Router } from 'express';
import { environment } from '../config/environment.js';
import type { AuthOptions } from '../models/auth-context.js';
import { requireAuth } from '../middlewares/require-auth.middleware.js';
import { ProfileError } from '../services/profile-error.js';
import { getProfileController, saveProfileController, deleteProfileController } from '../controllers/profile.controller.js';

export function createProfileRouter(options: AuthOptions) {
  const router = Router();
  router.use((_req, res, next) => {
    res.locals['authOptions'] = { ...options, mode: 'jwt' };
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.use(requireAuth);
  router.use((req, res, next) => {
    const subject: unknown = res.locals['authIdentity']?.subject;
    if (typeof subject !== 'string' || !subject.trim() || subject === 'DEMO_USER_SUB_REEMPLAZAR') {
      throw new ProfileError(403, 'IDENTIDAD_NO_PERMITIDA', 'No se permite usar esta identidad para un perfil.');
    }
    if (req.method !== 'GET') {
      const origin = req.get('origin');
      if ((origin && !environment.frontendOrigins.includes(origin)) || (!origin && !req.get('authorization'))) {
        throw new ProfileError(403, 'ORIGEN_NO_PERMITIDO', 'La solicitud no está permitida.');
      }
    }
    if (req.method === 'PUT' && !req.is('application/json')) {
      throw new ProfileError(415, 'JSON_REQUERIDO', 'Enviá el perfil como application/json.');
    }
    next();
  });
  router.get('/', getProfileController);
  router.put('/', saveProfileController);
  router.delete('/', deleteProfileController);
  return router;
}

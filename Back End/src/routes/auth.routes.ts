import { Router } from 'express';
import { environment } from '../config/environment.js';
import { AuthError } from '../services/auth-error.js';
import { createAuthSession } from '../middlewares/auth-session.middleware.js';
import { requireAuth } from '../middlewares/require-auth.middleware.js';
import type { AuthOptions } from '../models/auth-context.js';
import {
  registerController, confirmController, resendController, loginController,
  sessionController, recoverController, resetController, logoutController
} from '../controllers/auth.controller.js';

export function createAuthRouter(options: AuthOptions) {
  const authRouter = Router();
  authRouter.use((_req, res, next) => {
    res.locals['authOptions'] = options;
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  authRouter.use((req, _res, next) => {
    if (req.method !== 'GET' && (!req.is('application/json') || !environment.frontendOrigins.includes(req.get('origin') ?? ''))) {
      next(new AuthError(403, 'ORIGEN_NO_PERMITIDO', 'La solicitud de acceso no está permitida.'));
      return;
    }
    next();
  });
  if (options.mode === 'session') authRouter.use(createAuthSession());
  authRouter.get('/sesion', sessionController);
  authRouter.get('/perfil', requireAuth, sessionController);
  authRouter.post('/registro', registerController);
  authRouter.post('/confirmacion', confirmController);
  authRouter.post('/reenviar-codigo', resendController);
  authRouter.post('/ingreso', loginController);
  authRouter.post('/recuperacion', recoverController);
  authRouter.post('/restablecer', resetController);
  authRouter.post('/salida', logoutController);
  return authRouter;
}

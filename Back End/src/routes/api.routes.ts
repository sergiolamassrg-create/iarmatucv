import { Router } from 'express';
import { healthController } from '../controllers/health.controller.js';
import { templatesController } from '../controllers/templates.controller.js';
import { createAuthRouter } from './auth.routes.js';
import { createProfileRouter } from './profile.routes.js';
import { createMiloRouter } from './milo.routes.js';
import type { AuthOptions } from '../models/auth-context.js';

export function createApiRouter(options: AuthOptions) {
  const apiRouter = Router();
  apiRouter.use('/auth', createAuthRouter(options));
  apiRouter.use('/perfil', createProfileRouter(options));
  apiRouter.use('/milo', createMiloRouter(options));
  apiRouter.get('/health', healthController);
  apiRouter.get('/plantillas', templatesController);
  return apiRouter;
}

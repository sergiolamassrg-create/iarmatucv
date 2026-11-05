import { Router } from 'express';
import { healthController } from '../controllers/health.controller.js';
import { templatesController } from '../controllers/templates.controller.js';
import { createAuthRouter } from './auth.routes.js';
import type { AuthOptions } from '../models/auth-context.js';

export function createApiRouter(options: AuthOptions) {
  const apiRouter = Router();
  apiRouter.use('/auth', createAuthRouter(options));
  apiRouter.get('/health', healthController);
  apiRouter.get('/plantillas', templatesController);
  return apiRouter;
}

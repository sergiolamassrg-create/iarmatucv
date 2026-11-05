import { Router } from 'express';
import { healthController } from '../controllers/health.controller.js';
import { templatesController } from '../controllers/templates.controller.js';
import { authRouter } from './auth.routes.js';

export const apiRouter = Router();
apiRouter.use('/auth', authRouter);
apiRouter.get('/health', healthController);
apiRouter.get('/plantillas', templatesController);

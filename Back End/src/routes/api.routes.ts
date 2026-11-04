import { Router } from 'express';
import { healthController } from '../controllers/health.controller.js';
import { templatesController } from '../controllers/templates.controller.js';

export const apiRouter = Router();
apiRouter.get('/health', healthController);
apiRouter.get('/plantillas', templatesController);

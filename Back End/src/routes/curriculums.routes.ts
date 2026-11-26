import { Router } from 'express';
import type { AuthOptions } from '../models/auth-context.js';
import { requireAuth } from '../middlewares/require-auth.middleware.js';
import { environment } from '../config/environment.js';
import { miloAgent } from '../milo-agent/router.js';
import { fail } from '../milo-agent/validation.js';

export function createCurriculumsRouter(options: AuthOptions, library = miloAgent) {
  const router = Router();
  router.use((_req, res, next) => {
    res.locals['authOptions'] = { ...options, mode: 'jwt' };
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.use(requireAuth);
  router.use((req, res, next) => {
    if (!res.locals['authIdentity']?.subject) return fail(403, 'CV_IDENTIDAD_INVALIDA', 'Ingresá con una cuenta válida.');
    if (req.method !== 'GET') {
      const origin = req.get('origin');
      if (!origin || !environment.frontendOrigins.includes(origin)) return fail(403, 'ORIGEN_NO_PERMITIDO', 'La solicitud no está permitida.');
      if (!req.is('application/json')) return fail(415, 'JSON_REQUERIDO', 'Enviá datos en formato JSON.');
    }
    next();
  });
  const subject = (res: import('express').Response): string => res.locals['authIdentity'].subject;
  router.get('/', async (_req, res) => { res.json({ data: await library.listCvs(subject(res)) }); });
  router.post('/', async (req, res) => { res.status(201).json({ data: await library.createCv(subject(res), req.body) }); });
  router.get('/:id', async (req, res) => { res.json({ data: await library.getCv(subject(res), req.params['id']) }); });
  router.put('/:id', async (req, res) => { res.json({ data: await library.updateCv(subject(res), req.params['id'], req.body) }); });
  router.post('/:id/duplicar', async (req, res) => { res.status(201).json({ data: await library.duplicateCv(subject(res), req.params['id'], req.body) }); });
  return router;
}


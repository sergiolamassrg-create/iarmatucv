import { Router } from 'express';
import type { AuthOptions } from '../models/auth-context.js';
import { requireAuth } from '../middlewares/require-auth.middleware.js';
import { environment } from '../config/environment.js';
import { getProfile } from '../services/profile.service.js';
import { MiloAgent } from './agent.js';
import { agentConfig } from './config.js';
import { agentModel } from './model.js';
import { agentStore } from './store.js';
import { fail } from './validation.js';

export const miloAgent = new MiloAgent({ store: agentStore, model: agentModel, profile: getProfile, config: agentConfig });
export function createMiloAgentRouter(options: AuthOptions, agent = miloAgent) {
  const router = Router();
  router.use((_req, res, next) => {
    res.locals['authOptions'] = { ...options, mode: 'jwt' };
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.use(requireAuth);
  router.use((req, res, next) => {
    if (!res.locals['authIdentity']?.subject) return fail(403, 'MILO_IDENTIDAD_INVALIDA', 'Ingresá con una cuenta válida.');
    if (req.method !== 'GET') {
      const origin = req.get('origin');
      if (!origin || !environment.frontendOrigins.includes(origin)) return fail(403, 'ORIGEN_NO_PERMITIDO', 'La solicitud no está permitida.');
      if (!req.is('application/json')) return fail(415, 'JSON_REQUERIDO', 'Enviá datos en formato JSON.');
    }
    next();
  });
  const subject = (res: import('express').Response): string => res.locals['authIdentity'].subject;
  router.get('/conversacion', async (_req, res) => { res.json({ data: await agent.history(subject(res)) }); });
  router.post('/conversacion', async (req, res) => { res.json({ data: await agent.newConversation(subject(res), req.body) }); });
  router.post('/mensajes', async (req, res) => {
    res.json({ data: await agent.message(subject(res), req.body, res.locals['authIdentity'].user?.isAdmin === true) });
  });
  router.post('/confirmaciones', async (req, res) => { res.json({ data: await agent.confirm(subject(res), req.body) }); });
  router.post('/confirmaciones-perfil', async (req, res) => { res.json({ data: await agent.confirmProfile(subject(res), req.body) }); });
  router.post('/cancelaciones', async (req, res) => { res.json({ data: await agent.cancel(subject(res), req.body) }); });
  router.get('/curriculums/:id', async (req, res) => { res.json({ data: await agent.getCv(subject(res), req.params['id']) }); });
  return router;
}


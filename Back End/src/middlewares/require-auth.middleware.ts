import type { RequestHandler } from 'express';
import { readAuth } from '../services/auth-transport.service.js';
import { AuthError } from '../services/auth-error.js';

export const requireAuth: RequestHandler = async (req, res, next) => {
  const identity = await readAuth(req, res);
  if (!identity) throw new AuthError(401, 'AUTENTICACION_REQUERIDA', 'Iniciá sesión para continuar.');
  res.locals['authIdentity'] = identity;
  next();
};

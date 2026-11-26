import { Router } from 'express';
import { AdminDisableUserCommand, AdminEnableUserCommand, ListUsersCommand, type UserType } from '@aws-sdk/client-cognito-identity-provider';
import { requireAuth } from '../middlewares/require-auth.middleware.js';
import { environment } from '../config/environment.js';
import { cognitoClient } from '../services/auth.service.js';
import { AuthError } from '../services/auth-error.js';
import { isAdministrator } from '../services/admin-policy.js';
import type { AuthOptions } from '../models/auth-context.js';

const summary = (user: UserType) => {
  const attributes = Object.fromEntries((user.Attributes ?? []).map(item => [item.Name, item.Value]));
  const admin = isAdministrator({ email: attributes['email'] ?? '', emailVerified: attributes['email_verified'] === 'true' });
  return { id: attributes['sub'] ?? '', email: attributes['email'] ?? '', nombre: attributes['nickname'] ?? '',
    habilitado: user.Enabled === true, estado: user.UserStatus ?? 'DESCONOCIDO',
    registrado: user.UserCreateDate?.toISOString() ?? null, administrador: admin };
};
async function execute<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) {
    if (error instanceof AuthError) throw error;
    const name = error instanceof Error ? error.name : '';
    if (['AccessDeniedException', 'NotAuthorizedException', 'UnrecognizedClientException', 'ExpiredTokenException'].includes(name)) {
      throw new AuthError(503, 'ADMIN_PERMISOS_AWS', 'La administración no está disponible con los permisos o la sesión actuales de AWS Academy.');
    }
    throw new AuthError(503, 'ADMIN_NO_DISPONIBLE', 'No pudimos consultar o actualizar las cuentas. Reintentá más tarde.');
  }
}

export function createAdminRouter(options: AuthOptions) {
  const router = Router();
  router.use((_req, res, next) => {
    res.locals['authOptions'] = { ...options, mode: 'jwt' };
    res.setHeader('Cache-Control', 'no-store'); next();
  });
  router.use(requireAuth);
  router.use((req, res, next) => {
    if (res.locals['authIdentity'].user?.isAdmin !== true) throw new AuthError(403, 'ADMIN_REQUERIDO', 'No tenés acceso a la administración.');
    if (req.method !== 'GET' && (!req.is('application/json') || !environment.frontendOrigins.includes(req.get('origin') ?? ''))) {
      throw new AuthError(403, 'ORIGEN_NO_PERMITIDO', 'La solicitud de administración no está permitida.');
    }
    next();
  });
  router.get('/usuarios', async (req, res) => {
    if (Object.keys(req.query).some(key => key !== 'pagina')) throw new AuthError(400, 'DATOS_INVALIDOS', 'Revisá la paginación.');
    const page = req.query['pagina'];
    if (page !== undefined && (typeof page !== 'string' || page.length < 1 || page.length > 4096)) throw new AuthError(400, 'DATOS_INVALIDOS', 'Revisá la paginación.');
    const result = await execute(() => cognitoClient.send(new ListUsersCommand({ UserPoolId: environment.cognito.userPoolId,
      Limit: 25, ...(typeof page === 'string' ? { PaginationToken: page } : {}) })));
    res.json({ data: { usuarios: (result.Users ?? []).map(summary), siguiente: result.PaginationToken ?? null } });
  });
  router.put('/usuarios/:id/estado', async (req, res) => {
    const id = req.params['id'];
    if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id) ||
        !req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length !== 1 || typeof req.body.habilitado !== 'boolean') {
      throw new AuthError(400, 'DATOS_INVALIDOS', 'Indicá la cuenta y su estado.');
    }
    if (id === res.locals['authIdentity'].subject) throw new AuthError(403, 'ADMIN_CUENTA_PROTEGIDA', 'No podés cambiar el estado de tu propia cuenta administradora.');
    const result = await execute(() => cognitoClient.send(new ListUsersCommand({ UserPoolId: environment.cognito.userPoolId, Filter: `sub = "${id}"`, Limit: 2 })));
    const target = result.Users?.find(user => summary(user).id === id);
    if (!target?.Username) throw new AuthError(404, 'CUENTA_NO_ENCONTRADA', 'No encontramos esa cuenta.');
    if (summary(target).administrador) throw new AuthError(403, 'ADMIN_CUENTA_PROTEGIDA', 'Esta cuenta administradora está protegida.');
    const input = { UserPoolId: environment.cognito.userPoolId, Username: target.Username };
    await execute(() => cognitoClient.send(req.body.habilitado ? new AdminEnableUserCommand(input) : new AdminDisableUserCommand(input)));
    res.json({ data: { ...summary(target), habilitado: req.body.habilitado } });
  });
  return router;
}

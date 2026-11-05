import type { Request, Response } from 'express';
import * as auth from '../services/auth.service.js';
import { AuthError } from '../services/auth-error.js';
import { openAuth, readAuth, closeAuth } from '../services/auth-transport.service.js';
import type { AuthIdentity } from '../models/auth-context.js';

function field(req: Request, name: string, max: number): string {
  const value: unknown = req.body?.[name];
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new AuthError(400, 'DATOS_INVALIDOS', 'Revisá los campos obligatorios y volvé a intentar.');
  }
  return name === 'password' ? value : value.trim();
}

function email(req: Request): string {
  const value = field(req, 'email', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new AuthError(400, 'CORREO_INVALIDO', 'Ingresá un correo electrónico válido.');
  }
  return value;
}

export async function registerController(req: Request, res: Response): Promise<void> {
  res.status(201).json({ data: await auth.register(email(req), field(req, 'password', 256), {
    name: field(req, 'name', 128),
    familyName: field(req, 'familyName', 128),
    nickname: field(req, 'nickname', 64)
  }) });
}

export async function confirmController(req: Request, res: Response): Promise<void> {
  await auth.confirm(email(req), field(req, 'code', 32));
  res.json({ data: { message: 'Correo confirmado. Ya podés iniciar sesión.' } });
}

export async function resendController(req: Request, res: Response): Promise<void> {
  await auth.resend(email(req));
  res.json({ data: { message: 'Solicitamos un nuevo código de confirmación. Revisá tu correo.' } });
}

export async function loginController(req: Request, res: Response): Promise<void> {
  const result = await auth.login(email(req), field(req, 'password', 256));
  await openAuth(req, res, result.session);
  res.json({ data: result.user });
}

export async function sessionController(req: Request, res: Response): Promise<void> {
  const identity: AuthIdentity | null = res.locals['authIdentity'] ?? await readAuth(req, res);
  if (!identity) { res.json({ data: null }); return; }
  try {
    const user = await auth.currentUser(identity.accessToken);
    if (identity.subject && user.id !== identity.subject) {
      throw new AuthError(401, 'SESION_INVALIDA', 'La sesión no es válida. Volvé a ingresar.');
    }
    res.json({ data: user });
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'NotAuthorizedException') throw error;
    await closeAuth(req, res);
    if (res.locals['authIdentity']) throw new AuthError(401, 'SESION_INVALIDA', 'La sesión no es válida. Volvé a ingresar.');
    res.json({ data: null });
  }
}

export async function recoverController(req: Request, res: Response): Promise<void> {
  await auth.recover(email(req));
  res.json({ data: { message: 'Si la cuenta permite recuperar el acceso, recibirás un código por correo.' } });
}

export async function resetController(req: Request, res: Response): Promise<void> {
  await auth.resetPassword(email(req), field(req, 'code', 32), field(req, 'password', 256));
  res.json({ data: { message: 'Contraseña actualizada. Ya podés iniciar sesión.' } });
}

export async function logoutController(req: Request, res: Response): Promise<void> {
  const refreshToken = await closeAuth(req, res);
  if (refreshToken) {
    try { await auth.revoke(refreshToken); }
    catch {
      res.json({ data: { message: 'Cerramos la sesión en este navegador. No pudimos revocar el acceso remoto; podría seguir válido hasta su vencimiento.' } });
      return;
    }
  }
  res.json({ data: { message: 'Sesión cerrada.' } });
}

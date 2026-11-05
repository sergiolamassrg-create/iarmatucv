import type { Request, Response } from 'express';
import * as auth from '../services/auth.service.js';
import { AuthError } from '../services/auth-error.js';
import { sessionCookieName } from '../middlewares/auth-session.middleware.js';
import { environment } from '../config/environment.js';

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

function destroy(req: Request): Promise<void> {
  return new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
}

function clearCookie(res: Response): void {
  res.clearCookie(sessionCookieName, { path: '/api/v1/auth', httpOnly: true, sameSite: 'lax', secure: environment.production });
}

export async function registerController(req: Request, res: Response): Promise<void> {
  res.status(201).json({ data: await auth.register(email(req), field(req, 'password', 256)) });
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
  await new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
  req.session.auth = result.session;
  req.session.cookie.maxAge = Math.max(0, result.session.expiresAt - Date.now());
  await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
  res.json({ data: result.user });
}

export async function sessionController(req: Request, res: Response): Promise<void> {
  const session = req.session.auth;
  if (!session) { res.json({ data: null }); return; }
  if (session.expiresAt <= Date.now()) {
    await destroy(req);
    clearCookie(res);
    res.json({ data: null });
    return;
  }
  try {
    res.json({ data: await auth.currentUser(session.accessToken) });
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'NotAuthorizedException') throw error;
    await destroy(req);
    clearCookie(res);
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
  const refreshToken = req.session.auth?.refreshToken;
  await destroy(req);
  clearCookie(res);
  if (refreshToken) {
    try { await auth.revoke(refreshToken); }
    catch {
      res.json({ data: { message: 'Cerramos la sesión en esta aplicación. No pudimos revocar el acceso remoto; intentá nuevamente si usás otros dispositivos.' } });
      return;
    }
  }
  res.json({ data: { message: 'Sesión cerrada.' } });
}

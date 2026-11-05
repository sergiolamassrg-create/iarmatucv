import type { CookieOptions, Request, Response } from 'express';
import { parseCookie } from 'cookie';
import { FetchError } from 'aws-jwt-verify/error';
import { environment } from '../config/environment.js';
import type { AuthIdentity, AuthOptions, AuthTokens } from '../models/auth-context.js';
import { sessionCookieName } from '../middlewares/auth-session.middleware.js';
import { AuthError } from './auth-error.js';

export const accessCookieName = 'iarmatucv.access';
export const refreshCookieName = 'iarmatucv.refresh';

export function authOptions(res: Response): AuthOptions { return res.locals['authOptions']; }

function cookies(res: Response): CookieOptions {
  return {
    httpOnly: true, secure: authOptions(res).secureCookies || environment.cookieSameSite === 'none',
    sameSite: environment.cookieSameSite, path: environment.cookiePath
  };
}

export function clearJwtCookies(res: Response): void {
  res.clearCookie(accessCookieName, cookies(res));
  res.clearCookie(refreshCookieName, cookies(res));
}

function destroy(req: Request): Promise<void> {
  return new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
}

async function verified(token: string, res: Response) {
  try {
    const claims = await authOptions(res).verifyAccessToken(token);
    if (typeof claims.sub !== 'string' || !claims.sub || typeof claims.exp !== 'number' ||
        !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()) throw new Error('Invalid token claims');
    return claims;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    if (error instanceof FetchError) {
      throw new AuthError(503, 'VERIFICACION_NO_DISPONIBLE', 'No pudimos verificar la sesión en este momento. Intentá nuevamente más tarde.');
    }
    clearJwtCookies(res);
    throw new AuthError(401, 'SESION_INVALIDA', 'La sesión no es válida o venció. Volvé a ingresar.');
  }
}

export async function openAuth(req: Request, res: Response, tokens: AuthTokens): Promise<void> {
  if (authOptions(res).mode === 'jwt') {
    const claims = await verified(tokens.accessToken, res);
    const maxAge = Math.max(0, Math.min(tokens.expiresAt, claims.exp * 1000) - Date.now());
    res.cookie(accessCookieName, tokens.accessToken, { ...cookies(res), maxAge });
    if (tokens.refreshToken) res.cookie(refreshCookieName, tokens.refreshToken, cookies(res));
    else res.clearCookie(refreshCookieName, cookies(res));
    return;
  }
  if (environment.sessionSecret.length < 32) {
    throw new AuthError(503, 'ACCESO_NO_CONFIGURADO', 'El acceso todavía no está disponible.');
  }
  await new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
  req.session.auth = tokens;
  req.session.cookie.maxAge = Math.max(0, tokens.expiresAt - Date.now());
  await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
}

export async function readAuth(req: Request, res: Response): Promise<AuthIdentity | null> {
  if (authOptions(res).mode === 'jwt') {
    const authorization = req.get('authorization');
    const match = authorization?.match(/^Bearer ([^\s,]+)$/i);
    if (authorization && !match) throw new AuthError(401, 'SESION_INVALIDA', 'La autorización no es válida.');
    const token = match?.[1] ?? parseCookie(req.headers.cookie ?? '')[accessCookieName];
    if (!token) return null;
    const claims = await verified(token, res);
    return { accessToken: token, subject: claims.sub };
  }
  const session = req.session.auth;
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    await closeAuth(req, res);
    return null;
  }
  return { accessToken: session.accessToken };
}

export async function closeAuth(req: Request, res: Response): Promise<string | undefined> {
  if (authOptions(res).mode === 'jwt') {
    const refreshToken = parseCookie(req.headers.cookie ?? '')[refreshCookieName];
    clearJwtCookies(res);
    return refreshToken;
  }
  const refreshToken = req.session.auth?.refreshToken;
  await destroy(req);
  res.clearCookie(sessionCookieName, { path: '/api/v1/auth', httpOnly: true, sameSite: 'lax', secure: environment.production });
  return refreshToken;
}

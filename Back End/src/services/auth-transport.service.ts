import type { CookieOptions, Request, Response } from 'express';
import { parseCookie } from 'cookie';
import { FetchError } from 'aws-jwt-verify/error';
import { environment } from '../config/environment.js';
import type { AuthIdentity, AuthOptions, AuthTokens } from '../models/auth-context.js';
import { sessionCookieName } from '../middlewares/auth-session.middleware.js';
import { AuthError } from './auth-error.js';
import { currentUser } from './auth.service.js';

export const accessCookieName = 'iarmatucv.access';
export const refreshCookieName = 'iarmatucv.refresh';
export const renewalCookieName = '__Secure-iarmatucv.renew';
const renewalCookies: CookieOptions = { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/v1/auth' };
export function renewalToken(req: Request): string | undefined { return parseCookie(req.headers.cookie ?? '')[renewalCookieName]; }
export function clearRenewalCookie(res: Response): void { res.clearCookie(renewalCookieName, renewalCookies); }

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

export async function openAuth(req: Request, res: Response, tokens: AuthTokens): Promise<{ accessToken: string; expiresAt: number } | void> {
  // Explicit opt-in: never expose a refresh token or depend on third-party cookies.
  if (req.body?.transport === 'bearer' || req.body?.transport === 'bearer-cookie') {
    const claims = await verified(tokens.accessToken, res);
    if (req.body?.transport === 'bearer-cookie') {
      if (!tokens.refreshToken || tokens.refreshToken.length > 3800) {
        throw new AuthError(503, 'RENOVACION_NO_DISPONIBLE', 'No pudimos habilitar la recuperación de sesión. Intentá nuevamente más tarde.');
      }
      // Host-only session cookie. It must be delivered through the same-origin HTTPS proxy.
      res.cookie(renewalCookieName, tokens.refreshToken, renewalCookies);
    }
    return { accessToken: tokens.accessToken, expiresAt: Math.min(tokens.expiresAt, claims.exp * 1000) };
  }
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
  if (authOptions(res).mode === 'jwt' || req.get('authorization')) {
    const authorization = req.get('authorization');
    const match = authorization?.match(/^Bearer ([^\s,]+)$/i);
    if (authorization && !match) throw new AuthError(401, 'SESION_INVALIDA', 'La autorización no es válida.');
    const token = match?.[1] ?? parseCookie(req.headers.cookie ?? '')[accessCookieName];
    if (!token) return null;
    const claims = await verified(token, res);
    try {
      // Signature validation alone cannot detect a disabled/revoked Cognito account.
      const user = await currentUser(token);
      if (user.id !== claims.sub) throw new AuthError(401, 'SESION_INVALIDA', 'La sesión no es válida. Volvé a ingresar.');
      return { accessToken: token, subject: claims.sub, user };
    } catch (error) {
      if (error instanceof Error && ['NotAuthorizedException', 'UserNotFoundException'].includes(error.name)) {
        throw new AuthError(401, 'CUENTA_NO_DISPONIBLE', 'Tu sesión ya no está activa o la cuenta está deshabilitada. Volvé a ingresar.');
      }
      throw error;
    }
  }
  const session = req.session.auth;
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    await closeAuth(req, res);
    return null;
  }
  try {
    const user = await currentUser(session.accessToken);
    return { accessToken: session.accessToken, subject: user.id, user };
  } catch (error) {
    if (error instanceof Error && ['NotAuthorizedException', 'UserNotFoundException'].includes(error.name)) {
      throw new AuthError(401, 'CUENTA_NO_DISPONIBLE', 'Tu sesión ya no está activa o la cuenta está deshabilitada. Volvé a ingresar.');
    }
    throw error;
  }
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

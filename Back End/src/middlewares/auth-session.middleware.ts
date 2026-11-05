import { randomBytes } from 'node:crypto';
import session from 'express-session';
import { environment } from '../config/environment.js';

export const sessionCookieName = 'iarmatucv.sid';

export const authSession = session({
  name: sessionCookieName,
  secret: environment.sessionSecret || randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: environment.production, sameSite: 'lax', maxAge: 3600000, path: '/api/v1/auth' }
});

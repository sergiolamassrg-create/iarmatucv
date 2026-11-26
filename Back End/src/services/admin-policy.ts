import type { AuthUser } from '../models/auth-user.js';

// Server configuration only. No role, email or admin flag supplied by a client is trusted.
export function isAdministrator(user: Pick<AuthUser, 'email' | 'emailVerified'>): boolean {
  const emails = (process.env['APP_ADMIN_EMAILS'] ?? '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
  return user.emailVerified === true && emails.includes(user.email.trim().toLowerCase());
}

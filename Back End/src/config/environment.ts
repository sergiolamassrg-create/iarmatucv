import 'dotenv/config';

const port = Number(process.env['PORT'] ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT debe ser un entero entre 1 y 65535.');
}

const isLambda = Boolean(process.env['AWS_LAMBDA_FUNCTION_NAME']);
const production = isLambda || process.env['NODE_ENV'] === 'production';
const authMode = process.env['AUTH_MODE'] ?? (production ? 'jwt' : 'session');
if (authMode !== 'session' && authMode !== 'jwt') throw new Error('AUTH_MODE debe ser session o jwt.');
if (production && authMode !== 'jwt') throw new Error('Produccion y Lambda requieren AUTH_MODE=jwt.');

const frontendOrigins = (process.env['FRONTEND_ORIGINS'] ?? (production ? '' :
  'http://localhost:4200,http://127.0.0.1:4200')).split(',').map(origin => origin.trim()).filter(Boolean);
if (production && frontendOrigins.length === 0) throw new Error('Configurar FRONTEND_ORIGINS para produccion.');
for (const origin of frontendOrigins) {
  const url = new URL(origin);
  if (url.origin !== origin || (production && url.protocol !== 'https:')) {
    throw new Error('FRONTEND_ORIGINS debe contener origenes exactos; HTTPS en produccion.');
  }
}
const cookieSameSite = process.env['AUTH_COOKIE_SAME_SITE'] ?? (production ? 'none' : 'lax');
if (!['none', 'lax', 'strict'].includes(cookieSameSite)) throw new Error('AUTH_COOKIE_SAME_SITE invalido.');
const cookiePath = process.env['AUTH_COOKIE_PATH'] ?? '/api/v1';
if (!/^\/[^;\s]*$/.test(cookiePath)) throw new Error('AUTH_COOKIE_PATH invalido.');

export const environment = {
  port,
  host: process.env['HOST'] ?? '127.0.0.1',
  frontendOrigins,
  cognito: {
    region: process.env['COGNITO_REGION'] ?? 'us-east-1',
    clientId: process.env['COGNITO_CLIENT_ID'] ?? '',
    clientSecret: process.env['COGNITO_CLIENT_SECRET'] ?? '',
    userPoolId: process.env['COGNITO_USER_POOL_ID'] ?? ''
  },
  sessionSecret: process.env['SESSION_SECRET'] ?? '',
  production,
  authMode: authMode as 'session' | 'jwt',
  cookieSameSite: cookieSameSite as 'none' | 'lax' | 'strict',
  cookiePath
};

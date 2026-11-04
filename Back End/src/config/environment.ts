import 'dotenv/config';

const port = Number(process.env['PORT'] ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT debe ser un entero entre 1 y 65535.');
}

export const environment = {
  port,
  host: process.env['HOST'] ?? '127.0.0.1',
  frontendOrigins: (process.env['FRONTEND_ORIGINS'] ??
    'http://localhost:4200,http://127.0.0.1:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
};

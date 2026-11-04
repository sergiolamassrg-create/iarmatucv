import { app } from './app.js';
import { environment } from './config/environment.js';

const server = app.listen(environment.port, environment.host, () => {
  console.log(`iArmatuCV API: http://${environment.host}:${environment.port}/api/v1/health`);
});

server.on('error', () => {
  console.error('No se pudo iniciar la API. Revisar HOST, PORT y si el puerto esta ocupado.');
  process.exitCode = 1;
});

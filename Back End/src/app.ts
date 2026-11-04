import cors from 'cors';
import express from 'express';
import { environment } from './config/environment.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { apiRouter } from './routes/api.routes.js';

export const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: environment.frontendOrigins }));
app.use(express.json({ limit: '32kb' }));
app.use('/api/v1', apiRouter);
app.use((_req, res) => {
  res.status(404).json({
    error: { codigo: 'RUTA_NO_ENCONTRADA', mensaje: 'La ruta solicitada no existe.' }
  });
});
app.use(errorHandler);

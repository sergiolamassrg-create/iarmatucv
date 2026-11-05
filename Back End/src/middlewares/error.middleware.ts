import type { ErrorRequestHandler } from 'express';
import { cognitoError } from '../services/auth-error.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  const authError = cognitoError(error);
  if (authError) {
    res.status(authError.status).json({ error: { codigo: authError.code, mensaje: authError.message } });
    return;
  }
  const type = error && typeof error === 'object' && 'type' in error ? error.type : '';

  if (type === 'entity.parse.failed') {
    res.status(400).json({
      error: { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo debe ser un JSON valido.' }
    });
    return;
  }

  if (type === 'entity.too.large') {
    res.status(413).json({
      error: { codigo: 'CUERPO_EXCESIVO', mensaje: 'La solicitud supera el limite permitido.' }
    });
    return;
  }

  console.error('Error interno al procesar una solicitud.');
  res.status(500).json({
    error: { codigo: 'ERROR_INTERNO', mensaje: 'No se pudo procesar la solicitud.' }
  });
};

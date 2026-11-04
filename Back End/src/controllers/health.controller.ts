import type { Request, Response } from 'express';

export function healthController(_req: Request, res: Response): void {
  res.json({ data: { estado: 'ok', servicio: 'iarmatucv-api' } });
}

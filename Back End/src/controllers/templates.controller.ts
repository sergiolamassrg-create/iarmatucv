import type { Request, Response } from 'express';
import { getTemplates } from '../services/templates.service.js';

export function templatesController(_req: Request, res: Response): void {
  res.json({ data: getTemplates() });
}

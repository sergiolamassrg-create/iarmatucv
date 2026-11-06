import type { Request, Response } from 'express';
import { chatWithMilo } from '../services/milo.service.js';

export async function miloChatController(req: Request, res: Response): Promise<void> {
  res.json({ data: await chatWithMilo(res.locals['authIdentity'].subject, req.body) });
}

import type { Request, Response } from 'express';
import type { AuthIdentity } from '../models/auth-context.js';
import * as profile from '../services/profile.service.js';

function userId(res: Response): string {
  return (res.locals['authIdentity'] as AuthIdentity).subject!;
}

export async function getProfileController(_req: Request, res: Response): Promise<void> {
  res.json({ data: await profile.getProfile(userId(res)) });
}

export async function saveProfileController(req: Request, res: Response): Promise<void> {
  res.json({ data: await profile.saveProfile(userId(res), req.body) });
}

export async function deleteProfileController(_req: Request, res: Response): Promise<void> {
  await profile.deleteProfile(userId(res));
  res.status(204).end();
}

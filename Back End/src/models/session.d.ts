import 'express-session';

declare module 'express-session' {
  interface SessionData {
    auth?: {
      accessToken: string;
      refreshToken?: string;
      expiresAt: number;
    };
  }
}

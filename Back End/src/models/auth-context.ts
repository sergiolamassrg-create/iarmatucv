import type { CognitoAccessTokenPayload } from 'aws-jwt-verify/jwt-model';

export type AuthMode = 'session' | 'jwt';
export type AccessTokenVerifier = (token: string) => Promise<CognitoAccessTokenPayload>;

export interface AuthOptions {
  mode: AuthMode;
  secureCookies: boolean;
  verifyAccessToken: AccessTokenVerifier;
}

export interface AuthIdentity {
  accessToken: string;
  subject?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

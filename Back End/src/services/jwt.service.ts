import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { JwksCache } from 'aws-jwt-verify/jwk';
import { environment } from '../config/environment.js';
import { AuthError } from './auth-error.js';

export function createCognitoVerifier(userPoolId: string, clientId: string, jwksCache?: JwksCache) {
  return CognitoJwtVerifier.create(
    { userPoolId, clientId, tokenUse: 'access' },
    jwksCache ? { jwksCache } : undefined
  );
}

let verifier: ReturnType<typeof createCognitoVerifier> | undefined;

export async function verifyAccessToken(token: string) {
  if (!verifier) {
    const { userPoolId, clientId } = environment.cognito;
    if (!userPoolId || !clientId) {
      throw new AuthError(503, 'ACCESO_NO_CONFIGURADO', 'El acceso todavía no está disponible.');
    }
    try { verifier = createCognitoVerifier(userPoolId, clientId); }
    catch { throw new AuthError(503, 'ACCESO_NO_CONFIGURADO', 'El acceso todavía no está disponible.'); }
  }
  return verifier.verify(token);
}

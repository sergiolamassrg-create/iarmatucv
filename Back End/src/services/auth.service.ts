import { createHmac } from 'node:crypto';
import {
  CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand,
  ResendConfirmationCodeCommand, InitiateAuthCommand, GetUserCommand,
  ForgotPasswordCommand, ConfirmForgotPasswordCommand, RevokeTokenCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { environment } from '../config/environment.js';
import type { AuthUser } from '../models/auth-user.js';
import { AuthError } from './auth-error.js';

export const cognitoClient = new CognitoIdentityProviderClient({
  region: environment.cognito.region,
  maxAttempts: 1,
  requestHandler: { connectionTimeout: 3000, requestTimeout: 8000 }
});

function clientParameters(email: string) {
  const { clientId, clientSecret } = environment.cognito;
  if (!clientId || environment.sessionSecret.length < 32) {
    throw new AuthError(503, 'ACCESO_NO_CONFIGURADO', 'El acceso todavía no está disponible. Intentá nuevamente más tarde.');
  }
  return {
    ClientId: clientId,
    ...(clientSecret ? { SecretHash: createHmac('sha256', clientSecret).update(email + clientId).digest('base64') } : {})
  };
}

export async function register(email: string, password: string) {
  const result = await cognitoClient.send(new SignUpCommand({
    ...clientParameters(email), Username: email, Password: password,
    UserAttributes: [{ Name: 'email', Value: email }]
  }));
  return { confirmed: result.UserConfirmed === true };
}

export async function confirm(email: string, code: string): Promise<void> {
  await cognitoClient.send(new ConfirmSignUpCommand({
    ...clientParameters(email), Username: email, ConfirmationCode: code
  }));
}

export async function resend(email: string): Promise<void> {
  await cognitoClient.send(new ResendConfirmationCodeCommand({
    ...clientParameters(email), Username: email
  }));
}

export async function login(email: string, password: string) {
  const { ClientId, SecretHash } = clientParameters(email);
  const result = await cognitoClient.send(new InitiateAuthCommand({
    ClientId, AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: { USERNAME: email, PASSWORD: password, ...(SecretHash ? { SECRET_HASH: SecretHash } : {}) }
  }));
  const tokens = result.AuthenticationResult;
  if (result.ChallengeName || !tokens?.AccessToken) {
    throw new AuthError(409, 'VERIFICACION_ADICIONAL', 'Tu cuenta requiere un paso adicional de verificación que todavía no está disponible en esta aplicación.');
  }
  const user = await currentUser(tokens.AccessToken);
  return {
    user,
    session: {
      accessToken: tokens.AccessToken,
      refreshToken: tokens.RefreshToken,
      expiresAt: Date.now() + (tokens.ExpiresIn ?? 3600) * 1000
    }
  };
}

export async function currentUser(accessToken: string): Promise<AuthUser> {
  const result = await cognitoClient.send(new GetUserCommand({ AccessToken: accessToken }));
  const attributes = Object.fromEntries((result.UserAttributes ?? []).map(item => [item.Name, item.Value]));
  if (!attributes['sub']) throw new AuthError(401, 'SESION_INVALIDA', 'La sesión no es válida. Volvé a ingresar.');
  return {
    id: attributes['sub'], username: result.Username ?? '',
    email: attributes['email'] ?? '', emailVerified: attributes['email_verified'] === 'true'
  };
}

export async function recover(email: string): Promise<void> {
  try {
    await cognitoClient.send(new ForgotPasswordCommand({ ...clientParameters(email), Username: email }));
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'UserNotFoundException') throw error;
  }
}

export async function resetPassword(email: string, code: string, password: string): Promise<void> {
  await cognitoClient.send(new ConfirmForgotPasswordCommand({
    ...clientParameters(email), Username: email, ConfirmationCode: code, Password: password
  }));
}

export async function revoke(refreshToken: string): Promise<void> {
  await cognitoClient.send(new RevokeTokenCommand({
    ClientId: environment.cognito.clientId,
    ...(environment.cognito.clientSecret ? { ClientSecret: environment.cognito.clientSecret } : {}),
    Token: refreshToken
  }));
}

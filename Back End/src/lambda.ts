import serverless from 'serverless-http';
import type { APIGatewayProxyHandlerV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { createApp } from './app.js';
import type { AccessTokenVerifier } from './models/auth-context.js';

export function createLambdaHandler(verifyAccessToken?: AccessTokenVerifier): APIGatewayProxyHandlerV2 {
  const proxy = serverless(createApp({ mode: 'jwt', secureCookies: true, verifyAccessToken }), { binary: false });
  return async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    if (event.version !== '2.0' || !event.requestContext?.http) {
      return {
        statusCode: 400, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        body: JSON.stringify({ error: { codigo: 'EVENTO_INVALIDO', mensaje: 'Se requiere HTTP API payload v2.' } })
      };
    }
    return await proxy(event, context) as APIGatewayProxyStructuredResultV2;
  };
}

export const handler = createLambdaHandler();

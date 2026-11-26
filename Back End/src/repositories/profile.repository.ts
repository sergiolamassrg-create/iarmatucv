import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, DeleteCommand, type UpdateCommandInput } from '@aws-sdk/lib-dynamodb';
import { environment } from '../config/environment.js';
import { profileFields } from '../models/professional-profile.js';
import type { ProfileInput, ProfessionalProfile } from '../models/professional-profile.js';
import { ProfileError } from '../services/profile-error.js';

export const profileClient = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: environment.dynamodb.region, maxAttempts: 2,
  requestHandler: { connectionTimeout: 3000, requestTimeout: 8000 }
}));

function tableName(): string {
  if (!environment.dynamodb.perfilesTable) {
    throw new ProfileError(503, 'PERFIL_NO_CONFIGURADO', 'El servicio de perfiles todavía no está disponible.');
  }
  return environment.dynamodb.perfilesTable;
}

// Allowlisted summaries preserve the diagnosis without copying arbitrary SDK messages,
// which can contain request keys, profile values, credentials or authorization headers.
const diagnosticMessages: Record<string, string> = {
  AccessDeniedException: 'AWS denied access to the DynamoDB operation.',
  ExpiredTokenException: 'The AWS security token has expired.',
  ExpiredToken: 'The AWS security token has expired.',
  UnrecognizedClientException: 'AWS did not recognize the supplied credentials.',
  InvalidClientTokenId: 'The AWS security token is invalid.',
  InvalidSignatureException: 'AWS rejected the request signature.',
  CredentialsProviderError: 'The SDK could not resolve AWS credentials.',
  TokenProviderError: 'The SDK could not resolve an AWS token.',
  TimeoutError: 'The DynamoDB request timed out.',
  RequestTimeout: 'The DynamoDB request timed out.',
  NetworkingError: 'The SDK could not connect to DynamoDB.',
  ECONNRESET: 'The DynamoDB connection was reset.',
  ECONNREFUSED: 'The DynamoDB connection was refused.',
  ETIMEDOUT: 'The DynamoDB connection timed out.',
  ENOTFOUND: 'The DynamoDB endpoint could not be resolved.',
  EAI_AGAIN: 'DNS resolution for DynamoDB temporarily failed.',
  ResourceNotFoundException: 'The requested DynamoDB resource was not found.',
  ProvisionedThroughputExceededException: 'DynamoDB provisioned throughput was exceeded.',
  ThrottlingException: 'AWS throttled the DynamoDB request.',
  RequestLimitExceeded: 'The DynamoDB request limit was exceeded.',
  InternalServerError: 'DynamoDB reported an internal error.',
  ServiceUnavailable: 'DynamoDB reported that the service is unavailable.',
  ValidationException: 'DynamoDB rejected the request parameters.'
};

function diagnosticCode(value: unknown): string | null {
  return typeof value === 'string' && Object.hasOwn(diagnosticMessages, value) ? value : null;
}

function logFailure(error: unknown, operation: string): void {
  const details = error !== null && typeof error === 'object' ? error as Record<string, unknown> : {};
  const metadata = details['$metadata'] !== null && typeof details['$metadata'] === 'object'
    ? details['$metadata'] as Record<string, unknown> : {};
  const name = diagnosticCode(details['name']);
  const code = diagnosticCode(details['code']) ?? diagnosticCode(details['Code']);
  const status = metadata['httpStatusCode'];
  const requestId = metadata['requestId'];
  const safeRequestId = typeof requestId === 'string' &&
    /^(?:[A-Z0-9]{52}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.test(requestId);
  console.error(JSON.stringify({
    event: 'DYNAMODB_OPERATION_FAILED', operation,
    errorName: name ?? (details['name'] === 'Error' ? 'Error' : 'UnknownError'),
    awsCode: code,
    message: diagnosticMessages[code ?? name ?? ''] ?? 'Technical message omitted: unrecognized error.',
    httpStatusCode: typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
    awsRequestId: safeRequestId ? requestId : null
  }));
}

async function execute<T>(operationName: 'GetItem' | 'UpdateItem' | 'DeleteItem', operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    logFailure(error, operationName);
    throw new ProfileError(503, 'PERFIL_NO_DISPONIBLE', 'No pudimos procesar el perfil. Intentá nuevamente más tarde.');
  }
}

export async function getProfile(userId: string): Promise<ProfessionalProfile | undefined> {
  const command = new GetCommand({ TableName: tableName(), Key: { userId }, ConsistentRead: true });
  const result = await execute('GetItem', () => profileClient.send(command));
  return result.Item as ProfessionalProfile | undefined;
}

export function profileUpdateInput(userId: string, profile: ProfileInput): UpdateCommandInput {
  const now = new Date().toISOString();
  const names: Record<string, string> = { '#createdAt': 'createdAt', '#updatedAt': 'updatedAt', '#schemaVersion': 'schemaVersion' };
  const values: Record<string, unknown> = { ':now': now, ':version': 1 };
  const updates = ['#createdAt = if_not_exists(#createdAt, :now)', '#updatedAt = :now', '#schemaVersion = :version'];
  profileFields.forEach((field, index) => {
    names[`#f${index}`] = field;
    values[`:v${index}`] = profile[field];
    updates.push(`#f${index} = :v${index}`);
  });
  return {
    TableName: tableName(), Key: { userId }, UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeNames: names, ExpressionAttributeValues: values, ReturnValues: 'ALL_NEW'
  };
}

export async function saveProfile(userId: string, profile: ProfileInput): Promise<ProfessionalProfile> {
  const command = new UpdateCommand(profileUpdateInput(userId, profile));
  const result = await execute('UpdateItem', () => profileClient.send(command));
  if (!result.Attributes) throw new ProfileError(503, 'PERFIL_NO_DISPONIBLE', 'No pudimos confirmar el guardado del perfil.');
  return result.Attributes as ProfessionalProfile;
}

export async function deleteProfile(userId: string): Promise<void> {
  const command = new DeleteCommand({ TableName: tableName(), Key: { userId } });
  await execute('DeleteItem', () => profileClient.send(command));
}

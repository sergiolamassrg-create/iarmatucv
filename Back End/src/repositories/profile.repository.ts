import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
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

async function execute<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch {
    throw new ProfileError(503, 'PERFIL_NO_DISPONIBLE', 'No pudimos procesar el perfil. Intentá nuevamente más tarde.');
  }
}

export async function getProfile(userId: string): Promise<ProfessionalProfile | undefined> {
  const command = new GetCommand({ TableName: tableName(), Key: { userId }, ConsistentRead: true });
  const result = await execute(() => profileClient.send(command));
  return result.Item as ProfessionalProfile | undefined;
}

export async function saveProfile(userId: string, profile: ProfileInput): Promise<ProfessionalProfile> {
  const now = new Date().toISOString();
  const names: Record<string, string> = { '#createdAt': 'createdAt', '#updatedAt': 'updatedAt', '#schemaVersion': 'schemaVersion' };
  const values: Record<string, unknown> = { ':now': now, ':version': 1 };
  const updates = ['#createdAt = if_not_exists(#createdAt, :now)', '#updatedAt = :now', '#schemaVersion = :version'];
  profileFields.forEach((field, index) => {
    names[`#f${index}`] = field;
    values[`:v${index}`] = profile[field];
    updates.push(`#f${index} = :v${index}`);
  });
  const command = new UpdateCommand({
    TableName: tableName(), Key: { userId }, UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeNames: names, ExpressionAttributeValues: values, ReturnValues: 'ALL_NEW'
  });
  const result = await execute(() => profileClient.send(command));
  if (!result.Attributes) throw new ProfileError(503, 'PERFIL_NO_DISPONIBLE', 'No pudimos confirmar el guardado del perfil.');
  return result.Attributes as ProfessionalProfile;
}

export async function deleteProfile(userId: string): Promise<void> {
  const command = new DeleteCommand({ TableName: tableName(), Key: { userId } });
  await execute(() => profileClient.send(command));
}

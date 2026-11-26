import { createHash } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { environment } from '../config/environment.js';
import { agentConfig } from './config.js';
import { fail } from './validation.js';
import { profileUpdateInput } from '../repositories/profile.repository.js';
import type { AgentStore, AgentState } from './types.js';

export const miloDocumentClient = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: environment.dynamodb.region, maxAttempts: 2,
  requestHandler: { connectionTimeout: 3000, requestTimeout: 8000 }
}));
export const stateKey = (subject: string) => 'milo:v1:user:' + createHash('sha256').update(subject).digest('hex');
const table = () => agentConfig().table;
function storeError(error: unknown): never {
  const name = error instanceof Error ? error.name : '';
  if (name === 'ConditionalCheckFailedException') {
    return fail(409, 'MILO_OPERACION_VENCIDA', 'La operación perdió su reserva o venció. Recargá la conversación y reintentá.');
  }
  return fail(503, 'MILO_PERSISTENCIA', 'No pudimos acceder a los datos de Milo. Intentá más tarde.');
}
export const agentStore: AgentStore = {
  async read(subject) {
    try {
      const result = await miloDocumentClient.send(new GetCommand({
        TableName: table(), Key: { userId: stateKey(subject) }, ConsistentRead: true
      }));
      return result.Item?.['state'] as AgentState ?? null;
    } catch (error) { return storeError(error); }
  },
  async acquire(subject, owner, config, consume) {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const day = Math.floor(now / 86400000);
    const user = stateKey(subject);
    const counters = [
      [user + ':minute:' + minute, config.userMinute, now + 120000],
      [user + ':day:' + day, config.userDay, now + 172800000],
      ['milo:v1:global:minute:' + minute, config.globalMinute, now + 120000],
      ['milo:v1:global:day:' + day, config.globalDay, now + 172800000]
    ] as const;
    try {
      await miloDocumentClient.send(new TransactWriteCommand({ TransactItems: [
        { Update: { TableName: config.table, Key: { userId: user },
          UpdateExpression: 'SET leaseOwner = :owner, leaseUntil = :until',
          ConditionExpression: 'attribute_not_exists(leaseUntil) OR leaseUntil < :now',
          ExpressionAttributeValues: { ':owner': owner, ':until': now + config.timeoutMs + 30000, ':now': now } } },
        ...(consume ? counters.map(([key, max, expiry]) => ({ Update: {
          TableName: config.table, Key: { userId: key },
          UpdateExpression: 'SET expiresAt = :expiry ADD #count :one',
          ConditionExpression: 'attribute_not_exists(#count) OR #count < :max',
          ExpressionAttributeNames: { '#count': 'count' },
          ExpressionAttributeValues: { ':expiry': Math.floor(expiry / 1000), ':one': 1, ':max': max }
        } })) : [])
      ] }));
    } catch (error) {
      if (error instanceof Error && error.name === 'TransactionCanceledException') {
        const reasons = (error as Error & { CancellationReasons?: { Code?: string }[] }).CancellationReasons;
        if (reasons?.[0]?.Code === 'ConditionalCheckFailed') {
          return fail(409, 'MILO_OPERACION_EN_CURSO', 'Ya hay una operación de tu cuenta en curso. Esperá unos segundos y reintentá.');
        }
        if (consume) {
          const quotas = [
            ['MILO_CUOTA_USUARIO_MINUTO', 'Alcanzaste tu cuota de consultas por minuto. Esperá un minuto y reintentá.'],
            ['MILO_CUOTA_USUARIO_DIA', 'Alcanzaste tu cuota diaria de consultas a Milo.'],
            ['MILO_CUOTA_GLOBAL_MINUTO', 'Milo alcanzó la cuota compartida por minuto. Esperá un minuto y reintentá.'],
            ['MILO_CUOTA_GLOBAL_DIA', 'Milo alcanzó la cuota diaria compartida.']
          ];
          const index = reasons?.slice(1).findIndex(reason => reason.Code === 'ConditionalCheckFailed') ?? -1;
          const quota = quotas[index];
          if (quota) return fail(429, quota[0]!, quota[1]!);
        }
      }
      // Unknown transaction failures are not evidence that a user's quota was exhausted.
      storeError(error);
    }
  },
  async save(subject, owner, state) {
    if (Buffer.byteLength(JSON.stringify(state), 'utf8') > 260000) {
      return fail(413, 'MILO_ALMACENAMIENTO_LLENO', 'La conversación o los CV alcanzaron el tamaño máximo.');
    }
    try {
      await miloDocumentClient.send(new UpdateCommand({
        TableName: table(), Key: { userId: stateKey(subject) },
        UpdateExpression: 'SET #state = :state REMOVE leaseOwner, leaseUntil',
        ExpressionAttributeNames: { '#state': 'state' },
        ConditionExpression: 'leaseOwner = :owner AND leaseUntil >= :now',
        ExpressionAttributeValues: { ':owner': owner, ':now': Date.now(), ':state': state }
      }));
    } catch (error) { storeError(error); }
  },
  async saveProfile(subject, owner, state, profile, expectedUpdatedAt) {
    if (Buffer.byteLength(JSON.stringify(state), 'utf8') > 260000) {
      return fail(413, 'MILO_ALMACENAMIENTO_LLENO', 'La conversación o los CV alcanzaron el tamaño máximo.');
    }
    const { ReturnValues: _returnValues, ...update } = profileUpdateInput(subject, profile);
    try {
      await miloDocumentClient.send(new TransactWriteCommand({ TransactItems: [
        { Update: { ...update, TableName: update.TableName!, Key: update.Key!, UpdateExpression: update.UpdateExpression!,
          ConditionExpression: '#updatedAt = :expected',
          ExpressionAttributeValues: { ...update.ExpressionAttributeValues, ':expected': expectedUpdatedAt } } },
        { Update: { TableName: table(), Key: { userId: stateKey(subject) },
          UpdateExpression: 'SET #state = :state REMOVE leaseOwner, leaseUntil',
          ExpressionAttributeNames: { '#state': 'state' },
          ConditionExpression: 'leaseOwner = :owner AND leaseUntil >= :now',
          ExpressionAttributeValues: { ':owner': owner, ':now': Date.now(), ':state': state } } }
      ] }));
    } catch (error) {
      if (error instanceof Error && error.name === 'TransactionCanceledException') {
        const reasons = (error as Error & { CancellationReasons?: { Code?: string }[] }).CancellationReasons;
        if (reasons?.[0]?.Code === 'ConditionalCheckFailed') return fail(409, 'MILO_PERFIL_MODIFICADO', 'El perfil cambió desde la propuesta. Pedile a Milo una nueva.');
      }
      storeError(error);
    }
  },
  async release(subject, owner) {
    try {
      await miloDocumentClient.send(new UpdateCommand({
        TableName: table(), Key: { userId: stateKey(subject) },
        UpdateExpression: 'REMOVE leaseOwner, leaseUntil',
        ConditionExpression: 'leaseOwner = :owner',
        ExpressionAttributeValues: { ':owner': owner }
      }));
    } catch { /* A completed save already released the lease; failed leases expire. */ }
  }
};


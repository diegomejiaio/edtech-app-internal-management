import { execSync } from 'child_process';

export type CosmosContainer = 'master' | 'operations';

export function hasCosmosConfig(): boolean {
  return Boolean(process.env.COSMOSDB_CONNECTION_STRING && process.env.COSMOSDB_DATABASE);
}

/**
 * Query Cosmos DB using cosmosdbshell CLI.
 * Requires COSMOSDB_CONNECTION_STRING and COSMOSDB_DATABASE in env.
 */
export async function queryCosmosDB(
  sql: string,
  container: CosmosContainer = 'master',
): Promise<Record<string, unknown>[]> {
  const conn = process.env.COSMOSDB_CONNECTION_STRING;
  const db = process.env.COSMOSDB_DATABASE || 'espacio-pro';

  if (!conn) {
    throw new Error('COSMOSDB_CONNECTION_STRING not set in e2e/.env');
  }

  const safeSql = sql.replace(/'/g, "\\'");
  const cmd = `cosmosdbshell --connection "${conn}" --execute "cd ${db}/${container}; query '${safeSql}';"`;

  const output = execSync(cmd, { encoding: 'utf-8', timeout: 15_000 });

  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`Failed to parse Cosmos DB response: ${output}`);
  }
}

/**
 * Verify a document exists with expected audit fields.
 */
export async function verifyDocumentCreated(
  type: string,
  filter: string,
  container: CosmosContainer = 'master',
): Promise<Record<string, unknown>> {
  const results = await queryCosmosDB(
    `SELECT * FROM c WHERE c.type = '${type}' AND ${filter}`,
    container,
  );

  if (results.length === 0) {
    throw new Error(`No ${type} found matching: ${filter}`);
  }

  const doc = results[0];
  const createdBy = doc.createdBy as Record<string, unknown> | undefined;

  if (!doc.createdAt) throw new Error(`${type} missing createdAt`);
  if (!createdBy?.userId && !createdBy?.clerkUserId) throw new Error(`${type} missing createdBy.userId`);
  if (!createdBy?.name && !createdBy?.displayName) throw new Error(`${type} missing createdBy.name`);
  if (doc.deletedAt !== null && doc.deletedAt !== undefined) {
    throw new Error(`${type} has deletedAt set (should be null for active docs)`);
  }

  return doc;
}

export function verifyDocumentSoftDeleted(type: string, doc: Record<string, unknown>) {
  if (!doc.deletedAt) throw new Error(`${type} missing deletedAt after delete`);
  if (!doc.deletedBy) throw new Error(`${type} missing deletedBy after delete`);
}

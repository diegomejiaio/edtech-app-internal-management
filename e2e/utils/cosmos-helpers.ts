import { execSync } from 'child_process';

/**
 * Query Cosmos DB using cosmosdbshell CLI.
 * Requires COSMOSDB_CONNECTION_STRING and COSMOSDB_DATABASE in env.
 */
export async function queryCosmosDB(sql: string): Promise<Record<string, unknown>[]> {
  const conn = process.env.COSMOSDB_CONNECTION_STRING;
  const db = process.env.COSMOSDB_DATABASE || 'espacio-pro';

  if (!conn) {
    throw new Error('COSMOSDB_CONNECTION_STRING not set in e2e/.env');
  }

  const cmd = `cosmosdbshell --connection "${conn}" --execute "cd ${db}/master; query '${sql.replace(/'/g, "\\'")}';"`;

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
): Promise<Record<string, unknown>> {
  const results = await queryCosmosDB(
    `SELECT * FROM c WHERE c.type = '${type}' AND ${filter}`
  );

  if (results.length === 0) {
    throw new Error(`No ${type} found matching: ${filter}`);
  }

  const doc = results[0];

  // Verify mandatory audit fields
  if (!doc.createdAt) throw new Error(`${type} missing createdAt`);
  if (!doc.createdBy) throw new Error(`${type} missing createdBy`);
  if (doc.deletedAt !== null && doc.deletedAt !== undefined) {
    throw new Error(`${type} has deletedAt set (should be null for active docs)`);
  }

  return doc;
}

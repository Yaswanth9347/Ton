import db from '../models/db.js';

const REQUIRED_USER_COLUMNS = {
  failed_login_attempts: 'INTEGER DEFAULT 0',
  account_locked: 'BOOLEAN DEFAULT false',
  last_failed_login: 'TIMESTAMP(6)',
  reset_token: 'VARCHAR(255)',
  reset_token_expiry: 'TIMESTAMP(6)'
};

let authSchemaCache = null;

export function resetAuthSchemaCache() {
  authSchemaCache = null;
}

export async function getAuthSchemaColumns() {
  if (authSchemaCache) return authSchemaCache;

  const result = await db.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'`
  );

  const present = new Set(result.rows.map((row) => row.column_name));
  authSchemaCache = Object.keys(REQUIRED_USER_COLUMNS).reduce((acc, columnName) => {
    acc[columnName] = present.has(columnName);
    return acc;
  }, {});

  return authSchemaCache;
}

export async function ensureAuthSchema() {
  const current = await getAuthSchemaColumns();
  const missingColumns = Object.entries(current)
    .filter(([, exists]) => !exists)
    .map(([columnName]) => columnName);

  if (missingColumns.length === 0) {
    return current;
  }

  for (const columnName of missingColumns) {
    try {
      await db.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS ${columnName} ${REQUIRED_USER_COLUMNS[columnName]}`
      );
    } catch (error) {
      console.error(`[AUTH] Failed to add users.${columnName}:`, error.message);
    }
  }

  resetAuthSchemaCache();
  return getAuthSchemaColumns();
}
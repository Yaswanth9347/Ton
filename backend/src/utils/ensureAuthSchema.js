let authSchemaReady = false;

export function resetAuthSchemaCache() {
  authSchemaReady = false;
}

export async function getAuthSchemaColumns() {
  // Return true for all required columns since they are managed by Prisma
  return {
    failed_login_attempts: true,
    account_locked: true,
    last_failed_login: true,
    reset_token: true,
    reset_token_expiry: true
  };
}

/**
 * Ensure auth schema columns exist.
 * No-op for backward compatibility since columns are managed via Prisma.
 */
export async function ensureAuthSchema() {
  authSchemaReady = true;
  return getAuthSchemaColumns();
}
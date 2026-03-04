import pg from 'pg';
import dbConfig from '../config/database.js';

const { Pool } = pg;

const SQL = `
-- Ensure pipes_company_master exists
CREATE TABLE IF NOT EXISTS "pipes_company_master" (
  "id"           SERIAL PRIMARY KEY,
  "company_name" VARCHAR(100) UNIQUE NOT NULL,
  "is_active"    BOOLEAN DEFAULT true,
  "created_at"   TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

-- Patch BorewellWork only if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'BorewellWork'
  ) THEN
    ALTER TABLE "BorewellWork" ADD COLUMN IF NOT EXISTS "pipe_company_id" INTEGER;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = 'BorewellWork_pipe_company_id_fkey'
        AND table_name = 'BorewellWork'
    ) THEN
      ALTER TABLE "BorewellWork"
        ADD CONSTRAINT "BorewellWork_pipe_company_id_fkey"
        FOREIGN KEY ("pipe_company_id")
        REFERENCES "pipes_company_master"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;

    ALTER TABLE "BorewellWork" ADD COLUMN IF NOT EXISTS "geologist" VARCHAR(255);
  END IF;
END $$;
`;

function getPool() {
  if (!global.__govtBoreSchemaPool) {
    global.__govtBoreSchemaPool = new Pool({
      ...dbConfig,
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.__govtBoreSchemaPool;
}

export async function ensureGovtBoreSchema() {
  if (global.__govtBoreSchemaEnsured) return;
  if (!process.env.DATABASE_URL) return;

  const pool = getPool();

  try {
    await pool.query(SQL);
    global.__govtBoreSchemaEnsured = true;
    console.log('Govt bore schema ensured (pipe_company_id/geologist)');
  } catch (error) {
    // Don't crash the request just because schema-ensure failed.
    // The subsequent Prisma call will surface the real error if still broken.
    console.error('Govt bore schema ensure failed:', error?.message || error);
  }
}

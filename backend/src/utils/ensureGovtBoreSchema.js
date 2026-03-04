/**
 * Schema migration helper for Govt Bore (BorewellWork).
 *
 * Uses Prisma's OWN connection ($executeRawUnsafe / $queryRawUnsafe) so it
 * works reliably on Vercel serverless, Docker, and local dev — no extra
 * pg.Pool needed.
 *
 * After migration it VERIFIES the column exists before caching success.
 */

import prisma from '../config/prisma.js';

// Cache: null = not checked, true = column present, false = missing
let _hasPipeCompanyCol = null;

/**
 * Returns true when pipe_company_id column exists on BorewellWork.
 * Cached for the lifetime of the process / serverless warm-start.
 */
export async function hasPipeCompanyColumn() {
  if (_hasPipeCompanyCol !== null) return _hasPipeCompanyCol;

  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT 1 AS ok
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'BorewellWork'
        AND column_name  = 'pipe_company_id'
      LIMIT 1
    `);
    _hasPipeCompanyCol = rows.length > 0;
  } catch {
    _hasPipeCompanyCol = false;
  }

  return _hasPipeCompanyCol;
}

/** Reset the cache (useful after a successful migration). */
export function resetSchemaCache() {
  _hasPipeCompanyCol = null;
}

/**
 * Attempt to add pipe_company_id & geologist columns if they're missing.
 * Runs through Prisma's connection for maximum reliability.
 */
export async function ensureGovtBoreSchema() {
  // Fast path — already verified
  if (await hasPipeCompanyColumn()) return;

  try {
    // 1. Ensure the reference table exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "pipes_company_master" (
        "id"           SERIAL PRIMARY KEY,
        "company_name" VARCHAR(100) UNIQUE NOT NULL,
        "is_active"    BOOLEAN DEFAULT true,
        "created_at"   TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
        "updated_at"   TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Add pipe_company_id column
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "BorewellWork"
        ADD COLUMN IF NOT EXISTS "pipe_company_id" INTEGER
    `);

    // 3. Add FK constraint (idempotent)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'BorewellWork_pipe_company_id_fkey'
            AND table_name      = 'BorewellWork'
        ) THEN
          ALTER TABLE "BorewellWork"
            ADD CONSTRAINT "BorewellWork_pipe_company_id_fkey"
            FOREIGN KEY ("pipe_company_id")
            REFERENCES "pipes_company_master"("id")
            ON DELETE SET NULL
            ON UPDATE CASCADE;
        END IF;
      END $$
    `);

    // 4. Add geologist column
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "BorewellWork"
        ADD COLUMN IF NOT EXISTS "geologist" VARCHAR(255)
    `);

    // 5. Verify — only cache success when column truly exists
    const verify = await prisma.$queryRawUnsafe(`
      SELECT 1 AS ok
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'BorewellWork'
        AND column_name  = 'pipe_company_id'
      LIMIT 1
    `);
    _hasPipeCompanyCol = verify.length > 0;

    if (_hasPipeCompanyCol) {
      console.log('Govt bore schema ensured (pipe_company_id + geologist)');
    } else {
      console.warn('Govt bore schema: migration ran but column still missing (possible permission issue)');
    }
  } catch (error) {
    console.error('Govt bore schema migration failed:', error?.message || error);
    _hasPipeCompanyCol = false;
  }
}

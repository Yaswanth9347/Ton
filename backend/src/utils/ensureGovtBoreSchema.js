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

const REQUIRED_BOREWELLWORK_COLUMNS = [
  'createdAt',
  'updatedAt',
  'vehicle',
  'date',
  'grant',
  'estCost',
  'status',
  'remarks',
  'drilling_depth_mtrs',
  'drilling_rate',
  'drilling_amount',
  'casing180_qty',
  'casing180_rate',
  'casing180_amount',
  'casing140_qty',
  'casing140_rate',
  'casing140_amount',
  'slotting_qty',
  'slotting_rate',
  'slotting_amount',
  'pumpset_qty',
  'pumpset_rate',
  'pumpset_amount',
  'gi_pipes_qty',
  'gi_pipes_rate',
  'gi_pipes_amount',
  'gi_pipes_returned_qty',
  'plotfarm_qty',
  'plotfarm_rate',
  'plotfarm_amount',
  'erection_qty',
  'erection_rate',
  'erection_amount',
  'pipe_company_id',
  'geologist',
  'bank_name',
  'borecap_rate',
  'borecap_amount',
  'total_amount',
  'total_bill_amount',
  'first_part_amount',
  'second_part_amount',
  'it_percent',
  'it_amount',
  'vat_percent',
  'vat_amount',
  'total_recoveries',
  'net_amount',
  'voucher_no',
  'cheque_no',
  'cheque_date',
  'platform_date',
  'material_date',
  'received_date',
  'custom_data',
  'casing_type',
  'casing250_qty',
  'casing250_rate',
  'casing250_amount',
  'cylinders_qty',
  'cylinders_rate',
  'cylinders_amount',
  'stand_qty',
  'stand_rate',
  'stand_amount',
  'head_handle_qty',
  'head_handle_rate',
  'head_handle_amount',
  'pipe_company',
  'pipe_inventory_id',
  'labour_type',
  'labour_amount',
  'pcs',
  'gross_amount',
  'cgst_percent',
  'cgst_amt',
  'sgst_percent',
  'sgst_amt',
  'igst_percent',
  'igst_amt',
  'gst_percent',
  'gst_amt',
  'sas_percent',
  'sas_amt',
  'borecap_qty'
];

/**
 * Returns true when pipe_company_id column exists on BorewellWork.
 * Cached for the lifetime of the process / serverless warm-start.
 */
export async function hasPipeCompanyColumn() {
  if (_hasPipeCompanyCol !== null) return _hasPipeCompanyCol;

  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'BorewellWork'
        AND column_name = ANY(ARRAY[${REQUIRED_BOREWELLWORK_COLUMNS.map((_, i) => `'${REQUIRED_BOREWELLWORK_COLUMNS[i]}'`).join(', ')}])
    `);
    const present = new Set(rows.map((row) => row.column_name));
    _hasPipeCompanyCol = REQUIRED_BOREWELLWORK_COLUMNS.every((column) => present.has(column));
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

    // 5. Add remaining extended BorewellWork columns required by the form
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "BorewellWork"
        ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "vehicle" TEXT,
        ADD COLUMN IF NOT EXISTS "date" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "grant" TEXT,
        ADD COLUMN IF NOT EXISTS "estCost" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "status" TEXT,
        ADD COLUMN IF NOT EXISTS "remarks" TEXT,
        ADD COLUMN IF NOT EXISTS "drilling_depth_mtrs" DECIMAL(8,2),
        ADD COLUMN IF NOT EXISTS "drilling_rate" DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS "drilling_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "casing180_qty" INTEGER,
        ADD COLUMN IF NOT EXISTS "casing180_rate" DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS "casing180_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "casing140_qty" INTEGER,
        ADD COLUMN IF NOT EXISTS "casing140_rate" DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS "casing140_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "slotting_qty" INTEGER,
        ADD COLUMN IF NOT EXISTS "slotting_rate" DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS "slotting_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "pumpset_qty" INTEGER,
        ADD COLUMN IF NOT EXISTS "pumpset_rate" DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS "pumpset_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "gi_pipes_qty" INTEGER,
        ADD COLUMN IF NOT EXISTS "gi_pipes_rate" DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS "gi_pipes_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "gi_pipes_returned_qty" INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "plotfarm_qty" INTEGER,
        ADD COLUMN IF NOT EXISTS "plotfarm_rate" DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS "plotfarm_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "erection_qty" INTEGER,
        ADD COLUMN IF NOT EXISTS "erection_rate" DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS "erection_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "bank_name" TEXT,
        ADD COLUMN IF NOT EXISTS "borecap_qty" INTEGER,
        ADD COLUMN IF NOT EXISTS "borecap_rate" DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS "borecap_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "casing250_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "casing250_qty" INTEGER,
        ADD COLUMN IF NOT EXISTS "casing250_rate" DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS "casing_type" TEXT,
        ADD COLUMN IF NOT EXISTS "cgst_amt" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "cgst_percent" DECIMAL(5,2),
        ADD COLUMN IF NOT EXISTS "custom_data" JSONB,
        ADD COLUMN IF NOT EXISTS "cylinders_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "cylinders_qty" INTEGER,
        ADD COLUMN IF NOT EXISTS "cylinders_rate" DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS "gross_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "gst_amt" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "gst_percent" DECIMAL(5,2),
        ADD COLUMN IF NOT EXISTS "head_handle_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "head_handle_qty" INTEGER,
        ADD COLUMN IF NOT EXISTS "head_handle_rate" DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS "igst_amt" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "igst_percent" DECIMAL(5,2),
        ADD COLUMN IF NOT EXISTS "it_percent" DECIMAL(5,2),
        ADD COLUMN IF NOT EXISTS "it_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "labour_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "labour_type" TEXT,
        ADD COLUMN IF NOT EXISTS "material_date" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "pcs" DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS "pipe_company" TEXT,
        ADD COLUMN IF NOT EXISTS "pipe_inventory_id" INTEGER,
        ADD COLUMN IF NOT EXISTS "platform_date" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "received_date" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "sas_amt" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "sas_percent" DECIMAL(5,2),
        ADD COLUMN IF NOT EXISTS "sgst_amt" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "sgst_percent" DECIMAL(5,2),
        ADD COLUMN IF NOT EXISTS "stand_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "stand_qty" INTEGER,
        ADD COLUMN IF NOT EXISTS "stand_rate" DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS "total_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "total_bill_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "first_part_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "second_part_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "total_recoveries" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "net_amount" DECIMAL(14,2),
        ADD COLUMN IF NOT EXISTS "voucher_no" TEXT,
        ADD COLUMN IF NOT EXISTS "cheque_no" TEXT,
        ADD COLUMN IF NOT EXISTS "cheque_date" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "vat_percent" DECIMAL(5,2)
    `);

    await prisma.$executeRawUnsafe(`
      UPDATE "BorewellWork"
      SET "gi_pipes_returned_qty" = COALESCE("gi_pipes_returned_qty", 0)
      WHERE "gi_pipes_returned_qty" IS NULL
    `);

    // 6. Ensure optional pipe inventory FK exists
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_borewell_work_pipe_inventory_id'
            AND table_name      = 'BorewellWork'
        ) THEN
          ALTER TABLE "BorewellWork"
            ADD CONSTRAINT fk_borewell_work_pipe_inventory_id
            FOREIGN KEY ("pipe_inventory_id")
            REFERENCES "pipes_master"("id")
            ON DELETE SET NULL;
        END IF;
      END $$
    `);

    // 7. Verify — only cache success when all required columns truly exist
    const verify = await prisma.$queryRawUnsafe(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'BorewellWork'
        AND column_name = ANY(ARRAY[${REQUIRED_BOREWELLWORK_COLUMNS.map((_, i) => `'${REQUIRED_BOREWELLWORK_COLUMNS[i]}'`).join(', ')}])
    `);
    const present = new Set(verify.map((row) => row.column_name));
    _hasPipeCompanyCol = REQUIRED_BOREWELLWORK_COLUMNS.every((column) => present.has(column));

    if (_hasPipeCompanyCol) {
      console.log('Govt bore schema ensured');
    } else {
      console.warn('Govt bore schema: migration ran but some columns are still missing (possible permission issue)');
    }
  } catch (error) {
    console.error('Govt bore schema migration failed:', error?.message || error);
    _hasPipeCompanyCol = false;
  }
}

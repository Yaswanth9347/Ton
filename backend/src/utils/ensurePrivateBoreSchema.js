import prisma from '../config/prisma.js';

let _hasPrivateBoreSchema = null;

const REQUIRED_COLUMNS = [
  'date',
  'vehicle_name',
  'supervisor_name',
  'customer_name',
  'village',
  'phone_number',
  'bore_type',
  'drill_upto_casing_feet',
  'drill_upto_casing_rate',
  'drill_upto_casing_amt',
  'empty_drilling_feet',
  'empty_drilling_rate',
  'empty_drilling_amt',
  'jump_300_feet',
  'jump_300_rate',
  'jump_300_amt',
  'jump_400_feet',
  'jump_400_rate',
  'jump_400_amt',
  'total_drilling_feet',
  'total_drilling_amt',
  'cas140_feet',
  'cas140_rate',
  'cas140_amt',
  'cas180_4g_feet',
  'cas180_4g_rate',
  'cas180_4g_amt',
  'cas180_6g_feet',
  'cas180_6g_rate',
  'cas180_6g_amt',
  'cas250_4g_feet',
  'cas250_4g_rate',
  'cas250_4g_amt',
  'cas250_6g_feet',
  'cas250_6g_rate',
  'cas250_6g_amt',
  'slotting_pipes',
  'slotting_rate',
  'slotting_amt',
  'pipes_on_vehicle_before',
  'pipes_used_qty',
  'pipes_used_pieces_ft',
  'pipes_left_on_vehicle',
  'pipe_details',
  'custom_data',
  'pipe_inventory_id',
  'labour_charge',
  'rpm',
  'start_time',
  'end_time',
  'total_hrs',
  'phone_pe_received',
  'phone_pe_receiver_name',
  'cash_paid',
  'total_amount',
  'amount_paid',
  'balance',
  'discount',
  'created_by',
  'created_at',
  'updated_at'
];

async function hasPrivateBoreSchema() {
  if (_hasPrivateBoreSchema !== null) return _hasPrivateBoreSchema;

  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'borewell_data'
        AND column_name = ANY(ARRAY[${REQUIRED_COLUMNS.map((column) => `'${column}'`).join(', ')}])
    `);
    const present = new Set(rows.map((row) => row.column_name));
    _hasPrivateBoreSchema = REQUIRED_COLUMNS.every((column) => present.has(column));
  } catch {
    _hasPrivateBoreSchema = false;
  }

  return _hasPrivateBoreSchema;
}

export function resetPrivateBoreSchemaCache() {
  _hasPrivateBoreSchema = null;
}

export async function ensurePrivateBoreSchema() {
  if (await hasPrivateBoreSchema()) return;

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "borewell_data"
        ADD COLUMN IF NOT EXISTS "date" DATE,
        ADD COLUMN IF NOT EXISTS "vehicle_name" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "supervisor_name" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "customer_name" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "village" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "phone_number" VARCHAR(20),
        ADD COLUMN IF NOT EXISTS "bore_type" VARCHAR(20),
        ADD COLUMN IF NOT EXISTS "drill_upto_casing_feet" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "drill_upto_casing_rate" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "drill_upto_casing_amt" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "empty_drilling_feet" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "empty_drilling_rate" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "empty_drilling_amt" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "jump_300_feet" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "jump_300_rate" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "jump_300_amt" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "jump_400_feet" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "jump_400_rate" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "jump_400_amt" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "total_drilling_feet" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "total_drilling_amt" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cas140_feet" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cas140_rate" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cas140_amt" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cas180_4g_feet" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cas180_4g_rate" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cas180_4g_amt" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cas180_6g_feet" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cas180_6g_rate" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cas180_6g_amt" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cas250_4g_feet" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cas250_4g_rate" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cas250_4g_amt" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cas250_6g_feet" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cas250_6g_rate" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cas250_6g_amt" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "slotting_pipes" INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "slotting_rate" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "slotting_amt" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "pipes_on_vehicle_before" INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "pipes_used_qty" INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "pipes_used_pieces_ft" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "pipes_left_on_vehicle" INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "pipe_details" JSONB,
        ADD COLUMN IF NOT EXISTS "custom_data" JSONB,
        ADD COLUMN IF NOT EXISTS "pipe_inventory_id" INTEGER,
        ADD COLUMN IF NOT EXISTS "labour_charge" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "rpm" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "start_time" VARCHAR(20),
        ADD COLUMN IF NOT EXISTS "end_time" VARCHAR(20),
        ADD COLUMN IF NOT EXISTS "total_hrs" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "phone_pe_received" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "phone_pe_receiver_name" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "cash_paid" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "total_amount" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "amount_paid" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "balance" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "discount" DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "created_by" INTEGER,
        ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
    `);

    const verifyRows = await prisma.$queryRawUnsafe(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'borewell_data'
        AND column_name = ANY(ARRAY[${REQUIRED_COLUMNS.map((column) => `'${column}'`).join(', ')}])
    `);
    const present = new Set(verifyRows.map((row) => row.column_name));
    _hasPrivateBoreSchema = REQUIRED_COLUMNS.every((column) => present.has(column));
  } catch (error) {
    console.error('Private bore schema migration failed:', error?.message || error);
    _hasPrivateBoreSchema = false;
  }
}
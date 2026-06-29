/**
 * Migration: Add cas250_6g columns to borewell_data
 * Adds: cas250_6g_feet, cas250_6g_rate, cas250_6g_amt
 */
import db from '../src/models/db.js';

async function migrate() {
  console.log('[Migration] Adding cas250_6g columns to borewell_data...');
  try {
    await db.query(`
      ALTER TABLE borewell_data
        ADD COLUMN IF NOT EXISTS cas250_6g_feet  NUMERIC(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cas250_6g_rate  NUMERIC(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cas250_6g_amt   NUMERIC(10,2) DEFAULT 0;
    `);
    console.log('[Migration] ✅ cas250_6g columns added successfully.');
  } catch (err) {
    console.error('[Migration] ❌ Failed:', err.message);
    process.exit(1);
  } finally {
    await db.end?.();
    process.exit(0);
  }
}

migrate();

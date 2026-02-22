import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

async function runInventoryMigration() {
    console.log('Running inventory migration...');

    try {
        const sqlPath = path.join(__dirname, 'inventory_migration.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await pool.query(sql);
        console.log('✓ Inventory tables created successfully!');
        console.log('  - pipe_inventory');
        console.log('  - pipe_transactions');
        console.log('  - spares_inventory');
        console.log('  - spares_transactions');
        console.log('  - diesel_records');
    } catch (error) {
        console.error('Migration failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

runInventoryMigration().catch(() => process.exit(1));

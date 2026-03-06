import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5435/attendance_db';

async function runMigration() {
    const client = new pg.Client({ connectionString: DATABASE_URL });
    try {
        await client.connect();
        console.log('Connected to database');

        const sql = fs.readFileSync(
            path.join(__dirname, 'add_inventory_enhancements.sql'),
            'utf8'
        );

        await client.query(sql);
        console.log('✓ Inventory enhancement migration completed');

        // Verify new columns exist
        const check = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'pipes_master' AND column_name IN ('material_type','quality_grade','length_feet','cost_per_unit','reorder_level')
            ORDER BY column_name
        `);
        console.log('✓ Pipes new columns:', check.rows.map(r => r.column_name).join(', '));

        const check2 = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'spares_master' AND column_name IN ('brand','unit_type','cost_per_unit','reorder_level')
            ORDER BY column_name
        `);
        console.log('✓ Spares new columns:', check2.rows.map(r => r.column_name).join(', '));

        const check3 = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'spares_stock_transactions' AND column_name IN ('vehicle_name','supervisor_name')
            ORDER BY column_name
        `);
        console.log('✓ Spares txn new columns:', check3.rows.map(r => r.column_name).join(', '));

    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();

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
            path.join(__dirname, 'add_inventory_bore_allocations.sql'),
            'utf8'
        );

        await client.query(sql);
        console.log('✓ Inventory bore allocation migration completed');

        const checks = await Promise.all([
            client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'pipes_stock_transactions' AND column_name IN ('vehicle_name','supervisor_name','source_location','destination_location','supplier_name','purchase_mode','allocation_id') ORDER BY column_name`),
            client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'borewell_data' AND column_name IN ('pipe_inventory_id')`),
            client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'BorewellWork' AND column_name IN ('pipe_inventory_id')`),
            client.query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pipe_bore_allocations') AS exists`)
        ]);

        console.log('✓ Pipe txn columns:', checks[0].rows.map(r => r.column_name).join(', '));
        console.log('✓ Private bore columns:', checks[1].rows.map(r => r.column_name).join(', '));
        console.log('✓ Govt bore columns:', checks[2].rows.map(r => r.column_name).join(', '));
        console.log('✓ Allocation table exists:', checks[3].rows[0].exists);
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();

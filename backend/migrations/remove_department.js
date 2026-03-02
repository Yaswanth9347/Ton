import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;

// Get directory name since __dirname is not available in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('Starting department removal migration...');
        
        // Read the SQL file
        const sqlPath = path.join(__dirname, 'remove_department.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Begin transaction
        await client.query('BEGIN');
        
        // Execute the SQL
        console.log('Executing SQL to remove department column and table...');
        await client.query(sql);
        
        // Commit transaction
        await client.query('COMMIT');
        
        console.log('✅ Department removal migration completed successfully!');
    } catch (error) {
        // Rollback on error
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();

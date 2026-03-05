/**
 * run_prod_migration.js
 * 
 * Runs fix_missing_columns.sql against the DATABASE_URL in your environment.
 * Usage:
 *   DATABASE_URL="postgresql://user:pass@host:port/dbname" node migrations/run_prod_migration.js
 * 
 * Or set DATABASE_URL in your .env and run:
 *   node migrations/run_prod_migration.js
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('❌ DATABASE_URL is not set. Please set it before running this script.');
    process.exit(1);
}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

const sqlFile = path.join(__dirname, 'fix_missing_columns.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

const authSqlFile = path.join(__dirname, 'add_auth_security_columns.sql');
const authSql = fs.readFileSync(authSqlFile, 'utf8');

async function run() {
    console.log('🚀 Connecting to production database...');
    try {
        await pool.query(sql);
        console.log('✅ fix_missing_columns migration applied successfully!');
        console.log('   - pipes_company_master table ensured');
        console.log('   - BorewellWork.pipe_company_id column ensured');
        console.log('   - BorewellWork.geologist column ensured');
        console.log('   - Foreign key constraint ensured');

        await pool.query(authSql);
        console.log('✅ auth_security_columns migration applied successfully!');
        console.log('   - Login security columns added');
        console.log('   - Admin email updated');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        console.error(err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();

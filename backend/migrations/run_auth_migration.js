import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import dbConfig from '../src/config/database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;
const pool = new Pool(dbConfig);

async function runAuthMigration() {
    console.log('Running auth security migration...');

    try {
        const sql = fs.readFileSync(
            path.join(__dirname, 'add_auth_security_columns.sql'),
            'utf8'
        );

        await pool.query(sql);
        console.log('Auth security migration completed successfully!');
        console.log('Added columns: failed_login_attempts, account_locked, last_failed_login, reset_token, reset_token_expiry, created_by');
        console.log('Updated admin email to: yaswanthyerra2025@gmail.com');
    } catch (error) {
        console.error('Migration failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

runAuthMigration().catch(() => process.exit(1));

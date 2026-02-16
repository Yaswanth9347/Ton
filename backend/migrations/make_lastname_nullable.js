import pg from 'pg';
import dotenv from 'dotenv';
import dbConfig from '../src/config/database.js';

dotenv.config();

const { Pool } = pg;
const pool = new Pool(dbConfig);

async function run() {
    console.log('Running migration: make_last_name_nullable...');
    try {
        await pool.query('ALTER TABLE users ALTER COLUMN last_name DROP NOT NULL;');
        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error.message);
    } finally {
        await pool.end();
    }
}

run();

import pg from 'pg';
import dbConfig from '../config/database.js';

const { Pool } = pg;

const pool = new Pool(dbConfig);

// Test connection on startup
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

export default {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
    pool,
};

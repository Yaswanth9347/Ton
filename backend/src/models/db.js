import pg from 'pg';
import dbConfig from '../config/database.js';

const { Pool } = pg;

// Use a global variable to store the pool instance across hot reloads and function invocations
// This prevents "Too Many Connections" errors in serverless environments
let pool;

if (process.env.NODE_ENV === 'production') {
    pool = new Pool(dbConfig);
} else {
    if (!global.pgPool) {
        global.pgPool = new Pool(dbConfig);
    }
    pool = global.pgPool;
}

// Test connection on startup (only once per pool creation)
const connectListeners = pool.listenerCount('connect');
if (connectListeners === 0) {
    pool.on('connect', () => {
        console.log('Connected to PostgreSQL database');
    });

    pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
        process.exit(-1);
    });
}

export default {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
    pool,
};

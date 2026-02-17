import dotenv from 'dotenv';
dotenv.config();

let config;

if (process.env.DATABASE_URL) {
    const connectionString = process.env.DATABASE_URL;
    const needsSsl = /sslmode=require|ssl=true|ssl=1/i.test(connectionString);
    config = {
        connectionString,
        ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    };
} else {
    config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'attendance_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
    };
}

if (process.env.NODE_ENV !== 'production') {
    console.log('DB Config:', config.connectionString ? { connectionString: '****' } : { ...config, password: '****' });
}

export default config;

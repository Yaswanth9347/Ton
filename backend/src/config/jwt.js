import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production');
}

export default {
    secret: process.env.JWT_SECRET || 'dev-secret-do-not-use-in-prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
};

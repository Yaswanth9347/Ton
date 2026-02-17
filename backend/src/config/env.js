import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'PORT'
];

// Optional but recommended
const recommendedEnvVars = [
    'FRONTEND_URL',
    'NODE_ENV'
];

function validateEnv() {
    const missing = requiredEnvVars.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`MISSING REQUIRED ENV VARIABES: ${missing.join(', ')}`);
    }

    // Warn about recommended
    const missingRecommended = recommendedEnvVars.filter(key => !process.env[key]);
    if (missingRecommended.length > 0) {
        console.warn(`Warning: Missing recommended env variables: ${missingRecommended.join(', ')}`);
    }

    return {
        DATABASE_URL: process.env.DATABASE_URL,
        JWT_SECRET: process.env.JWT_SECRET,
        PORT: process.env.PORT || 3002,
        NODE_ENV: process.env.NODE_ENV || 'development',
        FRONTEND_URL: process.env.FRONTEND_URL,
        VERCEL_URL: process.env.VERCEL_URL
    };
}

const env = validateEnv();

export default env;

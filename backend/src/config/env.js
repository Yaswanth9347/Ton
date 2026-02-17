import dotenv from 'dotenv';
dotenv.config();

// Only DATABASE_URL and JWT_SECRET are truly required.
// PORT is NOT required on Vercel (Vercel manages ports internally).
const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET'
];

const recommendedEnvVars = [
    'FRONTEND_URL',
    'NODE_ENV'
];

function validateEnv() {
    const missing = requiredEnvVars.filter(key => !process.env[key]);

    // NEVER throw at module scope — it kills the Vercel function before
    // the handler can register, producing a silent CORS-like error.
    // Instead, log clearly so it shows up in Vercel Function Logs.
    if (missing.length > 0) {
        console.error(`[ENV] MISSING REQUIRED ENV VARIABLES: ${missing.join(', ')}`);
    }

    const missingRecommended = recommendedEnvVars.filter(key => !process.env[key]);
    if (missingRecommended.length > 0) {
        console.warn(`[ENV] Missing recommended env variables: ${missingRecommended.join(', ')}`);
    }

    return {
        DATABASE_URL: process.env.DATABASE_URL,
        JWT_SECRET: process.env.JWT_SECRET,
        PORT: process.env.PORT || 3002,
        NODE_ENV: process.env.NODE_ENV || 'development',
        FRONTEND_URL: process.env.FRONTEND_URL,
        VERCEL_URL: process.env.VERCEL_URL,
        isValid: missing.length === 0
    };
}

const env = validateEnv();

export default env;

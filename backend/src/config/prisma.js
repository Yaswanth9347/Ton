import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
    // Determine the base database URL (without connection parameters)
    const baseDbUrl = process.env.DATABASE_URL || '';
    
    // Serverless optimization: if running in production (Vercel), enforce connection pool limits
    // to prevent P2024 timeouts from exhausting the default pool
    let optimizedDbUrl = baseDbUrl;
    if (process.env.NODE_ENV === 'production' && !baseDbUrl.includes('connection_limit')) {
        const separator = baseDbUrl.includes('?') ? '&' : '?';
        optimizedDbUrl = `${baseDbUrl}${separator}connection_limit=20&pool_timeout=20`;
    }

    return new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        datasources: {
            db: { url: optimizedDbUrl }
        }
    });
};

const prisma = global.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma;
}

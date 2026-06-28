import prisma from '../config/prisma.js';

/**
 * Compatibility wrapper to route raw SQL queries through the Prisma client.
 * This ensures the application uses a single consolidated database connection pool,
 * eliminating the overhead and connection-limit exhaustion issues of having multiple pools.
 */
export default {
    query: async (text, params) => {
        try {
            const rows = await prisma.$queryRawUnsafe(text, ...(params || []));
            return {
                rows,
                rowCount: rows.length,
            };
        } catch (error) {
            console.error('[DB ADAPTER ERROR]:', error.message, 'Query:', text);
            throw error;
        }
    },

    // Deprecated methods maintained for safety/backward compatibility
    getClient: async () => {
        throw new Error('db.getClient() is deprecated. Use prisma.$transaction or raw prisma client queries instead.');
    },

    pool: {
        connect: async () => {
            throw new Error('db.pool.connect() is deprecated. Use prisma.$transaction or raw prisma client queries instead.');
        },
        end: async () => {
            // No-op
        },
        on: () => {
            // No-op
        },
        listenerCount: () => 0,
    }
};

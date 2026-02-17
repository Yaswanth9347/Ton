import '../src/config/env.js'; // Validate environment variables first
import app from '../src/app.js';

export default async function handler(req, res) {
    try {
        // Log environment for debugging (safely)
        console.log('Incoming request:', req.method, req.url);
        console.log('DB Config present:', !!process.env.DATABASE_URL);

        return app(req, res);
    } catch (error) {
        console.error('Server Startup Error:', error);

        // Manually set CORS headers so the error is visible to the frontend
        const origin = req.headers.origin;
        if (origin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
            res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
        }

        res.status(500).json({
            error: 'Server Startup Failed',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

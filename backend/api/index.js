import app from '../src/app.js';

export default async function handler(req, res) {
    try {
        // Log environment for debugging (safely)
        console.log('Incoming request:', req.method, req.url);
        console.log('DB Config present:', !!process.env.DATABASE_URL);

        return app(req, res);
    } catch (error) {
        console.error('Server Startup Error:', error);
        res.status(500).json({
            error: 'Server Startup Failed',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

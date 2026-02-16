import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

import payrollRoutes from './routes/payrollRoutes.js';
import govtBoreRoutes from './routes/govtBoreRoutes.js';
import boreRoutes from './routes/boreRoutes.js';
import { AppError } from './utils/errors.js';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import requestLogger from './middleware/requestLogger.js';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? (process.env.FRONTEND_URL || 'http://localhost:5173')
        : true, // Allow all origins in development for network access
    credentials: true,
}));
app.use(helmet()); // Security headers
app.use(express.json({ limit: '10mb' })); // Increased limit for bulk imports

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Higher limit in development
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' },
    skip: (req) => {
        // Skip rate limiting for health checks (path is relative to mount point /api)
        return req.path === '/health';
    }
});
app.use('/api', limiter);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestLogger);
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api/payroll', payrollRoutes);
app.use('/api/govt-bores', govtBoreRoutes);
app.use('/api/bores', boreRoutes);

// 404 handler
app.use((req, res, next) => {
    next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);

    // Default error values
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal server error';
    let status = err.status || 'error';

    // Handle specific error types
    if (err.code === '23505') {
        // PostgreSQL unique constraint violation
        statusCode = 409;
        message = 'Resource already exists';
        status = 'fail';
    } else if (err.code === '23503') {
        // PostgreSQL foreign key violation
        statusCode = 400;
        message = 'Invalid reference';
        status = 'fail';
    }

    // Don't leak error details in production
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        message = 'Something went wrong';
    }

    res.status(statusCode).json({
        success: false,
        status,
        message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
});

// Server startup logic moved to server.js for Vercel compatibility
// const PORT = process.env.PORT || 3002;
// app.listen(PORT, ...);

export default app;

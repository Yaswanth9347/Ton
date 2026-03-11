import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/authRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import boreRoutes from './routes/boreRoutes.js';
import govtBoreRoutes from './routes/govtBoreRoutes.js';
import payrollRoutes from './routes/payrollRoutes.js';
import inventoryRoutes from './routes/inventory.js';
import { ensureAuthSchema } from './utils/ensureAuthSchema.js';
import { ensureInventorySchema } from './utils/ensureInventorySchema.js';
import { ensureLoginAuditSchema } from './utils/ensureLoginAuditSchema.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const DEFAULT_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'Cache-Control',
  'Pragma',
  'Expires',
  'X-Requested-With',
  'Accept',
  'Origin',
  'Cookie',
];

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://ton-frontend-kappa.vercel.app',
  process.env.FRONTEND_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
].filter(Boolean);

function isAllowedLocalDevOrigin(origin) {
  if (process.env.NODE_ENV === 'production') return false;

  try {
    const { protocol, hostname, port } = new URL(origin);
    if (protocol !== 'http:') return false;

    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isPrivateLanIp = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostname);
    const isFrontendPort = port === '5173' || port === '3000';

    return isFrontendPort && (isLocalHost || isPrivateLanIp);
  } catch {
    return false;
  }
}

function isAllowedVercelPreviewOrigin(origin) {
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== 'https:') return false;

    // Allow Vercel preview deployments for the frontend project.
    // Preview hostnames look like:
    // ton-frontend-<hash>-yaswanths-projects-<id>.vercel.app
    return hostname.startsWith('ton-frontend-') && hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || isAllowedVercelPreviewOrigin(origin) || isAllowedLocalDevOrigin(origin)) {
      return callback(null, true);
    }

    console.warn('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: DEFAULT_ALLOWED_HEADERS,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Middleware
app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

ensureAuthSchema().catch((error) => {
  console.error('Auth schema ensure failed:', error?.message || error);
});

ensureLoginAuditSchema().catch((error) => {
  console.error('Login audit schema ensure failed:', error?.message || error);
});

ensureInventorySchema().catch((error) => {
  console.error('Inventory schema ensure failed:', error?.message || error);
});

// Serve uploads from correct directory based on environment
const uploadsDir = process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'backend',
    message: 'Use /api/* endpoints',
  });
});

app.get(['/favicon.ico', '/favicon.png'], (_req, res) => {
  res.status(204).end();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bores', boreRoutes);
app.use('/api/govt-bores', govtBoreRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/inventory', async (req, res, next) => {
  try {
    await ensureInventorySchema();
    next();
  } catch (error) {
    next(error);
  }
}, inventoryRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Safely determine a valid HTTP status code
  let code = 500;
  if (typeof err.statusCode === 'number' && err.statusCode >= 100 && err.statusCode < 600) {
    code = err.statusCode;
  } else if (typeof err.status === 'number' && err.status >= 100 && err.status < 600) {
    code = err.status;
  }

  // Guard against headers already sent
  if (res.headersSent) {
    return next(err);
  }

  res.status(code).json({
    status: 'fail',
    success: false,
    error: err.message || 'Internal server error',
    message: err.message || 'Internal server error'
  });
});

export default app;
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/authRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import boreRoutes from './routes/boreRoutes.js';
import govtBoreRoutes from './routes/govtBoreRoutes.js';
import payrollRoutes from './routes/payrollRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://ton-frontend-kappa.vercel.app',
  process.env.FRONTEND_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
].filter(Boolean);

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

    if (allowedOrigins.includes(origin) || isAllowedVercelPreviewOrigin(origin)) {
      return callback(null, true);
    }

    console.warn('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploads from correct directory based on environment
const uploadsDir = process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bores', boreRoutes);
app.use('/api/govt-bores', govtBoreRoutes);
app.use('/api/payroll', payrollRoutes);

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
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

export default app;
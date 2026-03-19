import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';

import authRoutes from './routes/auth';
import businessRoutes from './routes/businesses';
import customerRoutes from './routes/customers';
import documentRoutes from './routes/documents';
import cashbookRoutes from './routes/cashbook';
import reportRoutes from './routes/reports';
import settingsRoutes from './routes/settings';

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use(helmet({ contentSecurityPolicy: false }));

const corsOrigin = process.env.APP_URL
  ? [process.env.APP_URL]
  : ['http://localhost:5173', 'http://localhost:3000'];
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', limiter);

// Parsing
app.use(express.json());
app.use(cookieParser());
app.use(morgan('short'));

// Static files for uploads
const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(storagePath));

// Serve frontend static files (if built)
const publicPath = path.join(__dirname, 'public');
const hasPublicDir = fs.existsSync(publicPath);
if (hasPublicDir) {
  app.use(express.static(publicPath));
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/cashbook', cashbookRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', async (_req, res) => {
  const health: Record<string, unknown> = { status: 'ok', timestamp: new Date().toISOString() };
  try {
    const { prisma } = await import('./utils/prisma');
    await prisma.$queryRaw`SELECT 1`;
    health.database = 'connected';
  } catch {
    health.database = 'disconnected';
    health.warning = 'DATABASE_URL not configured — add a PostgreSQL database in Railway';
  }
  res.json(health);
});

// SPA fallback — serve index.html for all non-API routes
if (hasPublicDir) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'שגיאה פנימית בשרת' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend: ${hasPublicDir ? 'serving from ' + publicPath : 'NOT FOUND — run build first'}`);
});

export default app;

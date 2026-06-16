import cors from 'cors';
import express from 'express';
import { requireAuth } from './middleware/auth';
import { opsRouter } from './routes/ops';
import { exitPricesRouter } from './routes/exitPrices';
import { pricesRouter } from './routes/prices';
import { exportRouter } from './routes/exportData';
import { importRouter } from './routes/importData';

export function createApp() {
  const app = express();

  const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json());

  // Health check — no auth required, useful for Vercel/monitoring
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // All routes below require Authorization: Bearer <supabase_access_token>
  app.use('/api/ops', requireAuth, opsRouter);
  app.use('/api/exit-prices', requireAuth, exitPricesRouter);
  app.use('/api/prices', requireAuth, pricesRouter);
  app.use('/api/export', requireAuth, exportRouter);
  app.use('/api/import', requireAuth, importRouter);

  return app;
}

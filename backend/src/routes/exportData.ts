import { Router } from 'express';
import type { BackupPayload, Op, ExitPrices } from '../types';

export const exportRouter = Router();

// GET /api/export — generates the authenticated user's full backup JSON
exportRouter.get('/', async (req, res) => {
  const [opsResult, exitPricesResult] = await Promise.all([
    req.supabase!.from('ops').select('*').order('date', { ascending: true }),
    req.supabase!.from('exit_prices').select('coin_id, exit_price'),
  ]);

  if (opsResult.error) {
    res.status(500).json({ error: opsResult.error.message });
    return;
  }
  if (exitPricesResult.error) {
    res.status(500).json({ error: exitPricesResult.error.message });
    return;
  }

  const ops: Op[] = opsResult.data.map((row) => ({
    id: row.id,
    date: row.date,
    coinId: row.coin_id,
    symbol: row.symbol,
    name: row.name,
    type: row.type,
    qty: Number(row.qty),
    price: Number(row.price),
    fee: Number(row.fee),
    total: Number(row.total),
    platform: row.platform,
  }));

  const exitPrices: ExitPrices = {};
  for (const row of exitPricesResult.data) exitPrices[row.coin_id] = Number(row.exit_price);

  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    ops,
    exitPrices,
  };

  res.json(payload);
});

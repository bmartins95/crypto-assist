import { Router } from 'express';
import type { BackupPayload, Op, ExitPrices } from '../types';

export const exportRouter = Router();

// GET /api/export — gera o JSON completo de backup do usuário autenticado
exportRouter.get('/', async (req, res) => {
  const [opsResult, exitPricesResult] = await Promise.all([
    req.supabase!.from('ops').select('*').order('data', { ascending: true }),
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
    data: row.data,
    coinId: row.coin_id,
    symbol: row.symbol,
    name: row.name,
    tipo: row.tipo,
    qtd: Number(row.qtd),
    preco: Number(row.preco),
    taxa: Number(row.taxa),
    total: Number(row.total),
    plataforma: row.plataforma,
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

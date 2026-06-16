import { Router } from 'express';
import type { ExitPrices } from '../types';

export const exitPricesRouter = Router();

// GET /api/exit-prices — returns { coinId: exitPrice } for the user
exitPricesRouter.get('/', async (req, res) => {
  const { data, error } = await req.supabase!.from('exit_prices').select('coin_id, exit_price');

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const result: ExitPrices = {};
  for (const row of data as { coin_id: string; exit_price: number }[]) {
    result[row.coin_id] = Number(row.exit_price);
  }
  res.json(result);
});

// PUT /api/exit-prices — body: { coinId, exitPrice }
exitPricesRouter.put('/', async (req, res) => {
  const { coinId, exitPrice } = req.body as { coinId?: string; exitPrice?: number };
  if (!coinId || typeof exitPrice !== 'number') {
    res.status(400).json({ error: 'coinId and exitPrice are required.' });
    return;
  }

  if (exitPrice <= 0) {
    const { error } = await req
      .supabase!.from('exit_prices')
      .delete()
      .eq('coin_id', coinId)
      .eq('user_id', req.userId!);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(204).send();
    return;
  }

  const { error } = await req.supabase!.from('exit_prices').upsert({
    user_id: req.userId!,
    coin_id: coinId,
    exit_price: exitPrice,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(204).send();
});

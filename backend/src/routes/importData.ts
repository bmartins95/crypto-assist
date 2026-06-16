import { Router } from 'express';
import type { Op } from '../types';

export const importRouter = Router();

// POST /api/import — substitui ops e exit_prices do usuário pelos dados do backup
importRouter.post('/', async (req, res) => {
  const body = req.body as { ops?: Op[]; exitPrices?: Record<string, number> };
  if (!Array.isArray(body.ops)) {
    res.status(400).json({ error: 'Formato inválido: "ops" deve ser um array.' });
    return;
  }

  const supabase = req.supabase!;
  const userId = req.userId!;

  const { error: deleteOpsError } = await supabase.from('ops').delete().eq('user_id', userId);
  if (deleteOpsError) {
    res.status(500).json({ error: deleteOpsError.message });
    return;
  }

  if (body.ops.length > 0) {
    const rows = body.ops.map((op) => ({
      user_id: userId,
      data: op.data,
      coin_id: op.coinId,
      symbol: op.symbol,
      name: op.name,
      tipo: op.tipo,
      qtd: op.qtd,
      preco: op.preco,
      taxa: op.taxa,
      total: op.total,
      plataforma: op.plataforma,
    }));
    const { error: insertOpsError } = await supabase.from('ops').insert(rows);
    if (insertOpsError) {
      res.status(500).json({ error: insertOpsError.message });
      return;
    }
  }

  if (body.exitPrices) {
    const { error: deleteExitError } = await supabase.from('exit_prices').delete().eq('user_id', userId);
    if (deleteExitError) {
      res.status(500).json({ error: deleteExitError.message });
      return;
    }
    const exitRows = Object.entries(body.exitPrices)
      .filter(([, price]) => price > 0)
      .map(([coinId, price]) => ({ user_id: userId, coin_id: coinId, exit_price: price }));
    if (exitRows.length > 0) {
      const { error: insertExitError } = await supabase.from('exit_prices').insert(exitRows);
      if (insertExitError) {
        res.status(500).json({ error: insertExitError.message });
        return;
      }
    }
  }

  res.status(204).send();
});

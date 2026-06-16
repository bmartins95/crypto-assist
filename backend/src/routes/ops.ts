import { Router } from 'express';
import type { Op } from '../types';

export const opsRouter = Router();

// Row as it comes from Postgres (snake_case) -> shape used by the API (camelCase).
interface OpRow {
  id: string;
  date: string;
  coin_id: string;
  symbol: string;
  name: string;
  type: 'Compra' | 'Venda';
  qty: number;
  price: number;
  fee: number;
  total: number;
  platform: string;
}

function rowToOp(row: OpRow): Op {
  return {
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
  };
}

function opToRow(op: Omit<Op, 'id'>, userId: string) {
  return {
    user_id: userId,
    date: op.date,
    coin_id: op.coinId,
    symbol: op.symbol,
    name: op.name,
    type: op.type,
    qty: op.qty,
    price: op.price,
    fee: op.fee,
    total: op.total,
    platform: op.platform,
  };
}

// GET /api/ops — lists the authenticated user's operations
opsRouter.get('/', async (req, res) => {
  const { data, error } = await req
    .supabase!.from('ops')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json((data as OpRow[]).map(rowToOp));
});

// POST /api/ops — creates an operation
opsRouter.post('/', async (req, res) => {
  const body = req.body as Partial<Op>;
  if (!body.date || !body.coinId || !body.type) {
    res.status(400).json({ error: 'Missing required fields.' });
    return;
  }

  const { data, error } = await req
    .supabase!.from('ops')
    .insert(opToRow(body as Omit<Op, 'id'>, req.userId!))
    .select('*')
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(201).json(rowToOp(data as OpRow));
});

// PUT /api/ops/:id — updates an existing operation
opsRouter.put('/:id', async (req, res) => {
  const body = req.body as Partial<Op>;
  const { data, error } = await req
    .supabase!.from('ops')
    .update(opToRow(body as Omit<Op, 'id'>, req.userId!))
    .eq('id', req.params.id)
    .select('*')
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: 'Operation not found.' });
    return;
  }
  res.json(rowToOp(data as OpRow));
});

// DELETE /api/ops/:id — removes an operation
opsRouter.delete('/:id', async (req, res) => {
  const { error } = await req.supabase!.from('ops').delete().eq('id', req.params.id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(204).send();
});

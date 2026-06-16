import { Router } from 'express';
import type { Op } from '../types';

export const opsRouter = Router();

// Linha como vem do Postgres (snake_case) → forma usada pela API (camelCase).
interface OpRow {
  id: string;
  data: string;
  coin_id: string;
  symbol: string;
  name: string;
  tipo: 'Compra' | 'Venda';
  qtd: number;
  preco: number;
  taxa: number;
  total: number;
  plataforma: string;
}

function rowToOp(row: OpRow): Op {
  return {
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
  };
}

function opToRow(op: Omit<Op, 'id'>, userId: string) {
  return {
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
  };
}

// GET /api/ops — lista as operações do usuário autenticado
opsRouter.get('/', async (req, res) => {
  const { data, error } = await req
    .supabase!.from('ops')
    .select('*')
    .order('data', { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json((data as OpRow[]).map(rowToOp));
});

// POST /api/ops — cria uma operação
opsRouter.post('/', async (req, res) => {
  const body = req.body as Partial<Op>;
  if (!body.data || !body.coinId || !body.tipo) {
    res.status(400).json({ error: 'Campos obrigatórios faltando.' });
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

// PUT /api/ops/:id — atualiza uma operação existente
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
    res.status(404).json({ error: 'Operação não encontrada.' });
    return;
  }
  res.json(rowToOp(data as OpRow));
});

// DELETE /api/ops/:id — remove uma operação
opsRouter.delete('/:id', async (req, res) => {
  const { error } = await req.supabase!.from('ops').delete().eq('id', req.params.id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.status(204).send();
});

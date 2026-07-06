import { describe, it, expect, beforeEach } from 'vitest';
import { getLegacyOps } from './storage';

const PT_OP = {
  data: '2026-06-10',
  coinId: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  tipo: 'Compra',
  qtd: 0.5,
  preco: 300000,
  taxa: 10,
  total: 150010,
  plataforma: 'Binance',
};

const EN_OP = {
  id: 'ed07a9d9-0717-4542-b888-b201def19623',
  date: '2026-06-15',
  coinId: 'ethereum',
  symbol: 'ETH',
  name: 'Ethereum',
  type: 'Compra',
  qty: 0.00137,
  price: 9162.92,
  fee: 0,
  total: 12.5532004,
  platform: 'MetaMask',
};

describe('getLegacyOps', () => {
  beforeEach(() => localStorage.clear());

  it('returns empty array when nothing is stored', () => {
    expect(getLegacyOps()).toEqual([]);
  });

  it('normalizes Portuguese-era ops to the NewOp shape', () => {
    localStorage.setItem('cp_ops', JSON.stringify([PT_OP]));
    expect(getLegacyOps()).toEqual([{
      date: '2026-06-10', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin',
      type: 'Buy', qty: 0.5, price: 300000, fee: 10, total: 150010, platform: 'Binance',
    }]);
  });

  it('maps Compra/Venda type values on English-era ops and drops the id', () => {
    localStorage.setItem('cp_ops', JSON.stringify([EN_OP, { ...EN_OP, type: 'Venda' }]));
    const ops = getLegacyOps();
    expect(ops.map(o => o.type)).toEqual(['Buy', 'Sell']);
    expect(ops[0]).not.toHaveProperty('id');
  });

  it('passes through current Buy/Sell ops unchanged', () => {
    localStorage.setItem('cp_ops', JSON.stringify([{ ...EN_OP, type: 'Sell' }]));
    expect(getLegacyOps()[0].type).toBe('Sell');
  });

  it('defaults missing fee and platform', () => {
    const { taxa, plataforma, ...rest } = PT_OP;
    void taxa; void plataforma;
    localStorage.setItem('cp_ops', JSON.stringify([rest]));
    const [op] = getLegacyOps();
    expect(op.fee).toBe(0);
    expect(op.platform).toBe('');
  });

  it('drops entries that cannot be normalized', () => {
    localStorage.setItem('cp_ops', JSON.stringify([
      PT_OP,
      { tipo: 'Aluguel', coinId: 'bitcoin' },
      { ...PT_OP, qtd: 'not-a-number' },
      'garbage',
      null,
    ]));
    expect(getLegacyOps()).toHaveLength(1);
  });

  it('returns empty array for corrupt or non-array storage', () => {
    localStorage.setItem('cp_ops', '{not json');
    expect(getLegacyOps()).toEqual([]);
    localStorage.setItem('cp_ops', '{"a":1}');
    expect(getLegacyOps()).toEqual([]);
  });
});

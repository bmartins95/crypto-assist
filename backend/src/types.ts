// Types shared with the frontend (web/src/lib/types.ts).
// Once the mobile/ project exists, this should become a `shared/` package.

export type OpType = 'Compra' | 'Venda';

export interface Op {
  id: string;
  date: string; // YYYY-MM-DD
  coinId: string;
  symbol: string;
  name: string;
  type: OpType;
  qty: number;
  price: number;
  fee: number;
  total: number;
  platform: string;
}

export type ExitPrices = Record<string, number>;

export type Prices = Record<string, number>;

export interface BackupPayload {
  version: number;
  exportedAt: string;
  ops: Op[];
  prices?: Prices;
  pricesTime?: string | null;
  exitPrices?: ExitPrices;
}

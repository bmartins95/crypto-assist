// Tipos compartilhados com o frontend (web/src/lib/types.ts).
// Quando o projeto mobile/ existir, isso deve virar um pacote `shared/`.

export type OpTipo = 'Compra' | 'Venda';

export interface Op {
  id: string;
  data: string; // YYYY-MM-DD
  coinId: string;
  symbol: string;
  name: string;
  tipo: OpTipo;
  qtd: number;
  preco: number;
  taxa: number;
  total: number;
  plataforma: string;
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

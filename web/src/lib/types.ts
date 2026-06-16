export interface Op {
  data: string;
  coinId: string;
  symbol: string;
  name: string;
  tipo: 'Compra' | 'Venda';
  qtd: number;
  preco: number;
  taxa: number;
  total: number;
  plataforma: string;
}

export interface Asset {
  coinId: string;
  symbol: string;
  name: string;
  qty: number;
  avgPrice: number;
  exitPrice: number;
}

export interface AssetWithPlatform extends Omit<Asset, 'exitPrice'> {
  plataforma: string;
}

export type Prices = Record<string, number>;
export type AvatarCache = Record<string, { url: string }>;
export type ExitPrices = Record<string, number>;
export type GroupMode = 'ativo' | 'plataforma' | 'ambos';
export type ChartType = 'por-ativo' | 'no-tempo' | 'valor';
export type TabType = 'carteira' | 'lucro' | 'historico';

export interface BackupPayload {
  version: number;
  exportedAt: string;
  ops: Op[];
  prices: Prices;
  pricesTime: string | null;
  exitPrices: ExitPrices;
}

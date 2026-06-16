export interface Op {
  date: string;
  coinId: string;
  symbol: string;
  name: string;
  type: 'Compra' | 'Venda';
  qty: number;
  price: number;
  fee: number;
  total: number;
  platform: string;
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
  platform: string;
}

export type Prices = Record<string, number>;
export type AvatarCache = Record<string, { url: string }>;
export type ExitPrices = Record<string, number>;
export type GroupMode = 'asset' | 'platform' | 'both';
export type ChartType = 'by-asset' | 'over-time' | 'value';
export type TabType = 'wallet' | 'profit' | 'history';

export interface BackupPayload {
  version: number;
  exportedAt: string;
  ops: Op[];
  prices: Prices;
  pricesTime: string | null;
  exitPrices: ExitPrices;
}

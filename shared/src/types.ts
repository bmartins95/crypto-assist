// Fields needed to create an operation — the backend assigns the `id`.
export interface NewOp {
  date: string;
  coinId: string;
  symbol: string;
  name: string;
  type: 'Buy' | 'Sell';
  qty: number;
  price: number;
  fee: number;
  total: number;
  platform: string;
}

// An operation as stored/returned by the backend (always has an id).
export interface Op extends NewOp {
  id: string;
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

// Response shape of GET /api/prices — price plus (optionally) the coin's avatar image.
export interface PriceInfo {
  price: number;
  image?: string;
}
export type MarketPrices = Record<string, PriceInfo>;

export interface BackupPayload {
  version: number;
  exportedAt: string;
  ops: NewOp[];
  prices?: Prices;
  pricesTime?: string | null;
  exitPrices?: ExitPrices;
}

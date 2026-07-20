export type Currency = 'BRL' | 'USD' | 'EUR' | 'GBP' | 'JPY';

export type Leverage = 2 | 3 | 5 | 10;

// Units of each currency per 1 USD; USD is always 1.
export type ExchangeRates = Record<Currency, number>;

// Response shape of GET /api/exchange-rates.
export interface ExchangeRatesPayload {
  rates: ExchangeRates;
  updatedAt: string;
}

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
  // Both set together, or both absent (no platform selected) — see Platform in ./platforms.
  platformId?: string;
  platformName?: string;
  // Denomination of price/fee/total; absent means BRL (pre-multi-currency ops).
  currency?: Currency;
  // Only settable on a brand-new, non-closing Buy or Sell; absent means 1x (unleveraged).
  leverage?: Leverage;
}

// An operation as stored/returned by the backend (always has an id).
export interface Op extends NewOp {
  id: string;
}

// Links a later operation (closingOpId) to an earlier one (sourceOpId) it fully or
// partially closes. qtyClosed/realizedPnl are frozen at creation time — see
// shared/src/positions.ts for how status and P/L are derived from these.
export interface OpClosure {
  id: string;
  sourceOpId: string;
  closingOpId: string;
  qtyClosed: number;
  realizedPnl: number;
}

export type PositionStatus = 'open' | 'partial' | 'closed';

export interface Asset {
  coinId: string;
  symbol: string;
  name: string;
  qty: number;
  avgPrice: number;
  exitPrice: number;
}

export interface AssetWithPlatform extends Omit<Asset, 'exitPrice'> {
  platformId: string;
  platformName: string;
}

export type Prices = Record<string, number>;
export type AvatarCache = Record<string, { url: string }>;
export type ExitPrices = Record<string, number>;
export type GroupMode = 'asset' | 'platform' | 'both';
export type ChartType = 'by-asset' | 'over-time' | 'value';

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

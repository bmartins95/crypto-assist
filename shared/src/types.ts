export type Currency = 'BRL' | 'USD' | 'EUR' | 'GBP' | 'JPY';

// An integer leverage multiple. Fixed presets (2/3/5/10) or a custom value —
// validated as 2-125 server-side (backend/app/models.py's LeverageValue).
export type Leverage = number;

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
  // Shared by the two legs of a wallet swap so deleting either leg deletes the whole
  // swap. Absent for single Buy/Sell ops and for trade ops (a trade close is always a
  // single plain Buy/Sell, never a swap — see docs/PLAN.md Item 28).
  tradeGroupId?: string;
  // 'wallet' (movement of held assets) or 'trade' (leveraged speculative position).
  // Fixed at creation — never changeable via edit. Defaults to 'wallet'.
  kind?: 'wallet' | 'trade';
  // Trade direction, derived server-side from `type` when kind is 'trade'
  // ('Buy' -> 'long', 'Sell' -> 'short'). Absent for wallet ops.
  side?: 'long' | 'short';
}

// An operation as stored/returned by the backend (always has an id).
export interface Op extends NewOp {
  id: string;
  // Real DB insertion time (ISO 8601) — breaks ties between same-date wallet ops in
  // FIFO balance calculations (shared/src/walletFifo.ts), which `date` alone can't
  // since it has no time-of-day component. Optional: locally-built preview/proposed
  // Op objects that never round-trip through the API don't have one.
  createdAt?: string;
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

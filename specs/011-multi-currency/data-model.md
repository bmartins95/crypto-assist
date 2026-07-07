# Data Model: Multi-currency display

## Shared TypeScript types (`shared/src/types.ts`)

```ts
export type Currency = 'BRL' | 'USD' | 'EUR' | 'GBP' | 'JPY';

// Units of each currency per 1 USD. USD is always 1.
export type ExchangeRates = Record<Currency, number>;

export interface NewOp {
  // ...existing fields...
  currency?: Currency;   // absent ⇒ 'BRL' (pre-feature ops)
}
```

## Database

### `ops` (existing — additive change)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| currency | varchar(8) | NOT NULL DEFAULT 'BRL', CHECK IN ('BRL','USD','EUR','GBP','JPY') | denomination of `price`, `fee`, `total` |

### `price_cache` (existing — rename)

| Column | Type | Notes |
|--------|------|-------|
| price_usd | numeric(30,10) | renamed from `price_brl`; all rows force-expired by the migration |

### `exchange_rates` (new)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| currency_code | varchar(8) | PRIMARY KEY | 'BRL','EUR','GBP','JPY','USD' |
| rate_vs_usd | numeric(18,8) | NOT NULL | units of currency per 1 USD; USD row = 1 |
| updated_at | timestamptz | NOT NULL | freshness for the 1 h TTL |

### Migration `005_usd_prices_and_currency.sql`

1. `ALTER TABLE price_cache RENAME COLUMN price_brl TO price_usd;` (idempotence guard: only if old column exists)
2. `UPDATE price_cache SET updated_at = to_timestamp(0);` — force-expire BRL-era values
3. `CREATE TABLE IF NOT EXISTS exchange_rates (...);`
4. `ALTER TABLE ops ADD COLUMN IF NOT EXISTS currency varchar(8) NOT NULL DEFAULT 'BRL';` + CHECK constraint

`schema.sql` is updated to match for fresh databases.

## Backend models (`app/models.py`)

- `NewOp.currency: Literal['BRL','USD','EUR','GBP','JPY'] = 'BRL'` (validated at the boundary)
- `Op` inherits; `ImportOp` inherits (legacy backups lack the key → default 'BRL')
- Export rows include `currency`

## Conversion invariants

- `rate_vs_usd[c]` = units of `c` per 1 USD; `rate_vs_usd['USD'] = 1`.
- Op amount → USD: `usd = amount / rate_vs_usd[op.currency ?? 'BRL']`
- USD → display: `display = usd * rate_vs_usd[displayCurrency]`
- `convertOpsToUsd(ops, rates)` converts `price`, `fee`, `total`; `qty` and all non-monetary fields pass through; returned ops carry `currency: 'USD'`.

## Client state

| Store | Key | Value |
|-------|-----|-------|
| localStorage (web) | `crypto-assist:currency` | selected `Currency`, default `'BRL'` |
| localStorage (web) | `crypto-assist:exchange-rates` | last good `ExchangeRates` JSON (offline fallback) |
| AsyncStorage (mobile) | same two keys | same semantics |

`ratesStatus`: `'fresh' | 'stale' | 'unavailable'` — drives the FR-009 status message.

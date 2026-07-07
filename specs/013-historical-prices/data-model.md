# Data Model: Historical Charts + Timeframe Selector

## Historical Price Record (`price_history` table)

One coin's closing price on one calendar date.

| Field       | Type            | Notes                                              |
|-------------|-----------------|-----------------------------------------------------|
| `coin_id`   | `text`          | CoinGecko coin id, e.g. `bitcoin`                   |
| `date`      | `date`          | Calendar date (UTC) the price applies to            |
| `price_usd` | `numeric(30,10)`| Price in USD, consistent with `price_cache.price_usd` |

**Primary key**: `(coin_id, date)` — one row per coin per day.

**Lifecycle**: Rows for any date before "today" (UTC) are immutable once written — no TTL, no
update path. A row for "today" may be overwritten by a later request that re-fetches it (accepted
staleness, see research.md). Rows are never deleted by application code.

**SQL** (added to `backend/db/schema.sql`, and mirrored in
`backend/db/migrations/006_price_history.sql` for already-deployed databases, following the same
pattern `exchange_rates` used in migration `005_usd_prices_and_currency.sql`):

```sql
CREATE TABLE IF NOT EXISTS price_history (
    coin_id     text           NOT NULL,
    date        date           NOT NULL,
    price_usd   numeric(30,10) NOT NULL,
    PRIMARY KEY (coin_id, date)
);
```

## Timeframe Selection (client-side, not persisted server-side)

| Field   | Type                                    | Notes                                            |
|---------|------------------------------------------|---------------------------------------------------|
| value   | `'1d' \| '1w' \| '1m' \| '1y' \| 'all'`   | Controlled by `TimeframeSelector`                  |

Persisted in `localStorage` under `profit_timeframe` (web only, per `PLAN.md`), defaulting to
`'1m'`. Not stored server-side — same pattern as `price_refresh_interval`.

## `computeTimeline` signature change

`shared/src/portfolio.ts`:

```ts
export interface TimelinePoint {
  date: string;
  invested: number;
  currentValue: number;
  pnl: number;
}

export function computeTimeline(
  ops: Op[],
  historicalPrices: Record<string, Record<string, number>>,
  from?: string,
  to?: string,
): TimelinePoint[]
```

- `historicalPrices[coinId][date]` — `date` is `YYYY-MM-DD`, matching the API response shape.
- `from`/`to` default to the date of the earliest op and today (UTC), respectively, when omitted —
  i.e. omitting both still produces the full, correctly-priced history at daily granularity
  (used by the "All" timeframe).
- Algorithm: sort ops ascending; replay ops with `date < from` silently to seed starting
  `holdings` (qty + avgCost per coin) without emitting points for them; then, for each calendar
  day from `from` to `to` inclusive, apply any ops dated exactly that day (in order), look up each
  held coin's price for that day via the fallback rule below, and push one `TimelinePoint`.
- Price lookup per (coinId, day): try `historicalPrices[coinId][day]`; if absent, scan backward
  up to 7 days for the nearest earlier available date; if still absent, price is `0` for that
  coin on that day (FR-003).
- A coin only ever contributes a non-zero `qty` from the day of its first `Buy` onward — since
  `holdings` starts at `qty: 0` and only changes via replayed ops, FR-008 ("never before
  acquisition") holds by construction.

## `GET /api/prices/history` response shape

```ts
type PriceHistoryResponse = Record<string /* coinId */, Record<string /* YYYY-MM-DD */, number>>;
```

Matches `historicalPrices` above directly — no client-side reshaping needed.

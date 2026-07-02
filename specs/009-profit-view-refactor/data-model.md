# Data Model: Profit View Redesign

No database schema or backend model changes. This feature is presentation plus one new
pure-function shape in `shared/src/portfolio.ts`.

## AssetProfit (new)

Return type of `computeProfitByAsset(ops: Op[], prices: Prices): AssetProfit[]`.

| Field | Type | Description |
|---|---|---|
| `coinId` | `string` | Coin identifier, matches `Op.coinId` |
| `symbol` | `string` | Ticker, e.g. `BTC` |
| `name` | `string` | Display name, e.g. `Bitcoin` |
| `investedOpen` | `number` | Cost basis (avg-cost method) of the currently open quantity |
| `currentValue` | `number` | `qtyOpen * prices[coinId]` (0 if no price available) |
| `unrealizedPnl` | `number` | `currentValue - investedOpen`; 0 when `qtyOpen` is 0 |
| `unrealizedPct` | `number` | `investedOpen > 0 ? unrealizedPnl / investedOpen * 100 : 0` |
| `realizedPnl` | `number` | Sum over all sold lots of `qtySold * (sellPrice - avgCostAtSaleTime)` |
| `hasOpenPosition` | `boolean` | `qtyOpen > 1e-9` — gates eligibility for best/worst ranking (FR-005) |
| `hasPrice` | `boolean` | `prices[coinId] > 0` — gates whether unrealized figures are displayable |

**Validation / invariants**:
- One entry per distinct `coinId` present in `ops` (mirrors `computePositions`), including assets that are now fully closed (`hasOpenPosition: false`), unlike `computePositions` which drops them.
- `realizedPnl` is computed from the running average cost at the time of each sell (average-cost method, consistent with `computePositions`/`computeTimeline`), not FIFO.
- Ops with an empty `coinId` are ignored (same rule as every other function in `portfolio.ts`).

**Derived aggregate values used by the Profit view** (computed by the component from the `AssetProfit[]` array, not stored):
- Total realized P/L = `sum(realizedPnl)` across all entries.
- Total unrealized P/L = `sum(unrealizedPnl)` across entries where `hasPrice`.
- Best/worst asset = max/min `unrealizedPct` among entries where `hasOpenPosition && hasPrice`; `null` when no such entry exists (empty state, FR-013).
- Allocation panel fraction per asset = `investedOpen / sum(investedOpen across all entries with hasOpenPosition)`.

No new entities are introduced to `shared/src/types.ts` — `AssetProfit` is a return-type interface local to `portfolio.ts`, following the existing pattern of `TimelinePoint`.

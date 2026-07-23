# Data Model: Per-Asset Charts & Enriched Tooltips

All entities below are derived, client-side view models built from the existing `Op`, `OpClosure`, and `Prices` types in `shared/src/types.ts` — no new persisted/backend entity is introduced (Technical Context: Storage = N/A).

## AssetPeriodSeries (new — `shared/src/portfolio.ts`)

One per held asset, for the currently-selected timeframe (1D/1W/1M/1Y/All), backing both the Component A overlay and each Component B list row's sparkline.

| Field | Type | Notes |
|---|---|---|
| `coinId` | `string` | Matches `Asset.coinId` |
| `symbol` | `string` | Display ticker, e.g. `BTC` |
| `name` | `string` | Display name, e.g. `Bitcoin` |
| `price` | `number` | Latest price in the active currency |
| `pctChange` | `number` | Period % change — last point of the normalized series (FR spec: first point defined as 0%, not `(last-first)/first`) |
| `series` | `number[]` | Cumulative % change per day in the period, index-aligned with the shared timeline's dates; empty when no price history exists for the period (Edge Cases: renders the existing empty-state, not `NaN`) |

**Validation rules**: `series.length >= 1` when `hasPrice` per-day data exists for at least one day; when it does not, `AssetPeriodSeries.series` is `[]` and callers render the existing "no price data" empty state instead of a sparkline. `pctChange` is `0` (not `NaN`) when `series.length < 2`.

## ComparisonSelection (new — `web/src/components/ProfitTab.tsx` local/persisted state)

The Component A "Compare with" choice, one instance per chart (`over-time`, `value`).

| Field | Type | Notes |
|---|---|---|
| `chart` | `'over-time' \| 'value'` | Which chart this selection applies to (matches existing `ChartType` minus `'by-asset'`, which has no time axis to overlay) |
| `coinId` | `string \| null` | `null` = "Nenhum" (no overlay); otherwise a `coinId` present in the current portfolio |

**Validation rules**: If the persisted `coinId` no longer corresponds to a currently-held asset (position fully closed — Edge Cases), the effective selection falls back to `null` at render time rather than being cleared from storage, so re-opening a previously-held asset restores the comparison.

**Persistence**: `localStorage`, keyed `profit_compare_asset_${chart}` (research.md §5), following the existing `TIMEFRAME_STORAGE_KEY` pattern.

## DaySnapshot (extends existing `TimelinePoint` — `shared/src/portfolio.ts`)

Extends the current `TimelinePoint` (`{ date, invested, currentValue, pnl }`) with the fields the enriched Profit tooltip (FR-009) and cross-component hover sync (FR-010) require. Additive change — existing fields are unchanged, so existing consumers of `TimelinePoint` are unaffected.

| Field | Type | Notes |
|---|---|---|
| `date` | `string` | *(existing)* ISO date |
| `invested` | `number` | *(existing)* |
| `currentValue` | `number` | *(existing)* |
| `pnl` | `number` | *(existing)* cumulative profit, realized + unrealized |
| `realizedPnl` | `number` | **new** — cumulative realized P/L as of this day |
| `unrealizedPnl` | `number` | **new** — `pnl - realizedPnl` as of this day (derivable, but stored to match the FR-009 tooltip's exact "Realizado"/"Não realizado" rows without re-deriving in the UI layer) |
| `dayDeltaAbs` | `number` | **new** — `pnl - previousDay.pnl` (0 for the first point in range — Edge Cases) |
| `dayDeltaPct` | `number` | **new** — `dayDeltaAbs / abs(previousDay.pnl)` as a percent; `0` when the previous point's `pnl` is `0` (avoids divide-by-zero, matches Edge Cases' "no NaN%" rule) |
| `opsCount` | `number` | **new** — count of operations dated exactly this day (0 is valid — Edge Cases) |
| `assetContribution` | `{ coinId: string; symbol: string; deltaAbs: number }[]` | **new** — each held asset's contribution to `dayDeltaAbs`, sorted by absolute contribution descending; consumed by Components A/B for FR-010's hover sync, never rendered inside the tooltip itself (FR-009) |

**Validation rules**: `unrealizedPnl = pnl - realizedPnl` must hold for every point (test as an invariant). `assetContribution` sums (by `deltaAbs`) to `dayDeltaAbs` for a day with any operations; for a day with zero price movement and zero operations, `assetContribution` is `[]`.

## PortfolioValueSnapshot (new fields on the existing value-chart tooltip data — no new shared type; computed in `ProfitTab.tsx` from existing `TimelinePoint`/`DaySnapshot` fields)

Backs the FR-011 Portfolio-value tooltip.

| Field | Type | Notes |
|---|---|---|
| `currentValue` | `number` | *(existing `TimelinePoint.currentValue`)* |
| `invested` | `number` | *(existing `TimelinePoint.invested`)* |
| `unrealizedResultAbs` | `number` | `currentValue - invested` |
| `unrealizedResultPct` | `number` | `unrealizedResultAbs / invested`; `0` when `invested` is `0` |
| `dayVariationAbs` | `number` | `currentValue - previousDay.currentValue`; `0` for the first point in range |

No new validation beyond the shared divide-by-zero guards above.

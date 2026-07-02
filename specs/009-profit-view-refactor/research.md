# Research: Profit View Redesign

## R1 — Charting library

**Decision**: Continue using `chart.js` (already a dependency, already used by `ProfitTab.tsx` for all three chart modes including a working divergent bar chart with sign-based coloring).

**Rationale**: The original plan item text (written before item 7 landed) suggested Recharts, but `web/package.json` has no `recharts` dependency and `ProfitTab.tsx` already implements `by-asset` (bar), `over-time` (line), and `value` (line) modes with Chart.js, including per-bar coloring by sign (`backgroundColor: withPrice.map(d => d.l >= 0 ? '#1D9E75' : '#E24B4A')`). Constitution IV requires checking existing dependencies before adding a package; Chart.js already satisfies every charting requirement in the spec.

**Alternatives considered**: Recharts — rejected, would be a redundant second charting dependency for functionality Chart.js already provides.

## R2 — Realized/unrealized P/L computation

**Decision**: Add a new function `computeProfitByAsset(ops: Op[], prices: Prices): AssetProfit[]` to `shared/src/portfolio.ts` that, per asset, tracks lots under the average-cost method and splits P/L into a realized component (from quantity that has been sold) and an unrealized component (from remaining open quantity), rather than reusing the current ad-hoc formula in `ProfitTab.tsx`.

**Rationale**: The current code computes `realizado = sum(Sell.total) - sum(Buy.total)` across *all* ops (not scoped to closed positions) and separately computes unrealized P/L per asset as `currentValue - qty*avgPrice` from `computePositions` (which only returns assets with `qty > 0`, silently dropping fully-closed positions). These two numbers double-count the cost basis of currently-held quantity: `computePositions`'s `avgPrice*qty` is a subset of the `Buy.total` already subtracted in `realizado`. Example proven by the existing failing scenario in `ProfitTab.test.tsx` (1 BTC bought @100, 0.5 BTC sold @150): old formula yields realized = 75 − 100 = **−25**; correct lot-based accounting yields realized = 0.5 × (150 − 100) = **+25**. The spec's clarified FR-003/004/005 require realized P/L to reflect only closed portions and unrealized to reflect only open portions — the existing formula cannot produce this. `computePositions` cannot be reused as-is because it drops closed positions entirely (`.filter(a => a.qty > 1e-9)`), so best/worst-open-only ranking and the "By asset" chart (which needs realized+unrealized combined, per asset, including assets that still have an open position) both need the new function.

**Alternatives considered**:
- Patch the existing inline math in `ProfitTab.tsx` — rejected; portfolio calculation logic must live in `shared/` per Constitution I (Shared-First Architecture), and the same closed/open split is needed for both the metric cards and the "By asset" chart, so it belongs in one shared, tested function rather than duplicated JSX-adjacent math.
- Track lots via FIFO instead of average-cost — rejected; every other calculation in this codebase (`computePositions`, `computeTimeline`) already uses the average-cost method for consistency, and switching methods for just this feature would produce numbers that don't reconcile with the rest of the app.

## R3 — Segmented control icon removal

**Decision**: Remove the `<i className="ti ti-*" />` element from each button in `ProfitTab.tsx`'s chart-mode `.chart-switcher` and `WalletTab.tsx`'s grouping `.chart-switcher`, keeping the `<button>` and its text label. No CSS changes needed — `.chart-btn` already lays out fine with text-only content (confirmed by reading `globals.css` lines 261-275, which do not depend on an icon being present).

**Rationale**: FR-011/FR-012 only require the leading icon glyph removed; the button/label/active-state styling is unaffected in either file. This is a minimal, localized change with no CSS or component-contract impact.

## R4 — Content header and refresh button on the Profit view

**Decision**: Wrap the view in `<ContentHeader title={t.nav_profit} subtitle={t.profit_subtitle}>` (new i18n key `profit_subtitle`, added alongside the existing `profit_*` keys) with a refresh button reusing the existing `p.fetchPrices` / `p.statusMsg` values already exposed by `usePortfolio()` in `AppLayout.tsx` (the same values `WalletRoute` already passes to `WalletTab`). `ProfitRoute` in `router.tsx` needs two new props threaded through: `statusMsg` and `onFetchPrices`.

**Rationale**: `ContentHeader` and the `usePortfolio()` hook already exist and are used identically by `WalletTab`/`WalletRoute` (item 7); reusing them keeps the two views visually and behaviorally consistent with zero new abstractions, matching Constitution IV (No Speculative Code).

## R5 — Metric cards

**Decision**: Replace the four hand-rolled `<div className="metric">` blocks in `ProfitTab.tsx` with `<MetricCard>` (already used by `WalletTab`), preserving the `pos`/`neg` value coloring and the `sub`/`subColor` percentage line for the best/worst asset cards.

**Rationale**: `MetricCard` already renders the exact same `.metric`/`.metric-label`/`.metric-value`/`.metric-sub` CSS classes the hand-rolled markup uses — this is a drop-in swap with no visual change, consistent with the pattern item 7 established.

## R6 — Test placement for the new shared function

**Decision**: Add tests for `computeProfitByAsset` to `web/src/lib/portfolio.test.ts`, alongside the existing tests for `computePositions`, `computePositionsByAssetAndPlatform`, and `computeTimeline` (which already test the shared functions re-exported through `web/src/lib/portfolio.ts`).

**Rationale**: This repo's established convention (not a new one) already tests every `shared/src/portfolio.ts` export from `web/src/lib/portfolio.test.ts` rather than from a `shared/src/*.test.ts` file — CLAUDE.md explicitly permits either location, and matching existing precedent avoids introducing a second, inconsistent test location for the same module. Verified empirically during implementation: `web/vitest.config.ts` sets no `root`/`include` override, so `cd web && npm test` (`vitest run`) only discovers `*.test.ts` files under `web/src/`; a file placed at `shared/src/portfolio.test.ts` is silently never collected by the enforced test gate. `web/src/lib/portfolio.test.ts` is therefore the only location where tests actually execute — the CLAUDE.md-permitted alternative, not the constitution's literal `shared/src/*.test.ts` wording, is what fulfills the constitution's underlying intent (tests must run).

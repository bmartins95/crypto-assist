# Research: Per-Asset Charts & Enriched Tooltips

No `NEEDS CLARIFICATION` markers remain in the Technical Context — all are resolvable directly from the existing codebase and the imported design handoff. This file records the resulting implementation-approach decisions.

## 1. Dual-axis overlay (Component A)

**Decision**: Use Chart.js's native multi-scale support — `scales.y` (existing, left, currency) plus a new `scales.y1` (right, `position: 'right'`, percent), with the overlay dataset assigned `yAxisID: 'y1'`. Both `min`/`max` left unset so each scale auto-fits its own dataset's range, matching the handoff's "each axis scales to its own min/max" requirement.

**Rationale**: `chart.js` (already the project's only charting dependency, per the constitution's fixed Technology Standards) supports this natively — no new library needed. The existing `over-time`/`value` chart effects in `ProfitTab.tsx:134-169` already configure `scales` per chart type, so this is additive configuration, not a new rendering approach.

**Alternatives considered**: A second overlaid `<canvas>` with independent scaling (used only in the design mock's own SVG prototype) — rejected, since it would require manually syncing hover/tooltip state between two chart instances, which Chart.js's built-in multi-axis support avoids entirely.

## 2. Enriched tooltips (Profit & Value charts)

**Decision**: Replace Chart.js's default canvas-drawn tooltip with Chart.js's [external (HTML) tooltip](https://www.chartjs.org/docs/latest/configuration/tooltip.html#external-custom-tooltips) positioned via `tooltip.external`, rendering a small React-controlled DOM node absolutely positioned over the canvas.

**Rationale**: The handoff's tooltip mockups (1d, 1f) specify precise typography, color blocks, dividers, and a highlighted result block — layout fidelity that is impractical with Chart.js's canvas tooltip renderer (`tooltip.callbacks` only controls text, not layout/color blocks). An HTML tooltip can reuse the app's existing CSS and `fmtMoney`/`fmtPct` formatters directly.

**Alternatives considered**: Canvas tooltip with custom `callbacks.label`/`callbacks.afterBody` string formatting (today's approach) — rejected, cannot express the handoff's colored/highlighted block layout. A separate charting library with richer tooltip primitives — rejected as a new dependency the constitution's Technology Standards and "No Speculative Code" principle both discourage when the existing library can do the job.

## 3. Asset list sparklines (Component B)

**Decision**: Render each row's sparkline as a small hand-rolled inline SVG `<path>` (normalize the period series to a 0–1 range, build a polyline path), not a Chart.js instance per row.

**Rationale**: The design mock's own reference implementation (`Gráficos - Ideias por Ativo e Tooltips.dc.html`'s `lineChart`/`sparkCard` helpers) already uses plain SVG paths, not a chart library, specifically because instantiating dozens of Chart.js canvases for a scrollable list would be unnecessarily heavy — direct SVG is closer to negligible cost per row and keeps the list smooth at 30+ rows (SC-003).

**Alternatives considered**: One Chart.js instance per row — rejected for performance/memory overhead at list scale, and because sparklines need no interactivity (no tooltip, no axes), so Chart.js's feature set is unused overhead here.

## 4. Per-asset color assignment

**Decision**: Reuse and extend the existing `PALETTE` array already defined in `ProfitTab.tsx:45` (used today for the allocation bars) as the single source of per-asset color, keyed by `coinId` index — the same palette then drives the overlay's dashed line color, the list's icon-badge/sparkline color, and the allocation bars, so an asset's color is consistent everywhere it appears in the Profit tab.

**Rationale**: The handoff's BTC/ETH/SOL/ADA colors are explicitly "illustrative" (per spec.md Assumptions) — a real portfolio holds arbitrary coins, so a fixed small palette cycling by position (already the pattern used for allocation bars) is the simplest correct extension, with no new dependency or hashing scheme.

**Alternatives considered**: A hash-of-coinId-to-hue function for unlimited unique colors — rejected as unnecessary complexity (No Speculative Code) given the existing palette-cycling pattern already handles the allocation bars' arbitrary-length list today.

## 5. Persistence of the last-compared asset (Component A)

**Decision**: `localStorage`, one key per chart (`profit_compare_asset_over-time`, `profit_compare_asset_value`), read on mount and written on change — mirroring the existing `TIMEFRAME_STORAGE_KEY` pattern already in `ProfitTab.tsx:16,34-37,75-78`.

**Rationale**: FR-001a (confirmed in Clarifications) requires persistence across reloads; the codebase already has exactly this pattern for the timeframe selector, so reusing it keeps the implementation consistent rather than introducing a new persistence mechanism (e.g., a context provider) for a single value.

**Alternatives considered**: Backend-persisted user preference — rejected as scope creep; the handoff calls this "nice-to-have" and the existing timeframe preference is client-only, so the new preference follows the same precedent.

## 6. Cross-component hover sync (FR-010)

**Decision**: Lift the "hovered day" (a date string, or `null`) into `ProfitTab.tsx` state, set via the Profit chart's `onHover`/`tooltip.external` callback, and pass it as a prop into `AssetCompareControl`/`AssetsOverTimeList` so they can highlight/derive that day's per-asset contribution from the same `computeTimeline`-derived per-day breakdown used by the tooltip.

**Rationale**: `ProfitTab.tsx` already owns all the chart instances and derived data (`timeline`, `profitByAsset`), making it the natural place to hold cross-component UI state — consistent with the existing pattern where `activeChart`/`timeframe` state lives in the parent and flows down to `TimeframeSelector`.

**Alternatives considered**: A new React context for hover state — rejected as unnecessary indirection (No Speculative Code) for state consumed by at most two sibling components already rendered by the same parent.

## 7. Dedicated per-asset chart view (FR-008)

**Decision**: A modal/overlay component (`AssetDetailChart.tsx`) opened from a list row click, rendered within the Profit tab route rather than a new router route — consistent with how `OpDrawer` already opens as an overlay from the History tab rather than navigating to a new URL.

**Rationale**: No per-asset detail route exists today, and the confirmed clarification only requires a "dedicated full chart view," not deep-linkable navigation; a modal matches the existing drawer/overlay UI pattern already used elsewhere in `web/` and avoids adding a new TanStack Router route for this feature.

**Alternatives considered**: A new `/wallet/:coinId` (or similar) route — rejected as broader scope than required (no acceptance scenario asks for a shareable/bookmarkable URL), and it would need route-level auth/loader wiring the modal approach doesn't.

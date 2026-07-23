# Quickstart: Per-Asset Charts & Enriched Tooltips

## Run it locally

```bash
cd web && npm run dev    # http://localhost:5173
```

Sign in, go to the **Profit** tab, and make sure the seeded/test account has at least 2–3 assets with historical price data (Wallet tab → import or add ops) so the overlay, list, and sparklines have something to render.

## Manual verification checklist (maps to spec.md's User Stories)

1. **Story 1 — Compare with one asset**: On "Profit over time", use the "Compare with" control to select an asset. Confirm a dashed overlay line appears with its own right-axis percent scale, that switching assets replaces (not stacks) the overlay, and that reloading the page restores your last selection (FR-001a). Repeat on "Portfolio value".
2. **Story 2 — Assets over time list**: Confirm the list below the chart shows one row per held asset with a sparkline, price, and period % change; search filters rows; the sort control reorders by movement/alphabetical/allocation; changing the chart's timeframe (1D/1W/1M/1Y/All) updates the list; clicking a row opens the dedicated per-asset chart view (FR-008).
3. **Story 3 — Profit tooltip**: Hover a point on "Profit over time". Confirm the tooltip shows date+weekday, colored cumulative profit, day delta (R$ and %), and Realizado/Não realizado/Operações no dia — and confirm it does **not** list individual assets. Confirm the asset list/overlay highlights that day's per-asset contribution while hovering (FR-010).
4. **Story 4 — Value tooltip**: Hover a point on "Portfolio value". Confirm Valor atual / Investido swatches, the highlighted Resultado não realizado block, and Variação no dia.
5. **Regression**: Confirm "By asset" (bar chart), currency switching, balance-hide masking, and the existing allocation bars below the chart still work unchanged.

## Tests

```bash
cd shared && npx vitest run portfolio.test.ts   # if shared/ gains a standalone runner; otherwise covered via web's runner per project convention
cd web && npm test                               # Vitest + Testing Library, includes shared/ via the @crypto-assist/shared alias
cd web && npm run coverage                        # ≥90% on changed modules, per constitution
```

Per [project memory on spec-kit tooling quirks], `shared/*.test.ts` files are exercised through `web`'s Vitest runner (via the `@crypto-assist/shared` alias), not as a standalone `shared/` test command — confirm the actual test command in `web/package.json`/`vitest.config.ts` before relying on a bare `shared/` runner.

## Mobile parity check

This feature touches `shared/src/portfolio.ts` (extends `TimelinePoint`, adds new exports). Per the constitution's Shared-First Architecture principle, run a mobile build after the `shared/` changes land, even though no mobile screen currently imports these functions:

```bash
cd mobile && npx expo export --platform ios   # or the project's documented mobile build-check command
```

# Quickstart: Profit View Redesign

1. `cd web && npm run dev`, log in, navigate to `/profit`.
2. With a mix of open and closed positions in the wallet:
   - Confirm the content header shows title, subtitle, last-updated timestamp, and a working refresh button.
   - Confirm the four metric cards (Realized P/L, Unrealized P/L, Best asset, Worst asset) render via `<MetricCard>` and show plausible values.
   - Confirm Best/Worst asset only ever show assets with a currently open position.
3. Click through all three chart-mode buttons ("Por ativo" / "Lucro no tempo" / "Valor da carteira") — confirm no icon appears on any button, and the chart underneath changes each time.
4. Confirm the allocation panel below the chart lists each open-position asset with a bar proportional to its invested share.
5. Visit `/wallet` — confirm the "Por ativo" / "Por Plataforma" / "Ativo + plataforma" segmented control also renders text-only, no icons, and grouping still works.
6. Empty-state check: a fresh account with zero ops shows neutral placeholders on `/profit`, no console errors.

## Verification

```bash
cd web && npm test
cd web && npm run coverage
```

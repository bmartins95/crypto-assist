# Quickstart: Wallet View Redesign

## Run

```bash
cd web
npm run dev        # http://localhost:5173/wallet
npm test
npm run coverage
```

## Verify manually

1. Sign in with a wallet that has operations → `/wallet` shows a content header (title + subtitle + last-updated + refresh button) and four metric cards (Invested, Current value, P/L, Return).
2. P/L and Return cards are green when positive, red when negative.
3. Click refresh → last-updated advances; metric cards and table update.
4. Switch grouping (By asset / By platform / Asset + platform) → table regroups; totals stay consistent with the metric cards.
5. Coin images show for assets with cached prices; assets with no cached image show colored initials.
6. Toggle "Ocultar saldos" in Settings → all monetary values in the cards and table mask to `••••••`.
7. Clear the wallet (Settings → Zona de perigo) → `/wallet` shows only the empty state, no header/metrics/table.

## Visual source of truth

`docs/design/dashboard-collapsible-sidebar.html` → "Carteira" view.

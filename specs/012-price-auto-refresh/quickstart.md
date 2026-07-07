# Quickstart: Verifying Auto-Refresh Prices

## Web

1. `cd web && npm run dev`, log in, navigate to `/settings`.
2. In the "Moeda e preços" card, change "Atualizar preços" from "Manual" to "A cada 30s".
3. Navigate to `/wallet`. Open DevTools Network tab; confirm a prices request fires roughly every 30 seconds without touching the manual refresh button.
4. Reload the page. Confirm Settings still shows "A cada 30s" selected and auto-refresh resumes without reselecting it.
5. Return to Settings and switch back to "Manual"; confirm no further automatic requests fire, and the manual refresh button on `/wallet` still works.

## Mobile

1. `cd mobile && npx expo start`, log in, open the Settings screen.
2. Set the refresh interval row to "A cada 1min".
3. Navigate to the Wallet tab; confirm prices refresh roughly every 60 seconds without pulling to refresh.
4. Force-close and reopen the app; confirm Settings still shows "A cada 1min" and the Wallet screen resumes auto-refreshing at that cadence.

## Automated tests

- `cd web && npm test -- PriceRefreshContext AppLayout` — fake-timer coverage of interval scheduling/clearing/rescheduling.
- `cd web && npm run coverage` — confirm ≥90% on changed modules.

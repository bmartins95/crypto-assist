# Quickstart: Collapsible Sidebar Navigation

## Run

```bash
cd web
npm run dev        # http://localhost:5173
npm test           # Vitest suite
npm run coverage   # coverage summary for the PR description
```

## Verify manually

1. Sign in → you land on `/wallet` with the sidebar on the left; no floating top bar anywhere.
2. Click Lucro / Histórico → URL changes to `/profit` / `/history`, view swaps instantly (no loading flash), active item highlighted.
3. Click the `‹` collapse button → rail shrinks to 66px, labels hide, hover an icon → tooltip appears. Reload → still collapsed.
4. Sidebar footer: Configurações → `/settings` renders inside the shell; Logout signs out; user chip shows your email (initial only when collapsed).
5. Open `/dashboard` → not-found (route removed).
6. Change language in Settings → sidebar labels update immediately.
7. Toggle theme in Settings → sidebar follows light/dark.

## Visual source of truth

Open `docs/design/dashboard-collapsible-sidebar.html` in a browser and compare against the running app.

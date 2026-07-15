# Quickstart: verifying the Datum rebrand

## Run locally

```bash
cd web && npm run dev   # http://localhost:5173
```

## Visual acceptance sweep (against specs/020-datum-rebrand/assets/)

Open `assets/datum-brand-guide.html` in a browser side-by-side with the app.

1. **Tab**: title "Datum — Sua carteira, consolidada"; favicon = Datum mark, crisp at 16px.
2. **Hero (`/`)**: Datum mark + wordmark in topbar; headline "Você está / aqui." with "aqui." in orange (no gradient text anywhere); new subcopy; teal primary CTA with dark-teal text; footer attribution "datum. · um produto Buma Labs".
3. **Auth flow**: login/provider screens recolored; loading pulse shows Datum mark, dots teal; warming/error states intact.
4. **Sidebar**: 26px mark + `datum.` wordmark; active item = teal pill + edge bar + 7px orange dot; collapse/expand and refresh spin→check (teal) still work.
5. **Carteira** (all 3 grouping modes): KPI values and numeric table cells in Space Grotesk with tabular-nums; header rows 11px uppercase muted; platform chips rounded-square, coins circular; gain/loss colors unchanged.
6. **Drawer**: elevated inputs `#1d1d20`; `atual` badge teal-dim/teal; submit spinner→check teal.
7. **Theme toggle** (Settings): Claro applies the derived light palette (teal `#0d9488` accents) instantly, no reload; Sistema follows OS.
8. **Orange audit**: orange appears ONLY as wordmark period, sidebar active dot, hero "aqui.", and specified orange-dim badges. (Bitcoin's `#f7931a` coin badge is a coin color, not brand orange — allowed.)
9. **Old identity audit**: `grep -ri "criptoativos\|crypto.assist" web/src shared/src/i18n --include=*.ts*` returns only internal identifiers (path alias, localStorage keys), zero user-facing strings.

## Tests

```bash
cd web && npm test && npm run coverage
cd backend && pytest        # must stay green (untouched)
cd mobile && npx tsc --noEmit   # mobile type contract intact
```

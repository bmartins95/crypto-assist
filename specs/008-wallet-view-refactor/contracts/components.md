# UI Contract: MetricCard, ContentHeader, WalletTab

## MetricCard

```tsx
<MetricCard label={t.profit_invested} value={mask(fmt(inv, locale))} />
<MetricCard
  label={t.profit_pnl}
  value={inv && atual ? mask(fmt(l, locale)) : '—'}
  valueColor={l >= 0 ? 'pos' : 'neg'}
/>
```

- Renders `.mcard > .ml (label) + .mv (value, optionally .pos/.neg) [+ .msub (sub, optionally .pos/.neg)]`.
- Does not fetch, format, or mask data — caller passes fully-prepared strings.
- Used in a `.metrics` 4-column grid by the caller (grid is the caller's responsibility, matching the prototype's `.metrics` wrapper).

## ContentHeader

```tsx
<ContentHeader title={t.nav_wallet} subtitle={t.wallet_subtitle}>
  <span className="ts">{statusMsg}</span>
  <button className="btn" onClick={onFetchPrices}>
    <i className="ti ti-refresh" /> {t.wallet_updatePrices}
  </button>
</ContentHeader>
```

- Renders `.chead > (title/.ct + subtitle/.cs) + .refresh (children)`.
- `children` is free-form — Wallet passes status text + refresh button; Items 8/9 will pass their own actions.

## WalletTab (contract unchanged from Item 6)

- Props identical to today: `{ ops, assets, prices, avatarCache, groupMode, onGroupMode, statusMsg, onFetchPrices, onExitPriceChange }`.
- Renders `<ContentHeader>` + `<div className="metrics">` with 4 `<MetricCard>` + the existing segmented grouping control + the restyled holdings table.
- Empty-wallet state (no `assets`) still short-circuits to the existing empty-state markup with no header/metrics/table change beyond what's already there.

## Non-changes (guaranteed)

- No backend endpoint added, changed, or removed.
- `shared/src/portfolio.ts` calculation functions unchanged.
- `ProfitTab`, `HistoryTab` untouched.
- Mobile app unaffected (no `shared/` type changes).

# Data Model: Wallet View Redesign

No backend, database, or shared type-contract changes. All state is derived at render time from the existing `usePortfolio()` context (Item 6).

## MetricCard props (new component)

| Prop | Type | Required | Notes |
|------|------|----------|-------|
| `label` | `string` | yes | Already-localized label text |
| `value` | `string` | yes | Already-formatted display value (or `'—'` placeholder) |
| `valueColor` | `'pos' \| 'neg'` | no | Applies the existing `.pos`/`.neg` color utility to the value |
| `sub` | `string` | no | Secondary line (e.g. best/worst asset ticker in Item 8) |
| `subColor` | `'pos' \| 'neg'` | no | Applies `.pos`/`.neg` to the sub line |

Purely presentational — no internal state, no data fetching.

## ContentHeader props (new component)

| Prop | Type | Required | Notes |
|------|------|----------|-------|
| `title` | `string` | yes | Already-localized view title |
| `subtitle` | `string` | yes | Already-localized subtitle |
| `children` | `React.ReactNode` | no | Right-aligned actions area (e.g. last-updated text + refresh button) |

Purely presentational — no internal state, no data fetching.

## WalletTab (existing component, restyled)

Props are unchanged from the current implementation (`ops`, `assets`, `prices`, `avatarCache`, `groupMode`, `onGroupMode`, `statusMsg`, `onFetchPrices`, `onExitPriceChange`), all already supplied by `WalletRoute` in `web/src/router.tsx` via `usePortfolio()`. Only internal rendering changes: uses `ContentHeader` + `MetricCard` + restyled table markup.

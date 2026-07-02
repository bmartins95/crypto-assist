# Data Model: Collapsible Sidebar Navigation

No backend, database, or shared type-contract changes. All state is client-side.

## Sidebar preference

| Field | Type | Storage | Values |
|-------|------|---------|--------|
| `sidebar:collapsed` | string | `localStorage` | `'1'` = collapsed; `'0'`, absent, or any other value = expanded |

Lifecycle: read once in `AppLayout`'s lazy state initializer; written on every toggle. Never synced to the server.

## Portfolio context (moved, not new)

State previously owned by `DashboardPage`, now owned by `PortfolioProvider` inside `AppLayout`:

| State | Type | Notes |
|-------|------|-------|
| `ops` | `Op[]` | loaded once from `api.getOps()` |
| `exitPrices` | `Record<string, number>` | loaded once from `api.getExitPrices()` |
| `prices` | `Prices` | populated by `fetchPrices()` (manual + one auto-fetch) |
| `avatarCache` | `AvatarCache` | localStorage-backed via existing `storage` |
| `loading` | `boolean` | initial load flag |
| `statusMsg` | `string` | price-fetch status line |
| `groupMode` | `GroupMode` | Wallet segmented state (survives route switches) |
| `activeChart` | `ChartType` | Profit segmented state (survives route switches) |
| handlers | — | `handleAddOp`, `handleEditOp`, `handleRemoveOp`, `handleExitPriceChange`, `fetchPrices`, `handleImport` wiring unchanged |

Derived: `assets = collectAssets(ops, exitPrices)` (memoized).

## i18n keys (additive)

`UIText` gains: `nav_wallet`, `nav_profit`, `nav_history`. Existing `nav_settings`, `nav_logout` are reused. All 10 locale files must define the new keys (compiler-enforced).

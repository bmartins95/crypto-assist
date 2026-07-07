# Data Model: Auto-Refresh Prices

No database schema changes. This feature introduces a single client-side, per-device preference — no backend entity, migration, or API contract.

## Price refresh preference

| Field | Type | Values | Notes |
|---|---|---|---|
| `interval` | `number \| null` | `null` (Manual, default), `30000`, `60000`, `300000` | Milliseconds between automatic price fetches. `null` disables automatic refreshing. |

**Storage**:
- Web: `localStorage`, key `price_refresh_interval`, JSON-stringified value (`"null"` or a number string).
- Mobile: `expo-secure-store`, key `price_refresh_interval`, same string encoding, read asynchronously on mount.

**Lifecycle**: Read once on app start (default `null` if absent/unparseable); written every time the user changes the Settings selector; no expiry, no sync across devices, no server persistence.

**Validation**: Only the four literal values above are accepted from storage; any other/corrupt stored value falls back to `null` (Manual), mirroring the defensive-parse pattern already used by `CurrencyContext`'s `readStoredRates()`.

# Phase 0 Research: Import Wallet Feedback & Price Freshness

No open `NEEDS CLARIFICATION` markers exist in the Technical Context — this is a small, well-bounded bug fix in an already-understood codebase. Research here documents the decisions already made (and validated against the codebase) during discovery, not open unknowns.

## Decision 1: Build local `Toast`/`ConfirmDialog` components instead of adopting a UI library

**Decision**: Implement two small, page-scoped React components directly in `web/src/components/`.

**Rationale**: A repo-wide grep (`toast|Toast|snackbar|Snackbar|Dialog|Modal`) across `web/src` found zero existing reusable feedback components — every current "confirm before destructive action" or "alert on result" flow uses native `window.confirm`/`window.alert`. The constitution's dependency policy (Principle IV) requires checking whether functionality can be written in under 20 lines before adding a package; both components are simple enough (a dismissible banner, a centered confirm/cancel modal) to comfortably clear that bar.

**Alternatives considered**:
- *Keep native `alert`/`confirm`*: Rejected — this is the exact bug being fixed (FR-006, SC-003); native dialogs are also unstylable and inconsistent with the rest of Settings' custom UI.
- *Add a UI library (e.g. `react-hot-toast`, Radix Dialog)*: Rejected — would be the sole consumer of a small fraction of the library's surface for two use cases the repo can implement directly; violates the "sole consumer of a single function" dependency rule.
- *A generic toast "manager" with a queue/provider*: Rejected — over-engineered for this page, which only ever shows one message at a time (Principle IV, no speculative code).

## Decision 2: Compute post-import price-fetch ids from `remoteOps` directly, not via `fetchPrices()`

**Decision**: `AppLayout.tsx`'s `reload()` computes `[...new Set(remoteOps.map(o => o.coinId))]` itself and calls `api.getPrices(ids)` directly, instead of calling the existing `fetchPrices()` callback.

**Rationale**: `fetchPrices` (`AppLayout.tsx:142-169`) derives its coin ids from the `assets` `useMemo`, which itself derives from `usdOps`/`exitPrices` state. Inside `reload()`, `setOps(remoteOps)`/`setExitPrices(remoteExitPrices)` only *schedule* a re-render — they do not synchronously update `assets` within the same function body. Calling `fetchPrices()` (even the freshest closure of it) immediately afterward would still read pre-import `assets`, missing any newly-imported coin. Reading `remoteOps` — a plain local variable holding the just-fetched data — sidesteps the stale-closure problem entirely.

**Alternatives considered**:
- *Add `fetchPrices` to `reload`'s dependency array and call it after `await`ing a microtask/`Promise.resolve()`*: Rejected — timing-dependent and fragile (relies on exactly one microtask flush being enough for React to commit the state update), harder to reason about and test than a direct, synchronous-with-the-data computation.
- *Change `fetchPrices`'s signature to accept explicit `ids`*: Rejected — `fetchPrices` is used as a bare zero-arg callback in four places (`WalletTab`'s refresh button, `ProfitTab`'s refresh button, the mount-time auto-fetch effect, and the auto-refresh interval); broadening its signature to serve one new caller is a larger surface change than the bug requires (Principle IV).

## Decision 3: Guard the mount-time auto-fetch effect against a redundant duplicate fetch

**Decision**: Set `didAutoFetchPrices.current = true` inside `reload()`'s new price-fetch branch (only when `ids.length > 0`).

**Rationale**: `bootstrap()`'s legacy-migration branch (`AppLayout.tsx:81-95`) already calls `reload()` once, before the wallet has any ops. If a user's wallet is empty at first load and they later import via Settings, `reload()`'s new price top-up and the pre-existing mount-time auto-fetch effect (`AppLayout.tsx:171-177`, guarded by `didAutoFetchPrices`) would both fire in that narrow window, issuing two `getPrices` calls back-to-back. Setting the guard once inside `reload()`'s fetch branch prevents this without touching the auto-fetch effect itself.

**Alternatives considered**:
- *Do nothing*: Rejected — a real, if minor, duplicate network call was identified; the one-line guard is cheap and directly prevents it.
- *Remove the mount-time auto-fetch effect entirely and rely only on `reload()`*: Rejected — out of scope; the normal (non-legacy-migration) bootstrap path never calls `reload()`, so the mount effect is still the only price-fetch trigger for a plain first login.

## Decision 4: Reuse existing i18n keys for the confirm dialog; add only what's missing

**Decision**: `ConfirmDialog`'s title/message/confirm-label/cancel-label reuse `settings_clear_wallet` / `settings_clear_wallet_confirm` / `settings_clear_data` / `common_cancel` verbatim. Only `settings_import_success` (dedicated import-success copy) and `common_close` (toast dismiss button aria-label) are new keys.

**Rationale**: A key-by-key read of `shared/src/i18n/types.ts` confirmed all four dialog strings already exist and are already used by the current `handleClearWallet` (just via `alert`/`confirm` today); reusing them keeps the on-screen copy identical to today's, avoiding a translation-review cycle across 10 locales for text that isn't changing.

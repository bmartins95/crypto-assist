# Implementation Plan: Import Wallet Feedback & Price Freshness

**Branch**: `fix/import-wallet-feedback` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/021-fix-import-wallet-feedback/spec.md`

## Summary

Fix the Settings page's import flow, which currently shows the wrong success message ("wallet cleared" instead of "wallet imported") and leaves newly-imported coins without a market price until a manual refresh. Along the way, replace `window.alert`/`window.confirm` in the Settings page's export/import/clear-wallet handlers with two small, purpose-built in-app components (`Toast`, `ConfirmDialog`), since no such component exists anywhere in `web/src` yet. Technical approach: add a dedicated `settings_import_success` i18n key; build `Toast`/`ConfirmDialog` as local React components styled with the existing `--s-*` CSS tokens; and fix `AppLayout.tsx`'s `reload()` to compute coin ids directly from the freshly-fetched ops (not the stale `assets` memo) and fetch their prices inline.

## Technical Context

**Language/Version**: TypeScript, React 19 (no new language/runtime)

**Primary Dependencies**: Existing stack only — React, TanStack Router, `@crypto-assist/shared` i18n layer. No new npm packages (constitution's dependency-addition threshold isn't met: both new components are well under 20 lines each and reuse existing patterns).

**Storage**: N/A — no schema or persisted-data change. Existing `api.exportBackup`/`importBackup`/`clearOps`/`getPrices`/`getOps`/`getExitPrices` endpoints are reused unmodified.

**Testing**: Vitest + Testing Library (`cd web && npm test` / `npm run coverage`). `cd backend && pytest` is unaffected but re-run per the pre-PR gate.

**Target Platform**: Web only (Vite/React app under `web/`). Mobile has no equivalent import/export/clear-wallet UI, so it is unaffected; only the shared i18n additions are visible to it (additive keys, no mobile screen changes).

**Project Type**: Web application (monorepo frontend package `web/`, shared package `shared/`)

**Performance Goals**: N/A — no new performance-sensitive path; the added price fetch on import reuses the same `api.getPrices` call already used elsewhere.

**Constraints**: No new dependencies. Must reuse existing `--s-*` design tokens and i18n conventions. Must not break the mobile type contract (Principle I) — the only shared-package change is two additive `UIText` keys.

**Scale/Scope**: One page (`web/src/pages/settings.tsx`), one shared layout hook (`web/src/components/AppLayout.tsx`), two new small components, i18n additions across 10 locale files. No backend, database, or infra changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Shared-First Architecture** — PASS. The only `shared/` change is two additive `UIText` keys (`settings_import_success`, `common_close`) added to `shared/src/i18n/types.ts` and all 10 locale files under `shared/src/i18n/locales/`. No mobile screen consumes these new keys, so the mobile type contract and rendering are unaffected; mobile build is still verified as part of done-criteria.
- **II. Security at the Boundary** — PASS (mostly N/A). No backend routes, inputs, or trust boundaries change. Existing client-side error handling (`err.message` from backend `detail`) is preserved, just re-routed from `alert()` to the new `Toast`.
- **III. Behavior Coverage Over Line Coverage** — PASS, enforced by task list: new `Toast.test.tsx`/`ConfirmDialog.test.tsx` cover happy path + dismiss/cancel/confirm paths; `settings.test.tsx` is rewritten (not just patched) to assert the corrected import-success message and the new in-app dialog/toast markup; `AppLayout.test.tsx` gains a case asserting `reload()` fetches prices for newly-loaded ops. Target ≥90% coverage on all changed files.
- **IV. No Speculative Code** — PASS. `Toast`/`ConfirmDialog` are scoped to replace exactly the 4 existing native-dialog call sites in `settings.tsx` (3 `alert()` + 1 `confirm()`) — no generic toast "system" (queueing, positioning API, multiple simultaneous toasts) is built, since only one message is ever shown at a time on this page. `AppLayout.tsx`'s unrelated legacy-migration `confirm()` (line 84) is explicitly left untouched — out of scope for this item.
- **V. Accessibility and Internationalisation** — PASS. `Toast` uses `role="status" aria-live="polite"` plus an `aria-label` on its icon-only close button; `ConfirmDialog` uses `role="alertdialog" aria-modal="true" aria-labelledby aria-describedby`. Every string routes through `t.*` — no hardcoded Portuguese. New keys added to all 10 locale files, keeping `UIText` satisfied for every locale (compile-time enforced).

No violations. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/021-fix-import-wallet-feedback/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/            # Phase 1 output
│   └── component-interfaces.md
└── tasks.md              # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
shared/
└── src/
    └── i18n/
        ├── types.ts                 # + settings_import_success, common_close
        └── locales/*.ts             # all 10 locale files, same 2 keys

web/
└── src/
    ├── components/
    │   ├── AppLayout.tsx            # reload() fix (compute ids from remoteOps, top up prices/avatarCache)
    │   ├── AppLayout.test.tsx       # + reload-fetches-prices test
    │   ├── Toast.tsx                # NEW
    │   ├── Toast.test.tsx           # NEW
    │   ├── ConfirmDialog.tsx        # NEW
    │   └── ConfirmDialog.test.tsx   # NEW
    ├── pages/
    │   ├── settings.tsx             # handlers use Toast/ConfirmDialog instead of alert/confirm
    │   └── settings.test.tsx        # rewritten assertions (query new markup, not window spies)
    └── app/
        └── globals.css              # + .toast*, .confirm-backdrop, .confirm-dialog* rules
```

**Structure Decision**: Follows the existing `web/src/components/` (shared page-agnostic UI) vs. `web/src/pages/` (route-level page) split already used throughout the app (e.g. `OpDrawer.tsx` in `components/`, consumed by `HistoryTab.tsx`). `Toast`/`ConfirmDialog` are added as components since they are generic enough to be reused later, but no other call site is touched in this branch (Principle IV). No new top-level directories; no backend or mobile paths touched.

## Complexity Tracking

*No constitution violations — table not needed.*

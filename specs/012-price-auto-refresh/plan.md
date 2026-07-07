# Implementation Plan: Auto-Refresh Prices

**Branch**: `feat/price-auto-refresh` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-price-auto-refresh/spec.md`

## Summary

Users pick an automatic price-refresh cadence (Manual/30s/1min/5min) in Settings; the choice persists per device and, once non-Manual, re-triggers the existing price-fetch flow on that cadence with no further interaction, until switched back to Manual. Implemented as a new device-preference context (`PriceRefreshContext`) on both web and mobile, following the exact shape already established by `BalanceContext`/`CurrencyContext` on each platform, wired into the existing "Moeda e preços" Settings card (replacing the disabled placeholder from Item 5) and into the existing price-fetch call sites (`AppLayout.fetchPrices` on web; each screen's own `load` on mobile, since mobile has no shared portfolio context).

## Technical Context

**Language/Version**: TypeScript (web: Vite/React; mobile: Expo SDK 54/React Native)

**Primary Dependencies**: React Context API, `expo-secure-store` (mobile), Vitest + Testing Library (web tests)

**Storage**: `localStorage` (web), `expo-secure-store` (mobile) — no database involved

**Testing**: Vitest + `@testing-library/react` with `vi.useFakeTimers()` (web); no mobile automated tests exist in this repo today (per AGENTS.md, `mobile/` has no automated tests yet) — verified manually per quickstart.md

**Target Platform**: Browser (web), iOS/Android via Expo (mobile)

**Project Type**: Web application + mobile app, sharing `shared/` (this feature does not need any new `shared/` export — it's a pure per-device UI preference, not a cross-platform data type)

**Performance Goals**: N/A — refresh cadence is user-chosen (30s/60s/300s); no new performance target beyond "same cost as one manual refresh per tick"

**Constraints**: No new backend endpoint; no new `shared/` types; must not duplicate the existing manual-refresh fetch/error-handling path

**Scale/Scope**: Two new context files (web, mobile), one Settings-card wire-up per platform, one effect added to the existing price-fetch call site(s)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Shared-First Architecture** — N/A. No cross-package type or shared logic is introduced; the preference is a platform-local UI concern (like `hide_balances`/`theme` before it), not shared portfolio/formatting logic. PASS.
- **II. Security at the Boundary** — N/A for input validation (no new API). The interval effect reuses `fetchPrices`/`load`, which already surface fetch failures via visible UI state; no new error path is introduced that could swallow errors. PASS.
- **III. Behavior Coverage Over Line Coverage** — Plan includes fake-timer tests for: 30s/1min/5min scheduling, Manual stopping refresh, rescheduling between two active intervals, a failed-fetch-during-auto-refresh retry path, and persistence across remount. PASS (see quickstart.md and tasks.md T018/T018a/T018b/T024/T025/T027/T028).
- **IV. No Speculative Code** — No new mobile portfolio context is introduced merely to centralize the effect (see research.md); no new shared component is extracted for a single call site; reuses existing `settings-select` / row patterns rather than building new UI primitives. PASS.
- **V. Accessibility and Internationalisation** — The web `<select>` keeps an associated `<label>`/`settings-row-label`; the mobile row keeps `accessibilityRole="radio"`/checkmark like sibling rows. New strings (interval option labels) go through the existing i18n layer (`t.settings_refresh_*` keys), not hardcoded strings. PASS.

No violations requiring justification. Constitution Check re-confirmed after Phase 1 design below — no changes to this assessment; design artifacts (research.md, data-model.md) did not surface new gates.

## Project Structure

### Documentation (this feature)

```text
specs/012-price-auto-refresh/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

No `contracts/` directory: this feature adds no new API endpoint or external interface (confirmed in spec.md Assumptions — reuses the existing prices fetch flow).

### Source Code (repository root)

```text
web/src/
├── context/
│   ├── BalanceContext.tsx        # existing — reference pattern
│   ├── CurrencyContext.tsx       # existing — reference pattern
│   ├── PriceRefreshContext.tsx   # NEW
│   └── PriceRefreshContext.test.tsx  # NEW
├── components/
│   └── AppLayout.tsx             # MODIFIED — add interval effect around existing fetchPrices
├── pages/
│   └── settings.tsx              # MODIFIED — wire live selector into "Moeda e preços" card
└── main.tsx                      # MODIFIED — wrap tree with <PriceRefreshProvider>

mobile/src/context/
├── BalanceContext.tsx            # existing — reference pattern
├── CurrencyContext.tsx           # existing — reference pattern
└── PriceRefreshContext.tsx       # NEW

mobile/app/
├── _layout.tsx                   # MODIFIED — wrap tree with <PriceRefreshProvider>
├── settings.tsx                  # MODIFIED — wire live row into "Preferências" group
└── (tabs)/
    ├── wallet.tsx                # MODIFIED — add interval effect around existing load
    └── profit.tsx                # MODIFIED — add interval effect around existing load

shared/src/i18n/
├── types.ts                      # MODIFIED — add settings_refresh_* option-label keys if missing
└── locales/*.ts                  # MODIFIED — same keys, all 10 locales
```

**Structure Decision**: Matches the codebase's existing per-platform `context/` (singular) convention exactly — not the `contexts/` (plural) path guessed in the original plan-item text — because `BalanceContext.tsx`/`CurrencyContext.tsx` already establish `context/` on both platforms (see research.md). Mobile settings/screens live under Expo Router's file-based `mobile/app/` directory (not `mobile/src/screens/SettingsScreen.tsx` as the plan item text assumed), matching the actual current file locations discovered during research.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*

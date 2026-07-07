---

description: "Task list for Auto-Refresh Prices (plan item 11)"
---

# Tasks: Auto-Refresh Prices

**Input**: Design documents from `/specs/012-price-auto-refresh/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included — the constitution (Principle III) requires behavior coverage, and spec.md's success criteria are only verifiable with fake-timer tests around interval scheduling.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1/US2/US3)

## Path Conventions

Web app + mobile app sharing `shared/`. Web: `web/src/`. Mobile: `mobile/src/`, `mobile/app/` (Expo Router file-based). Shared: `shared/src/i18n/`.

---

## Phase 1: Setup

No new tooling, dependencies, or scaffolding is required — this feature reuses the existing Vitest/Testing Library setup and the established `context/` provider pattern on both platforms.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared i18n keys and the `PriceRefreshContext` itself (on both platforms) must exist before any user-story-level wiring can be built or tested.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 Add `settings_refresh_option_manual`, `settings_refresh_option_30s`, `settings_refresh_option_1m`, `settings_refresh_option_5m` keys to `shared/src/i18n/types.ts`; remove the now-unused `settings_refresh_placeholder` key
- [X] T002 [P] Add translations for the new keys and remove `settings_refresh_placeholder` in `shared/src/i18n/locales/pt-BR.ts`
- [X] T003 [P] Same as T002 for `shared/src/i18n/locales/en-US.ts`
- [X] T004 [P] Same as T002 for `shared/src/i18n/locales/es-ES.ts`
- [X] T005 [P] Same as T002 for `shared/src/i18n/locales/fr-FR.ts`
- [X] T006 [P] Same as T002 for `shared/src/i18n/locales/de-DE.ts`
- [X] T007 [P] Same as T002 for `shared/src/i18n/locales/zh-CN.ts`
- [X] T008 [P] Same as T002 for `shared/src/i18n/locales/ja-JP.ts`
- [X] T009 [P] Same as T002 for `shared/src/i18n/locales/ar-SA.ts`
- [X] T010 [P] Same as T002 for `shared/src/i18n/locales/hi-IN.ts`
- [X] T011 [P] Same as T002 for `shared/src/i18n/locales/ru-RU.ts`
- [X] T012 Create `web/src/context/PriceRefreshContext.tsx`: `interval: number | null` state (`localStorage` key `price_refresh_interval`, `useState` initializer mirroring `BalanceContext.tsx`'s shape), `setInterval(value: number | null)` setter that persists then updates state, `usePriceRefresh()` hook that throws `'usePriceRefresh must be used within PriceRefreshProvider'` outside the provider; invalid/corrupt stored values fall back to `null`
- [X] T013 [P] Create `web/src/context/PriceRefreshContext.test.tsx` mirroring `BalanceContext.test.tsx`'s structure: defaults to `null` when storage is empty, `setInterval(30000)` updates state and persists to `localStorage`, a corrupt stored value falls back to `null`, throws when used outside the provider
- [X] T014 Wrap the provider tree in `web/src/main.tsx` with `<PriceRefreshProvider>`, nested alongside `BalanceProvider`/`CurrencyProvider` in the existing order
- [X] T015 Add `<PriceRefreshProvider>` to the wrapper trees in `web/src/pages/settings.test.tsx` (`Wrapper` component) and `web/src/components/AppLayout.test.tsx` (`renderAt` helper), since both will call `usePriceRefresh()` once wired in later phases
- [X] T016 Create `mobile/src/context/PriceRefreshContext.tsx`: same value shape as T012 but backed by `expo-secure-store` (`SecureStore.getItemAsync`/`setItemAsync`, key `price_refresh_interval`), read asynchronously in a mount `useEffect` exactly like `mobile/src/context/BalanceContext.tsx`
- [X] T017 Wrap the provider tree in `mobile/app/_layout.tsx` with `<PriceRefreshProvider>`, nested alongside `BalanceProvider`/`CurrencyProvider` in the existing order

**Checkpoint**: `PriceRefreshContext` exists, is persisted, and is wired into both app roots. User story phases can now build the visible feature and its scheduling behavior on top of it.

---

## Phase 3: User Story 1 - Enable automatic price refresh (Priority: P1) 🎯 MVP

**Goal**: Selecting a non-Manual interval in Settings causes prices to refresh automatically at that cadence, with no further user action.

**Independent Test**: Set the interval to "A cada 30s" in Settings, stay on the Wallet view, and confirm prices are re-fetched roughly every 30 seconds without any interaction.

### Tests for User Story 1

- [X] T018 [P] [US1] Add fake-timer tests to `web/src/components/AppLayout.test.tsx`: with `vi.useFakeTimers()`, set `PriceRefreshContext`'s interval to `30000` (via `localStorage.setItem('price_refresh_interval', '30000')` before render, mirroring how `BalanceContext`/`CurrencyContext` tests seed `localStorage`), then assert `api.getPrices` is called again after `vi.advanceTimersByTime(30000)` without any user interaction; repeat for `60000` and `300000`
- [X] T018a [P] [US1] Add a fake-timer test to `web/src/components/AppLayout.test.tsx` covering spec.md's error-path edge case (FR-009): with an active interval, make `api.getPrices` reject once (`mockRejectedValueOnce`), advance past one tick, and assert the existing error status is shown *and* `api.getPrices` is called again after the next `vi.advanceTimersByTime` — the failed tick must not stop future automatic attempts
- [X] T018b [P] [US1] Add a fake-timer test to `web/src/components/AppLayout.test.tsx` covering rescheduling between two active intervals (FR-005): start with interval `30000`, advance partway, then change to `60000` (e.g. re-render with the new `localStorage` value / call `setInterval(60000)` via a test hook), and assert the old 30s timer was cleared — no fetch fires at the stale 30s cadence, and the next fetch instead follows the new 60s cadence

### Implementation for User Story 1

- [X] T019 [US1] Replace the disabled placeholder `<select>` in `web/src/pages/settings.tsx`'s "Moeda e preços" card (current lines ~146-154) with a live `settings-select`-styled `<select>` bound to `usePriceRefresh()`, with four options (Manual/30s/1min/5min) sourced from the new i18n keys (T001-T011)
- [X] T020 [US1] Add an interval-scheduling effect in `web/src/components/AppLayout.tsx`: read `interval` from `usePriceRefresh()`; keep a `useRef` holding the latest `fetchPrices` (updated in its own effect) so the scheduling effect only depends on `interval`, not on `fetchPrices`'s own identity churn; `setInterval(() => fetchPricesRef.current(), interval)` when `interval` is non-null, `clearInterval` on unmount or whenever `interval` changes
- [X] T021 [US1] Add an interval-scheduling effect to `mobile/app/(tabs)/wallet.tsx`: read `interval` from `usePriceRefresh()`, `setInterval(load, interval)` when non-null, cleared on unmount or interval change (mirrors the `useEffect(() => { load(); }, [load])` already present)
- [X] T022 [US1] Add the same interval-scheduling effect to `mobile/app/(tabs)/profit.tsx`, using that screen's own `load` callback
- [X] T023 [US1] Replace the disabled placeholder row in `mobile/app/settings.tsx`'s "Preferências" group (current lines ~132-135) with four tappable rows (Manual/30s/1min/5min), matching the existing `TouchableOpacity` + `accessibilityRole="radio"` + checkmark pattern used by the adjacent currency rows, bound to `usePriceRefresh()`

**Checkpoint**: User Story 1 is independently functional — selecting 30s/1min/5min causes automatic price refresh on both platforms.

---

## Phase 4: User Story 2 - Turn off automatic refresh (Priority: P2)

**Goal**: Selecting Manual stops automatic refreshing; the existing manual refresh action keeps working unchanged.

**Independent Test**: With an active interval selected, switch back to Manual in Settings and confirm no further automatic fetches occur, while manual refresh still works.

### Tests for User Story 2

- [X] T024 [P] [US2] Add a fake-timer test to `web/src/components/AppLayout.test.tsx`: start with an active interval, then call `setInterval(null)` (simulating the user switching to Manual), and assert `api.getPrices` is NOT called again after `vi.advanceTimersByTime`; separately assert the manual `fetch-prices` button (already mocked via `WalletTab`'s `onFetchPrices`) still triggers a fetch on click regardless of the current `PriceRefreshContext` state
- [X] T025 [P] [US2] Add a test to `web/src/context/PriceRefreshContext.test.tsx` confirming `setInterval(null)` is accepted, persists as Manual (`localStorage` reflects no active interval), and is the value returned on next mount

### Implementation for User Story 2

No new production code: T020-T022's scheduling effects already treat `interval === null` as "do not schedule / clear any existing timer," and manual refresh already calls `fetchPrices`/`load` directly without checking `PriceRefreshContext`. This phase is test-only, confirming that behavior already holds.

- [ ] T026 [US2] Manually verify the mobile "switch back to Manual stops refresh" path per `quickstart.md`'s Mobile section, since `mobile/` has no automated test suite (see AGENTS.md)

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Preference persists across sessions (Priority: P3)

**Goal**: The chosen interval is restored automatically the next time the app opens, without the user reselecting it.

**Independent Test**: Set an interval, reload the web page (or restart the mobile app), and confirm Settings shows the same interval selected and auto-refresh resumes without reselecting it.

### Tests for User Story 3

- [X] T027 [P] [US3] Add a test to `web/src/context/PriceRefreshContext.test.tsx`: seed `localStorage.setItem('price_refresh_interval', '60000')` before mounting a fresh `PriceRefreshProvider`, and assert `interval === 60000` is restored without any user action (mirrors `BalanceContext.test.tsx`'s "loads stored value on mount" test)
- [X] T028 [P] [US3] Add a test confirming that an absent or corrupt stored value defaults `interval` to `null` (Manual) on mount

### Implementation for User Story 3

No new production code: persistence is already built into `PriceRefreshContext` (T012/T016) since its `useState` initializer reads from storage exactly like `BalanceContext`. This phase is test-only, confirming that behavior already holds on web.

- [ ] T029 [US3] Manually verify mobile persistence (interval survives force-close/reopen) per `quickstart.md`'s Mobile section, since `mobile/` has no automated test suite (see AGENTS.md)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T030 Run `cd web && npm run coverage` and confirm ≥90% coverage on changed modules (`PriceRefreshContext.tsx`, `AppLayout.tsx`, `settings.tsx`); paste the summary in the PR description
- [X] T031 Run `cd web && npm test` and `cd backend && pytest` (backend is untouched by this feature but the constitution's pre-PR gate requires both) and fix any failures before opening the PR

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None — nothing to initialize.
- **Foundational (Phase 2)**: No dependency on Setup (empty); BLOCKS all user stories.
- **User Stories (Phase 3+)**: All depend on Foundational phase completion (T001-T017). Can proceed in priority order (P1 → P2 → P3); US2 and US3 both assume US1's scheduling effects (T020-T022) already exist, since they test the absence/persistence of behavior US1 introduces.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational. No dependency on other stories.
- **User Story 2 (P2)**: Starts after US1's scheduling effects exist (T020-T022) — it tests the "off" branch of code US1 introduces, so it is sequenced after US1 rather than truly parallel.
- **User Story 3 (P3)**: Starts after Foundational (T012/T016) — persistence is inherent to the context itself, not to US1's scheduling effects, so it could run in parallel with US1/US2 if staffed separately.

### Parallel Opportunities

- All ten locale tasks (T002-T011) run in parallel — independent files.
- T012 (web context) and T016 (mobile context) can run in parallel — independent files/platforms.
- T013 (web context test) can run in parallel with T014/T015 (wiring) once T012 lands.
- T021 (wallet.tsx) and T022 (profit.tsx) run in parallel — independent files.
- T024, T025 (US2 tests) and T027, T028 (US3 tests) can all run in parallel with each other.

---

## Parallel Example: Foundational Phase

```bash
Task: "Update shared/src/i18n/locales/pt-BR.ts with new refresh option keys"
Task: "Update shared/src/i18n/locales/en-US.ts with new refresh option keys"
Task: "Update shared/src/i18n/locales/es-ES.ts with new refresh option keys"
# ... remaining locale files, all independent

Task: "Create web/src/context/PriceRefreshContext.tsx"
Task: "Create mobile/src/context/PriceRefreshContext.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (i18n keys + both contexts + provider wiring).
2. Complete Phase 3: User Story 1 (live selectors + scheduling effects on both platforms).
3. **STOP and VALIDATE**: Run `quickstart.md`'s Web and Mobile steps 1-3 manually; run T018.
4. This alone satisfies the plan item's core "Done when" criteria (30s selection triggers automatic calls).

### Incremental Delivery

1. Foundational → Foundation ready.
2. User Story 1 → independently testable → this is the MVP.
3. User Story 2 → confirms the "off" path, no new production code.
4. User Story 3 → confirms persistence, no new production code.
5. Polish → coverage + full test-suite gate before PR.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- US2 and US3 are deliberately test-only phases here: the scheduling effect built in US1 (T020-T022) and the context built in Foundational (T012/T016) already satisfy their requirements by construction — adding separate "off" or "persistence" implementation code would duplicate logic already covered by the constitution's No Speculative Code principle.
- Commit after each phase (or logical group within Foundational), following the single-line Conventional Commit format required by this repo.

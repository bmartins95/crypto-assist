# Tasks: Collapsible Sidebar Navigation

**Input**: Design documents from `/specs/007-sidebar-collapsible/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/routes.md

**Tests**: Included — required by Constitution Principle III (behaviour coverage) and the spec's SC-004/FR checklist.

**Organization**: Tasks grouped by user story; US1 (routes) is the MVP increment, US2 (collapse) and US3 (footer) layer onto the same shell.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Additive i18n keys and CSS groundwork that every story consumes.

- [ ] T001 Add `nav_wallet`, `nav_profit`, `nav_history` to `UIText` in `shared/src/i18n/types.ts` (reuse existing `nav_settings`, `nav_logout`)
- [ ] T002 [P] Add the three new keys with accurate translations to all 10 locale files `shared/src/i18n/locales/{pt-BR,en-US,es-ES,fr-FR,de-DE,zh-CN,ja-JP,ar-SA,hi-IN,ru-RU}.ts`
- [ ] T003 [P] Add sidebar/layout CSS to `web/src/app/globals.css`: `.layout`, `.layout.collapsed` (232px→66px grid, .22s transition), `.sb`, `.sb-top`, `.brand`, `.collapse-btn`, `.navlbl`, `.navi`, `.navi.active`, `.sb-foot`, `.userchip`, `.avatar`, collapsed-state rules, `[data-tip]` tooltip `::after`, and the ≤820px single-column media query — all colors mapped to existing theme-aware `--s-*` tokens (add `--s-border` and `--s-text` only if missing; research.md R2)

**Checkpoint**: `cd web && npm test` still green (no consumer changes yet); TypeScript compiles across shared/web.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shell that all three stories render inside.

- [ ] T004 Create `web/src/components/AppLayout.tsx`: `collapsed` state with lazy init from `localStorage('sidebar:collapsed') === '1'` (research.md R5), toggle writes `'1'`/`'0'`; move ALL portfolio state/handlers from `web/src/app/dashboard/page.tsx` (ops, exitPrices, prices, avatarCache, loading, statusMsg, groupMode, activeChart, assets memo, reloadFromBackend, legacy-migration effect, handleAddOp/EditOp/RemoveOp, handleExitPriceChange, fetchPrices + auto-fetch ref, handleImport wiring) into a `PortfolioProvider` context + `usePortfolio()` hook defined in this module; render `<div className={collapsed ? 'layout collapsed' : 'layout'}><Sidebar …/><main className="content"><Outlet/></main></div>` with the loading empty-state gate around the Outlet
- [ ] T005 Create `web/src/components/Sidebar.tsx` per contracts/routes.md: props `{ collapsed, onToggle }`; brand + collapse button (`aria-expanded={!collapsed}`, i18n `aria-label`, `ti ti-chevron-left` rotating when collapsed); nav `<Link>` items for `/wallet` (`ti ti-wallet`), `/profit` (`ti ti-trending-up`), `/history` (`ti ti-receipt`) with `activeProps={{ className: 'navi active' }}` and `data-tip` labels; footer with Settings `<Link to="/settings">` (`ti ti-settings`), Logout button reusing the logout logic from `web/src/components/LogoutButton.tsx` styled as `.navi`, and user chip (avatar initial + email from `getEmailFromIdToken(getSession().id_token)`, email hidden when collapsed)

**Checkpoint**: Components compile; not yet routed.

---

## Phase 3: User Story 1 — Navigate between views via sidebar routes (P1) 🎯 MVP

**Goal**: `/wallet`, `/profit`, `/history` are real guarded routes inside the sidebar shell; `/dashboard` removed; `/` → `/wallet`.

**Independent Test**: Sign in → land on `/wallet`; click each nav item → URL + view change with no refetch; back button works; `/dashboard` is not found; signed-out access redirects to `/auth`.

- [ ] T006 [US1] Rewrite `web/src/router.tsx`: pathless `appLayoutRoute` (`id: 'app'`, `beforeLoad` session guard → redirect `/auth`, component `AppLayout`) with child routes `/wallet`, `/profit`, `/history`, `/settings`; each child a thin component consuming `usePortfolio()` and rendering `WalletTab` / `ProfitTab` / `HistoryTab` with the same props as today (settings child renders `SettingsPage` with its in-page title/subtitle header from the old `SettingsLayout`); `/` redirect → `/wallet`; `/auth` guard redirect → `/wallet`; delete `DashboardLayout`, `SettingsLayout`, and the `/dashboard` route
- [ ] T007 [US1] Update `AuthCallbackPage` success redirect in `web/src/router.tsx` from `/dashboard` to `/wallet`; grep the whole `web/src/` tree for remaining `'/dashboard'` references (e.g. `AuthClient.tsx`) and update them
- [ ] T008 [US1] Delete `web/src/app/dashboard/page.tsx` and `web/src/app/dashboard/page.test.tsx`; remove now-unused imports/types if any (e.g. `TabType` if orphaned in `web/src/lib/types.ts`)
- [ ] T009 [US1] Create `web/src/components/AppLayout.test.tsx` re-covering moved behaviours from the deleted page test: initial ops/exitPrices load, load-failure status message, legacy-migration confirm flow, auto price fetch once, add/edit/remove op handler wiring via context, and route rendering (wallet/profit/history render their tab content; switching does not refetch — assert `api.getOps` called once)

**Checkpoint**: US1 acceptance scenarios 1–6 pass manually and in tests — MVP deliverable.

---

## Phase 4: User Story 2 — Collapse and expand with persistence (P2)

**Goal**: 66px icon rail with tooltips; state survives reload.

**Independent Test**: Toggle collapse → rail narrows, labels hide, tooltips on hover; reload → still collapsed; toggle back → expanded.

- [ ] T010 [US2] Verify/finish collapsed-state behaviour in `web/src/components/Sidebar.tsx` + `globals.css`: labels hidden, icons centered, chevron rotated, `data-tip` tooltips visible on hover only when collapsed, collapse button still reachable
- [ ] T011 [US2] Create `web/src/components/Sidebar.test.tsx`: renders 3 nav items + footer from i18n, active route highlighted, `aria-expanded` reflects state, `onToggle` fires on click, `data-tip` attributes present, user chip shows email/initial
- [ ] T012 [US2] Add persistence tests to `web/src/components/AppLayout.test.tsx`: initial render collapsed when `localStorage['sidebar:collapsed']==='1'`, expanded when absent/garbage, toggle writes the key

**Checkpoint**: US2 acceptance scenarios 1–4 pass.

---

## Phase 5: User Story 3 — Account actions in sidebar footer (P3)

**Goal**: Old top bar gone everywhere; Settings/Logout/user chip live in the footer; Settings renders inside the shell.

**Independent Test**: No floating email/Settings/Logout bar on any route; footer Settings navigates to `/settings` (sidebar still visible); footer Logout signs out; chip truncates long emails.

- [ ] T013 [US3] Confirm removal of both old top bars (previously in `DashboardLayout`/`SettingsLayout` in `web/src/router.tsx`) and that `web/src/pages/settings.tsx` renders correctly inside the shell with its title/subtitle header; keep `LogoutButton` only where the footer uses it (refactor `web/src/components/LogoutButton.tsx` if its markup doesn't fit `.navi` styling)
- [ ] T014 [US3] Update `web/src/pages/settings.test.tsx` and any tests referencing the old layouts/routes; add footer assertions to `web/src/components/Sidebar.test.tsx` (Settings link target, logout click calls signout, long email truncation class)

**Checkpoint**: US3 acceptance scenarios 1–4 pass.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T015 [P] Locale sweep: assert sidebar labels switch immediately on locale change (test in `web/src/components/Sidebar.test.tsx` using `LocaleProvider` wrapper) and verify no missing-key fallback in any of the 10 locales (i18n completeness is compiler-enforced; run `npx tsc --noEmit` in `web/`)
- [ ] T016 [P] Verify mobile still type-checks against updated `shared/` (`cd mobile && npx tsc --noEmit`) — Constitution Principle I
- [ ] T017 Run `cd web && npm test` and `cd web && npm run coverage`; ensure ≥90% on changed modules (`Sidebar.tsx`, `AppLayout.tsx`, `router.tsx`); run `cd backend && pytest` (should be untouched/green); fix all failures
- [ ] T018 Manual quickstart walkthrough (`specs/007-sidebar-collapsible/quickstart.md`) including theme toggle + ≤820px responsive check against `docs/design/dashboard-collapsible-sidebar.html`

---

## Dependencies

- Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) → Phase 6
- US2 and US3 both depend on the shell landed in US1 (single-shell feature; stories layer rather than fork)
- T001 blocks T002 (type before locales); T004 blocks T005-T009

## Parallel Opportunities

- T002 (locale files) ∥ T003 (CSS) after T001
- T010/T011 ∥ T013/T014 touch different files once US1 is merged locally
- T015 ∥ T016 in Phase 6

## Implementation Strategy

MVP = Phases 1–3 (routes + shell). US2/US3 are small increments on the same components; all land in this single branch/PR per PLAN Item 6.

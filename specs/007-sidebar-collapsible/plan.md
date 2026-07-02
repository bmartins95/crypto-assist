# Implementation Plan: Collapsible Sidebar Navigation

**Branch**: `feat/sidebar-collapsible` | **Date**: 2026-07-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-sidebar-collapsible/spec.md`

## Summary

Replace the web app's floating top-bar navigation and in-page tab switching with a persistent collapsible sidebar shell. `/wallet`, `/profit`, and `/history` become real TanStack Router routes rendered inside a new `AppLayout` that owns the sidebar collapsed state (persisted to `localStorage('sidebar:collapsed')`) and the shared portfolio data (ops, prices, exit targets — fetched once, shared across views via router `Outlet` context). `/settings` moves into the same shell. The legacy `/dashboard` route is removed. Sidebar labels come from the i18n layer; three new keys (`nav_wallet`, `nav_profit`, `nav_history`) are added to all 10 locales.

## Technical Context

**Language/Version**: TypeScript (strict), React 19

**Primary Dependencies**: Vite, TanStack Router (code-based routes in `web/src/router.tsx`), `@crypto-assist/shared` (i18n), Tabler icon font (`ti ti-*`, already used)

**Storage**: `localStorage` key `sidebar:collapsed` (`'1'` collapsed, anything else expanded); no backend or DB changes

**Testing**: Vitest + Testing Library (`cd web && npm test`); backend untouched

**Target Platform**: Web (desktop-first; prototype defines single-column stacking below 820px)

**Project Type**: Web frontend refactor within existing monorepo package `web/`

**Performance Goals**: Route switches between the three views render instantly from shared state (no refetch, no loading flash); collapse animation 0.22s CSS grid transition

**Constraints**: No new npm packages. No `shared/` changes beyond additive i18n keys (mobile type contract unaffected). View content (WalletTab/ProfitTab/HistoryTab) is not redesigned — Items 7–9 own that.

**Scale/Scope**: ~2 new components, 1 rewritten router, 1 deleted page shell, CSS additions, 10 locale files touched, test updates

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Shared-First | PASS | Only additive `UIText` keys in `shared/src/i18n/`; TypeScript forces all 10 locale files to add them; mobile unaffected (additive interface change, mobile compiles) |
| II. Security at Boundary | PASS | No API/backend changes; no new inputs; logout reuses existing `LogoutButton` flow |
| III. Behavior Coverage | PASS (planned) | Tests: sidebar renders/highlights/collapses/persists, routes render correct views, auth guard redirects, locale switch updates labels |
| IV. No Speculative Code | PASS | Exactly the shell from PLAN Item 6; no MetricCard/ContentHeader (Item 7), no drawer (Item 9) |
| V. A11y & i18n | PASS (planned) | Collapse button `aria-label` + `aria-expanded`; all labels via `useLocale()`; icon-only elements get accessible labels |

Post-design re-check: PASS — no violations introduced by the design below; Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/007-sidebar-collapsible/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Sidebar preference + layout state
├── quickstart.md        # How to run/verify
├── contracts/
│   └── routes.md        # Route table + layout contract
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
web/src/
├── router.tsx                    # REWRITE: appLayoutRoute + /wallet /profit /history /settings children; remove /dashboard + DashboardLayout + SettingsLayout
├── components/
│   ├── Sidebar.tsx               # NEW: collapsible sidebar (props: collapsed, onToggle)
│   ├── Sidebar.test.tsx          # NEW
│   ├── AppLayout.tsx             # NEW: shell; owns collapsed state + portfolio data; renders <Sidebar> + <main><Outlet/></main>
│   ├── AppLayout.test.tsx        # NEW
│   └── LogoutButton.tsx          # unchanged, rendered in sidebar footer
├── app/
│   ├── dashboard/page.tsx        # DELETE (logic moves to AppLayout + route components)
│   ├── dashboard/page.test.tsx   # DELETE (behaviour re-covered in AppLayout.test.tsx)
│   └── globals.css               # ADD: .layout .sb .navi .userchip tooltip + collapsed rules (mapped to --s-* theme tokens)
├── pages/
│   └── settings.tsx              # unchanged content; header (title/subtitle) moves in-page from old SettingsLayout
shared/src/i18n/
├── types.ts                      # ADD nav_wallet, nav_profit, nav_history (nav_settings/nav_logout exist)
└── locales/*.ts                  # ADD the 3 keys to all 10 locales
```

**Structure Decision**: Follow existing patterns — code-based routes in `router.tsx`, components in `web/src/components/`, contexts untouched. `AppLayout` absorbs `DashboardPage`'s data fetching (ops/exitPrices/prices/avatars/status + handlers) and exposes it to child routes via TanStack Router's `Outlet` context (`useOutletContext` equivalent: `Route.useRouteContext` is for static context, so we pass via React context — see research.md R4). The three route components are thin wrappers selecting WalletTab/ProfitTab/HistoryTab with the shared data.

## Complexity Tracking

No constitution violations — table not required.

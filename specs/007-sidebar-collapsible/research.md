# Research: Collapsible Sidebar Navigation

## R1 — How to share portfolio data across the three routes

**Decision**: Move `DashboardPage`'s state (ops, exitPrices, prices, avatarCache, loading, statusMsg, groupMode, activeChart) and handlers into a `PortfolioProvider` React context rendered by `AppLayout`, consumed by the three thin route components via a `usePortfolio()` hook defined in the same module as the provider.

**Rationale**: Clarification session chose "shared layout state" — data fetched once, instant route switches, refresh-on-demand preserved. React context is the established pattern in this codebase (LocaleContext, ThemeContext, BalanceContext). TanStack Router's `beforeLoad` context is static/loader-oriented and awkward for mutable client state with setters.

**Alternatives considered**: Per-route loaders (rejected in clarification — refetch on every nav); prop drilling through `Outlet` (TanStack Router `Outlet` does not forward arbitrary props); a data library like TanStack Query (new dependency, prohibited by Principle IV).

## R2 — Where the sidebar CSS tokens come from

**Decision**: Map the prototype's `--surface`, `--border`, `--accent`, etc. onto the existing theme-aware `--s-*` tokens in `globals.css` (`--s-surface`, `--s-surface-hover`, `--s-border-soft`, `--s-accent`, `--s-text-muted`, `--s-text-dim`). Add only tokens that are missing (e.g. a plain `--s-border` if absent) rather than introducing a parallel unprefixed token set.

**Rationale**: PLAN Item 6 says tokens "should align with the tokens already established by the settings page". The `--s-*` set already switches with `data-theme` (light/dark/system from Item 5), so the sidebar automatically respects the theme toggle. A duplicate unprefixed set would break light theme and violate Principle IV.

**Alternatives considered**: Copying the prototype's `:root` block verbatim (dark-only, ignores the theme feature shipped in Item 5).

## R3 — Icons

**Decision**: Use the Tabler icon font classes already in the app (`ti ti-wallet`, `ti ti-trending-up`, `ti ti-receipt`, `ti ti-settings`, `ti ti-logout`, `ti ti-chevron-left`).

**Rationale**: The current nav and settings link already use these exact glyphs; no new dependency; the prototype's inline SVGs are visual equivalents.

**Alternatives considered**: Inline SVGs from the prototype (more markup, duplicates an icon system already present).

## R4 — Route structure in TanStack Router (code-based)

**Decision**: Create `appLayoutRoute` (a pathless layout route with `id: 'app'`, `beforeLoad` auth guard, component `AppLayout`) with children `/wallet`, `/profit`, `/history`, `/settings`. Root `/` redirects to `/wallet`. `/auth` and `/auth/callback` stay at root level. `/dashboard` route deleted. Update `AuthClient`/callback redirects that point at `/dashboard` to `/wallet`.

**Rationale**: One auth guard on the layout route replaces four per-route guards; the layout route renders the sidebar exactly once. Pathless layout routes are the canonical TanStack Router pattern for shared chrome.

**Alternatives considered**: Repeating the guard and `<AppLayout>` per route (duplication); file-based routing migration (out of scope, larger change than Item 6 requires).

## R5 — Collapsed-state persistence & first paint

**Decision**: Lazy `useState` initializer reading `localStorage.getItem('sidebar:collapsed') === '1'`; write `'1'`/`'0'` on toggle. Any other/missing value → expanded.

**Rationale**: Matches the design notes verbatim; synchronous read in the initializer means the collapsed layout is correct on first render (no flash). Same pattern as ThemeContext.

**Alternatives considered**: Effect-based read after mount (causes expand→collapse flash).

## R6 — Legacy `/dashboard` and other redirects

**Decision**: Remove the `/dashboard` route entirely (clarified). Grep for `'/dashboard'` and update every reference: `router.tsx` index redirect, `/auth` beforeLoad redirect target, `AuthCallbackPage` success redirect, and any tests.

**Rationale**: User explicitly chose removal over redirect; leftover references would throw type errors with TanStack Router's typed `to` anyway.

## R7 — What happens to `dashboard/page.test.tsx`

**Decision**: Delete `web/src/app/dashboard/page.tsx` and its test; re-cover the behaviours (initial load, legacy-migration prompt, price fetch, handler wiring) in `AppLayout.test.tsx`, and route-rendering assertions in a router-level test.

**Rationale**: The behaviours move, so the tests move with them; keeping a dead page violates the no-dead-code rule.

# Feature Specification: Collapsible Sidebar Navigation

**Feature Branch**: `feat/sidebar-collapsible`

**Created**: 2026-07-01

**Status**: Draft

**Input**: User description: "PLAN.md Item 6 — Collapsible sidebar navigation: replace the top-bar navigation with a persistent collapsible sidebar; /wallet, /profit, /history become real routes; sidebar collapses to 66px icon rail with tooltips; state persists in localStorage; Settings and Logout move to sidebar footer. Design references: docs/design/dashboard-collapsible-sidebar.html and docs/design/dashboard-refactor-notes.md"

## Clarifications

### Session 2026-07-01

- Q: How should portfolio data behave when navigating between /wallet, /profit, and /history? → A: Shared layout state — data is fetched once in the authenticated layout shell; switching routes is instant with no refetch; the refresh button still refetches on demand.
- Q: What happens to the legacy /dashboard URL? → A: Remove it entirely — no redirect; old bookmarks hit the router's not-found handling.
- Q: Does /settings render inside the new sidebar shell in this item? → A: Yes — Settings becomes a child of the app layout; its old top bar (back link + Logout) is removed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigate between views via sidebar routes (Priority: P1)

A signed-in user sees a persistent sidebar on the left with three portfolio destinations — Wallet, Profit, and History. Clicking a destination navigates to its own URL (`/wallet`, `/profit`, `/history`) and renders the corresponding view. The active destination is visually highlighted. The browser back/forward buttons and bookmarks work because each view is a real address.

**Why this priority**: This is the core structural change — turning in-page tabs into routed views. Every other story builds on this shell.

**Independent Test**: Sign in, click each sidebar item, and confirm the URL changes, the correct view renders, and the active item is highlighted. Use the browser back button and confirm it returns to the previous view.

**Acceptance Scenarios**:

1. **Given** a signed-in user on `/wallet`, **When** they click "Lucro" in the sidebar, **Then** the URL becomes `/profit` and the Profit view renders with the Profit item highlighted.
2. **Given** a signed-in user on `/profit`, **When** they press the browser back button, **Then** they return to `/wallet` and the Wallet view renders.
3. **Given** a signed-out visitor, **When** they open `/wallet`, `/profit`, or `/history` directly, **Then** they are redirected to the sign-in page.
4. **Given** a signed-in user, **When** they open the root URL `/`, **Then** they land on `/wallet`.
5. **Given** a signed-in user, **When** they navigate from `/wallet` to `/profit` or `/history`, **Then** the view renders immediately with the already-loaded portfolio data (no loading state, no refetch).
6. **Given** a signed-in user, **When** they open the legacy `/dashboard` URL, **Then** the route no longer exists and the router's not-found handling applies.

---

### User Story 2 - Collapse and expand the sidebar with persistence (Priority: P2)

A user can collapse the sidebar into a narrow icon-only rail to gain content space, and expand it back. While collapsed, hovering an icon shows a tooltip with its label. The chosen state survives page reloads on the same device.

**Why this priority**: The collapse behaviour is the headline UX improvement of this item, but the app is fully usable without it.

**Independent Test**: Click the collapse control, confirm the rail shrinks to icon-only width with tooltips on hover, reload the page, and confirm the sidebar is still collapsed.

**Acceptance Scenarios**:

1. **Given** an expanded sidebar, **When** the user clicks the collapse control, **Then** the sidebar narrows to a 66px icon-only rail, labels hide, and the collapse control remains reachable.
2. **Given** a collapsed sidebar, **When** the user hovers a navigation icon, **Then** a tooltip with the item's label appears.
3. **Given** a collapsed sidebar, **When** the user reloads the page, **Then** the sidebar renders collapsed on first paint of the layout.
4. **Given** a collapsed sidebar, **When** the user clicks the collapse control again, **Then** the sidebar expands and labels reappear.

---

### User Story 3 - Account actions live in the sidebar footer (Priority: P3)

The old floating top bar (email, Settings link, Logout button) is gone. The sidebar footer now holds the Settings link, the Logout button, and a user chip showing the signed-in email. Settings opens the existing Settings page; Logout signs the user out as before.

**Why this priority**: Relocation of existing functionality — important for the design's coherence but no new capability.

**Acceptance Scenarios**:

1. **Given** a signed-in user on any of the three views, **When** they look at the top of the content area, **Then** no floating email/Settings/Logout bar is present.
2. **Given** the sidebar footer, **When** the user clicks Settings, **Then** they navigate to `/settings`, which renders inside the sidebar shell (its old top bar with back link and Logout is removed).
3. **Given** the sidebar footer, **When** the user clicks Logout, **Then** they are signed out exactly as with the previous Logout button.
4. **Given** a signed-in user, **When** they view the sidebar footer, **Then** a user chip shows their email (and only an avatar initial when collapsed).

---

### Edge Cases

- No stored sidebar preference (first visit): sidebar renders expanded by default.
- Stored preference has an unexpected value: treated as expanded (safe default).
- Locale switch while the sidebar is visible: all sidebar labels update immediately, in both expanded and collapsed (tooltip) modes.
- Very long email address in the user chip: truncated with ellipsis, never breaking the sidebar layout.
- Keyboard-only user: sidebar links, collapse control, and Logout are focusable and operable via keyboard; the collapse control exposes its expanded/collapsed state to assistive technology.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST expose Wallet, Profit, and History as distinct authenticated routes (`/wallet`, `/profit`, `/history`), each rendering the existing corresponding view content unchanged (view redesigns are Items 7–9).
- **FR-002**: The root URL `/` MUST redirect signed-in users to `/wallet`; the legacy `/dashboard` route MUST be removed entirely (no redirect).
- **FR-002a**: Portfolio data (operations, prices, exit targets) MUST be loaded once at the authenticated layout level and shared by the three views; switching routes MUST NOT trigger a refetch, while the per-view refresh action still refetches on demand.
- **FR-003**: Unauthenticated access to any of the three routes (and `/settings`) MUST redirect to the sign-in page, preserving the existing auth-guard behaviour.
- **FR-004**: A persistent sidebar MUST be visible on `/wallet`, `/profit`, `/history`, and `/settings`, showing brand, the three portfolio destinations, and a footer with Settings, Logout, and a user chip (email + avatar initial).
- **FR-005**: The sidebar MUST highlight the destination matching the current route.
- **FR-006**: A collapse control MUST toggle the sidebar between a 288px expanded state (wide enough for the full app name in the brand) and a 66px icon-only rail, with labels hidden and icons centered when collapsed.
- **FR-007**: While collapsed, hovering a sidebar item MUST show a tooltip with the item's label.
- **FR-008**: The collapsed/expanded preference MUST persist per device across page reloads and restore on layout load.
- **FR-009**: The old floating top bar (email, Settings link, Logout) MUST be removed from all pages.
- **FR-010**: All sidebar labels MUST come from the i18n layer and update immediately on locale change; new label keys (Wallet, Profit, History navigation labels) MUST exist in all 10 supported locales.
- **FR-011**: The collapse control MUST convey its state to assistive technology, and every icon-only interactive element MUST have an accessible label.
- **FR-012**: The Logout action in the sidebar footer MUST reuse the existing logout behaviour (session cleared, redirect to sign-in).

### Key Entities

- **Sidebar preference**: A per-device boolean (collapsed / expanded) persisted locally; no server-side storage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can reach any of the three portfolio views in one click from anywhere in the app, and each view is directly addressable by URL (bookmark/back button work in 100% of the acceptance walkthroughs).
- **SC-002**: The collapsed sidebar frees at least 160px of horizontal content width compared to the expanded state.
- **SC-003**: The sidebar preference survives a page reload 100% of the time on the same browser profile.
- **SC-004**: Zero regressions in existing behaviour: all pre-existing web tests pass (updated for the new routes), and Wallet/Profit/History content renders with the same data as before the change.
- **SC-005**: All sidebar labels render correctly in all 10 supported locales with no missing-key fallbacks.

## Assumptions

- This item delivers the shell and routing only; the visual redesign of the Wallet, Profit, and History views is deferred to Items 7–9 as stated in PLAN.md.
- The legacy `/dashboard` route is removed without a redirect (clarified 2026-07-01); stale bookmarks fall through to the router's not-found handling.
- Mobile (React Native) app is out of scope — this is a web-only navigation change; no `shared/` type contracts change beyond adding i18n label keys, which mobile tolerates additively.
- The design prototype `docs/design/dashboard-collapsible-sidebar.html` and `docs/design/dashboard-refactor-notes.md` are the visual source of truth (tokens, spacing, widths 232px/66px).
- Responsive behaviour below tablet width follows the prototype; no separate mobile-web drawer is introduced in this item.
- The sidebar preference is stored locally per device (no account-level sync), consistent with existing theme and hide-balances preferences.

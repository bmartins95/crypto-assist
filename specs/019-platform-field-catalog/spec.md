# Feature Specification: Platform Field Catalog

**Feature Branch**: `feat/platform-field-catalog`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "Implement PLAN.md Item 22 — Platform field catalog (logo + name + category). Branch from develop as feat/platform-field-catalog. Full item text is in PLAN.md (search 'Item 22'). Design reference: docs/design/platform-field-redesign.html (pixel source of truth) and docs/design/platform-field-implementation.md (component contracts, CSS, file list). Depends on items 7, 9, 13 which are already merged to develop. Summary of the feature: refactor the free-text `platform` field on operations into a first-class entity with logo, name, and category (exchange/wallet/defi/custom), replacing plain text inputs/displays with new PlatformLogo/PlatformChip/PlatformSelect components across the operation drawer (OpDrawer.tsx), History table (HistoryTab.tsx), and both Wallet grouped views (WalletTab.tsx 'Por plataforma' and 'Ativo + plataforma'). Backend gains a cached CoinGecko /exchanges proxy endpoint and an additive DB migration adding platform_id/platform_name columns to ops (old platform column deprecated but not dropped). Curated wallet/DeFi seed list ships in-repo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pick a platform from a searchable catalog when registering an operation (Priority: P1)

When registering a buy, sell, or trade operation, a user searches for the exchange, wallet, or DeFi protocol they used instead of typing a free-text name from memory. Results are grouped by category and show each platform's logo, so the user can recognize and pick the right one quickly, exactly the way they already pick the coin/asset.

**Why this priority**: This is the entry point for all platform data going forward — if operations keep being saved with inconsistent free-text names ("Binance", "binance", "Binance "), every downstream view (History, Wallet groupings) stays fragmented. Fixing entry is the precondition for every other story.

**Independent Test**: Can be fully tested by opening the operation drawer, typing into the Platform field, confirming grouped/filtered results with logos appear, selecting one, and confirming the drawer submits the operation with that platform's identity attached.

**Acceptance Scenarios**:

1. **Given** the operation drawer is open on any of the three types (Buy, Sell, Trade), **When** the user focuses the Platform field, **Then** a dropdown opens showing the full catalog grouped by category (Exchanges, Wallets, DeFi), each row showing a logo and name.
2. **Given** the dropdown is open, **When** the user types part of a platform's name, **Then** the list filters to matching platforms (case-insensitive, substring match) across all categories.
3. **Given** the user has typed a name that matches no catalog entry, **When** they view the bottom of the dropdown, **Then** an option to "use '<text>' as a custom platform" is available and is part of the keyboard-navigable list.
4. **Given** the user selects a platform (catalog or custom), **When** the dropdown closes, **Then** the input shows the platform's name with its logo displayed inline at the start of the field.
5. **Given** the user submits the operation, **When** it is saved, **Then** the operation is associated with the selected platform's identity (not just a loose text string), and re-opening that operation for editing shows the same platform pre-selected with its logo.
6. **Given** the dropdown is open, **When** the user presses the down/up arrow keys and Enter, or presses Escape, **Then** the highlighted item moves accordingly, Enter selects the highlighted item, and Escape closes the dropdown without changing the current value.

---

### User Story 2 - Recognize where each operation happened at a glance in History (Priority: P1)

Looking at the operations table, a user recognizes the platform of each row by its logo instantly, without reading the text — the way coin logos already let them recognize assets at a glance.

**Why this priority**: History is the highest-traffic read view for platform data (every operation ever recorded lives here) and today shows only plain gray text with an em-dash fallback for missing values — the least informative of the three affected views.

**Independent Test**: Can be tested by opening the History view with a mix of catalog-matched and custom platforms in past operations and confirming every row shows a logo (or initials-avatar fallback) next to the platform name, with custom platforms visually tagged.

**Acceptance Scenarios**:

1. **Given** the History table has rows with platforms that exist in the catalog, **When** the table renders, **Then** each row's Platform column shows that platform's logo next to its name.
2. **Given** a row's platform is a custom (non-catalog) value, **When** the table renders, **Then** the row shows a deterministic initials avatar for that platform and a visual "custom" tag distinguishing it from catalog platforms.
3. **Given** a platform's logo image fails to load, **When** the table renders, **Then** the row silently falls back to the initials avatar — no broken-image icon is ever shown.

---

### User Story 3 - Understand portfolio composition by platform in the Wallet view (Priority: P2)

In the Wallet view's "By platform" and "Asset + platform" groupings, a user sees each platform's real logo and category (instead of plain text or a generic placeholder icon), and sees each group's total value and return without needing to sum the underlying rows mentally.

**Why this priority**: This is a comprehension/at-a-glance improvement on top of data that is already displayed today (unlike Stories 1-2, no new data is being captured here) — so it is valuable but not blocking for the rest of the feature to ship.

**Independent Test**: Can be tested by switching the Wallet view to "By platform" and to "Asset + platform" grouping and confirming real logos, category badges, and a group total + return appear.

**Acceptance Scenarios**:

1. **Given** the Wallet view is grouped "By platform", **When** the table renders, **Then** the first column of each row shows that platform's logo (bold, larger size) next to its name.
2. **Given** the Wallet view is grouped "Asset + platform", **When** a group header renders, **Then** it shows the platform's real logo, its category badge (Exchange/Wallet/DeFi/Custom), and the group's total value and return percentage aligned to the right of the header.
3. **Given** a platform has no assets remaining after a full sell-off, **When** the grouped views are computed, **Then** that platform's group is omitted (existing behavior for empty groups is preserved).

---

### Edge Cases

- What happens when a user selects a custom platform that happens to share a name with an existing catalog entry, differing only by case or extra whitespace? The system treats it as a match to the existing catalog entry rather than creating a duplicate custom entry.
- What happens when the CoinGecko exchange list is temporarily unavailable? The catalog still shows the curated wallet/DeFi entries and allows creating a custom platform; the exchange group is empty or omitted rather than blocking the whole picker.
- What happens to operations recorded before this feature shipped? Existing free-text platform values are migrated to resolve against the catalog (exact/near matches) or become custom platforms, so every historical operation still renders a name and an avatar — never blank.
- What happens when two different operations use platform names that are near-duplicates due to typos (e.g., "Metamask" vs "MetaMask")? Only exact (case-insensitive, trimmed) matches are treated as the same platform during migration; near-duplicate typos remain distinct custom platforms unless the user re-selects the correct one going forward.
- What happens if a user clears the Platform field entirely and submits? The operation is saved with no platform (existing "no platform" fallback label continues to apply), consistent with today's optional-platform behavior.
- What happens when a user is offline or the platform catalog fails to load entirely? The field still accepts a typed value and offers it as a custom platform, so operation entry is never blocked by catalog availability.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a user search a categorized platform catalog (Exchange, Wallet, DeFi) by name from the operation drawer's Platform field, with results grouped by category and each result showing a logo.
- **FR-002**: The system MUST let a user select a platform not present in the catalog and register it as a "custom" platform, generating a deterministic, name-based fallback visual identity (same name always produces the same identity) with no manual configuration required.
- **FR-003**: The system MUST support full keyboard operation of the platform picker: arrow keys to move the highlight (including through the custom-platform option), Enter to select, Escape to close without changing the value.
- **FR-004**: The system MUST persist a selected platform's identity on the operation record (not just its display text), so re-opening an operation for editing shows the same platform pre-selected.
- **FR-005**: The system MUST display each operation's platform with its logo (or initials-avatar fallback) in the History table, and MUST visually distinguish custom (non-catalog) platforms from catalog ones.
- **FR-006**: The system MUST display each platform's logo, category, and (for grouped views) aggregate total value and return in the Wallet view's "By platform" and "Asset + platform" groupings.
- **FR-007**: The system MUST fall back to a generated initials avatar whenever a platform has no logo image or its logo fails to load, and MUST never show a broken-image indicator.
- **FR-008**: The system MUST source exchange platforms from an external, regularly refreshed catalog and MUST NOT expose that external source's raw image URLs directly to end-user browsers (logos are served/cached through the system's own backend).
- **FR-009**: The system MUST source wallet and DeFi platforms (not obtainable from the exchange catalog) from a maintained, in-product list shipped with the application.
- **FR-010**: The system MUST migrate all pre-existing operations' free-text platform values so each resolves to either a matching catalog platform or a custom platform, without any operation losing its platform information or ending up blank as a result of the migration.
- **FR-011**: The system MUST distinguish coin/asset logos from platform logos through a consistent, distinct visual shape, so a user can tell at a glance which kind of logo they are looking at anywhere in the product.
- **FR-012**: The platform picker MUST remain usable (accepting a typed custom value) even when the external exchange catalog source is unreachable.
- **FR-013**: Every platform-picker input and every interactive result row MUST be operable and identifiable via assistive technology (proper combobox/listbox/option roles and labels), consistent with the product's existing accessibility requirements.

### Key Entities

- **Platform**: A named entity a user can attribute an operation to. Has an identity (stable identifier), a display name, a category (`exchange`, `wallet`, `defi`, or `custom`), and an optional logo. Catalog platforms (exchange/wallet/defi) are shared across all users; custom platforms are effectively user-typed labels with a generated fallback identity.
- **Operation (existing entity, extended)**: A buy/sell/trade record. Gains a reference to the Platform it was executed on, replacing today's loose free-text label, while remaining fully readable even for platforms typed before this feature existed.
- **Platform Catalog**: The searchable, categorized collection of known platforms (exchange + wallet + DeFi) presented to the user during selection, refreshed periodically from its external and in-product sources.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can find and select a well-known exchange, wallet, or DeFi platform from the picker in 3 keystrokes or fewer for common platforms (e.g., typing "bin" surfaces Binance).
- **SC-002**: 100% of operations — both newly created and pre-existing/migrated — render a recognizable platform identity (logo or initials avatar) in every view that shows platform, with zero blank or broken-image states.
- **SC-003**: A user unfamiliar with the product can distinguish a coin logo from a platform logo without being told, on first look (verified via the distinct shape convention).
- **SC-004**: Registering an operation with a platform not in the catalog takes no more steps than registering one that is in the catalog (both complete in one picker interaction).
- **SC-005**: In the Wallet view's grouped modes, a user can read each platform group's total value and return without performing any mental arithmetic across rows.

## Assumptions

- The platform picker's interaction model (focus-to-open, type-to-filter, grouped results, custom fallback row, keyboard navigation) mirrors the product's existing coin/asset search field closely enough that users transfer their existing mental model immediately, but keyboard arrow-key navigation is new work for this kind of field, not an existing capability being copied unchanged.
- "Exchange" platforms are sourced from CoinGecko's public exchange list, consistent with this product's existing CoinGecko-based price-provider integration; wallets and DeFi protocols are not available from that or any single external source and are maintained as an in-repo curated list, expected to grow over time via ordinary code changes rather than end-user submission.
- The migration of pre-existing free-text platform values is a one-time, best-effort resolution (exact case-insensitive/trimmed name matches become catalog platforms; everything else becomes a custom platform) — it does not attempt fuzzy/typo-tolerant matching, and any resulting misclassification is correctable by the user re-selecting the platform on that operation going forward.
- This feature covers the web application only; the mobile app's operation entry and portfolio screens are not redesigned as part of this feature, and this feature's data-model changes must not break the mobile app's ability to build and read/write operations.
- Logo assets for catalog platforms are treated as low-sensitivity, publicly available brand marks (already true of the coin logos already shown throughout the product); no licensing review is in scope for this engineering feature.
- "Regularly refreshed" for the exchange catalog means refreshed on a caching interval similar to this product's existing external price-data caching (on the order of hours, not real-time), since exchange identity/branding changes rarely.

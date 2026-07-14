# Feature Specification: Platform Field Catalog

**Feature Branch**: `feat/platform-field-catalog`

**Created**: 2026-07-11

**Status**: Draft

## Clarifications

### Session 2026-07-11

- Q: When a user types a custom (not-in-catalog) platform name, should that custom platform be visible only to them, or shared globally so other users see/reuse it too? → A: Private per-user — each user's custom platforms are scoped to their own account only; other users never see or match against them, even if they type an identical name, consistent with this app's existing per-user data isolation.
- Q: A JSON backup exported before this feature ships still carries the old free-text `platform` string instead of a platform identity — how should import handle that legacy field? → A: Resolve it the same way as the one-time database migration (match against the catalog, else fall back to a private custom platform), so pre-existing backups keep importing successfully with no behavior change visible to the user.

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

### User Story 2 - Recognize where each operation happened in History (Priority: P1)

Looking at the operations table, a user sees each row's actual platform name — resolved from the platform's stored identity, not a loose, possibly-stale free-text string.

**Why this priority**: History is the highest-traffic read view for platform data (every operation ever recorded lives here) and today shows only plain gray text with an em-dash fallback for missing values.

**Independent Test**: Can be tested by opening the History view with a mix of catalog-matched and custom platforms in past operations and confirming every row shows the correct resolved platform name.

**Acceptance Scenarios**:

1. **Given** the History table has rows with platforms that exist in the catalog, **When** the table renders, **Then** each row's Platform column shows that platform's current name.
2. **Given** a row's platform is a custom (non-catalog) value, **When** the table renders, **Then** the row shows that platform's name as plain text, indistinguishable in styling from a catalog platform.
3. **Given** an operation has no platform set, **When** the table renders, **Then** the row shows the existing em-dash fallback.

**Correction learned during implementation**: the original design reference (`docs/design/platform-field-redesign.html`) showed a per-row logo and a "personalizada" tag in History, matching Wallet's treatment. Per direct user feedback after this shipped, History was simplified to name-only text — no logo, no custom tag — keeping the richer visual treatment (logo, category badge, custom tag) exclusive to the Wallet grouped views (User Story 3), where a platform is the primary grouping axis rather than one column among many in a dense table.

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
- **FR-002**: The system MUST let a user select a platform not present in the catalog and register it as a "custom" platform, generating a deterministic, name-based fallback visual identity (same name always produces the same identity) with no manual configuration required. Custom platforms MUST be scoped to the user who created them — invisible to, and never matched against, any other user's operations or picker results, even for an identical name.
- **FR-003**: The system MUST support full keyboard operation of the platform picker: arrow keys to move the highlight (including through the custom-platform option), Enter to select, Escape to close without changing the value.
- **FR-004**: The system MUST persist a selected platform's identity on the operation record (not just its display text), so re-opening an operation for editing shows the same platform pre-selected.
- **FR-005**: The system MUST display each operation's resolved platform name (not a raw, potentially stale free-text string) in the History table. Per implementation-time correction, History renders name-only text — no logo, no custom/catalog visual distinction — that richer treatment is scoped to the Wallet grouped views (FR-006).
- **FR-006**: The system MUST display each platform's logo, category, and (for grouped views) aggregate total value and return in the Wallet view's "By platform" and "Asset + platform" groupings.
- **FR-007**: The system MUST fall back to a generated initials avatar whenever a platform has no logo image or its logo fails to load, and MUST never show a broken-image indicator.
- **FR-008**: The system MUST source exchange platforms from an external, regularly refreshed catalog and MUST NOT expose that external source's raw image URLs directly to end-user browsers (logos are served/cached through the system's own backend).
- **FR-009**: The system MUST source wallet and DeFi platforms (not obtainable from the exchange catalog) from a maintained, in-product list shipped with the application.
- **FR-010**: The system MUST migrate all pre-existing operations' free-text platform values so each resolves to either a matching catalog platform or a custom platform, without any operation losing its platform information or ending up blank as a result of the migration.
- **FR-011**: The system MUST distinguish coin/asset logos from platform logos through a consistent, distinct visual shape, so a user can tell at a glance which kind of logo they are looking at anywhere in the product.
- **FR-012**: The platform picker MUST remain usable (accepting a typed custom value) even when the external exchange catalog source is unreachable.
- **FR-013**: Every platform-picker input and every interactive result row MUST be operable and identifiable via assistive technology (proper combobox/listbox/option roles and labels), consistent with the product's existing accessibility requirements.
- **FR-014**: The system MUST successfully import a data backup created before this feature existed (containing the old free-text platform label rather than a platform identity), resolving each legacy value the same way as the one-time historical-operations migration (catalog match, else private custom platform), so previously-working backups continue to import without error or data loss.

### Key Entities

- **Platform**: A named entity a user can attribute an operation to. Has an identity (stable identifier), a display name, a category (`exchange`, `wallet`, `defi`, or `custom`), and an optional logo. Catalog platforms (exchange/wallet/defi) are shared across all users; custom platforms are effectively user-typed labels with a generated fallback identity, scoped privately to the user who created them.
- **Operation (existing entity, extended)**: A buy/sell/trade record. Gains a reference to the Platform it was executed on, replacing today's loose free-text label, while remaining fully readable even for platforms typed before this feature existed.
- **Platform Catalog**: The searchable, categorized collection of known platforms (exchange + wallet + DeFi) presented to the user during selection, refreshed periodically from its external and in-product sources.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can find and select a well-known exchange, wallet, or DeFi platform from the picker in 3 keystrokes or fewer for common platforms (e.g., typing "bin" surfaces Binance).
- **SC-002**: 100% of operations — both newly created and pre-existing/migrated — render a recognizable platform identity (logo or initials avatar in the Wallet views; resolved name in History) in every view that shows platform, with zero blank or broken-image states.
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
- **Post-ship follow-up, out of this feature's original scope but landed on the same branch**: once the new platform picker's icon+dropdown treatment was visible next to the pre-existing, text-only coin/asset search field in the same drawer, the visual inconsistency between the two was flagged directly by the user and fixed — the coin search field now shows each result's real logo (circle) in its dropdown and inline in the input, matching the platform picker's already-established pattern (research.md §6). This was a visual-only change (no keyboard-navigation work), scoped narrowly because it was a direct, motivated consequence of this feature's own UI landing inconsistently next to existing UI, not an unrelated initiative.
- **Second post-ship follow-up, explicitly requested by the user and folded into this same branch/PR rather than a new plan item**: the Trade form's single top-level "Plataforma" field was ambiguous once a trade's origin and destination platforms could genuinely differ (a swap moving value from one platform to another), and forced picking the traded asset before its holding platform even though the asset list should be filtered by platform. The Trade block was restructured so each side owns its own platform field — "Plataforma de origem" inside the "Você vende" block, "Plataforma de destino" (optional, defaults to the origin platform when left empty) inside "Você recebe" — with the origin's asset field disabled until a platform is chosen and then filtered to that platform's held assets (via `computePositionsByAssetAndPlatform`, already used by the Wallet view's "Por plataforma" grouping), a balance line with a "Máx" quick-fill button, and a cross-platform-transfer warning when the destination differs from the origin. No schema or shared-type change was needed: `Op`/`NewOp` already carry `platformId`/`platformName` per operation, and a Trade already produces two `Op` rows (one `Sell`, one `Buy`) — the sell row now records the origin platform and the buy row records the destination (or the origin, if no destination was chosen), which was the data-model decision made when this addition was scoped (single op per leg, no new "Transfer" op type). Buy/Sell mode's own single "Plataforma" field is untouched. Web-only, no mobile or backend change. **Further refinement, same branch**: the pre-existing "source and destination assets cannot be the same" validation was scoped too broadly — it also blocked the legitimate case of moving the *same* asset from one platform to another (a transfer, e.g. moving ETH from Kraken to a MetaMask wallet), which a Trade with a differing destination platform is meant to support. The check now only blocks a same-asset Trade when the effective destination platform (the chosen one, or the origin if none was chosen) equals the origin platform — i.e. it still blocks a genuinely no-op "trade an asset for itself" but allows it as a same-asset transfer once the platforms differ.
- **Third post-ship follow-up, from a live bug report after this branch first shipped to dev**: "Plataforma de origem" still showed the *entire* catalog regardless of what the user actually held anywhere — you could pick a platform with zero holdings and only then discover, via the asset field's empty state, that there was nothing to sell there. Restricted the origin picker itself to platforms with a current balance (`PlatformSelect` gained an `options` prop; `OpDrawer` derives the held-platform list from `platformAssets` and passes it in) — the destination field and the plain Buy/Sell "Plataforma" field are deliberately left unrestricted, since you can deposit or receive onto a platform you don't hold anything on yet. This also caught and fixed a latent bug in `PlatformSelect` itself: its category grouping never included `kind: 'custom'` (only `exchange`/`wallet`/`defi`), which had no visible effect against the always-present full catalog but would have silently dropped a held custom platform from the new restricted list.
- **Fourth post-ship correction, found via dev QA before this branch's first deploy to prod**: the historical-ops backfill (`platform_id`/`platform_name` from the legacy `platform` column) was originally a manually-run, approval-gated script — but the new UI never falls back to the legacy column, so every pre-catalog op would silently lose its displayed platform on deploy until someone remembered to run the script. Changed to run automatically, once, as a `.py`-based migration (`db/migrations/011_backfill_platform_fields.py`) — see PLAN.md Item 22's "Corrections learned during implementation" for the full detail, including a related CSP fix (platform logos were blocked by CloudFront's `img-src` not allowing the backend's own origin) and a transient prod incident on first deploy (concurrent cold-start containers timing out waiting on the migration's advisory lock — self-resolving, not a data bug).

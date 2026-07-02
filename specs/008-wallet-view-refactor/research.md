# Research: Wallet View Redesign

## R1 — Where the last-updated / refresh state comes from

**Decision**: Reuse the existing `statusMsg` string produced by `AppLayout`'s `fetchPrices()` (`web/src/components/AppLayout.tsx`) as `ContentHeader`'s right-side text, passed through `WalletRoute` exactly as today. No new state is introduced.

**Rationale**: `statusMsg` already encodes success ("Atualizado às HH:MM"), the no-ops case, the fetching-in-progress case, and error cases (generic + rate-limited) via i18n templates in `AppLayout.fetchPrices`. Splitting it into a structured `{ timestamp, error }` shape would touch `AppLayout` (out of scope for a view-only restyle) for no behavioral gain — FR-008's requirement ("no stale success indicator on failure") is already satisfied because `setStatusMsg` overwrites the previous message on every fetch attempt, success or failure.

**Alternatives considered**: Introducing a typed `{ lastUpdatedAt, error }` pair in `AppLayout` — rejected as scope creep (Principle IV) since the existing string already meets every FR in this spec.

## R2 — New CSS tokens vs reusing existing ones

**Decision**: Add the prototype's content-view primitives (`.chead`, `.metrics`, `.mcard`, `.tbl`, `.asset`, `.coin`, `.pill.up`, `.pill.down`, generic `.btn`) as new rules in `globals.css`, mapped to the existing theme-aware `--s-*` tokens (same set Item 6 mapped the sidebar onto). Do not rename or remove the old `.metric`/`.pill-pos`/`.pill-neg`/`.coin-cell` rules — `HistoryTab` and `ProfitTab` still use them until Items 8/9 restyle those views.

**Rationale**: Matches PLAN Item 7's file list exactly ("add shared view primitives ... Consolidate with any existing rule definitions"). Renaming shared classes now would force out-of-scope edits to `HistoryTab.tsx`/`ProfitTab.tsx`, violating the one-thing-per-PR rule. The old rules become dead only once every view migrates (tracked implicitly — Items 8/9 will finish the migration and can remove the old rules then).

**Alternatives considered**: Migrating `HistoryTab`/`ProfitTab` onto the new tokens in this PR too — rejected, out of this item's scope per PLAN.md.

**Implementation update**: During implementation, `.metrics`/`.metric`/`.metric-label`/`.metric-value` turned out to already be shared by `ProfitTab.tsx`, not private to `WalletTab.tsx` as assumed above — introducing a parallel `.mcard` class set would have left two visually inconsistent card systems side by side. Per PLAN Item 7's own instruction to "consolidate with any existing rule definitions," the existing `.metric` rules were restyled onto the `--s-*` surface tokens (matching the prototype's `.mcard` look) instead of adding new `.mcard`/`.ml`/`.mv` classes; `MetricCard` renders `.metric`/`.metric-label`/`.metric-value` internally. `ProfitTab` picks up the nicer surface styling for free with no JSX changes. `.chead`/`.refresh`/`.tbl`/`.asset`/`.coin`/`.pill.up`/`.pill.down`/`.btn` were genuinely new (no prior usage) and were added as planned.

## R3 — MetricCard color contract

**Decision**: `MetricCard` accepts `valueColor?: 'pos' | 'neg'` and `subColor?: 'pos' | 'neg'`, reusing the app's existing `.pos`/`.neg` utility classes (already defined in `globals.css`, already used for red/green throughout the app) rather than introducing prototype-named `.red`/`.green` classes.

**Rationale**: `.pos`/`.neg` already exist and are the canonical color contract in this codebase (theme-aware `--success`/`--danger`); introducing a parallel `.red`/`.green` pair would duplicate the same semantics under a different name — the codebase already made this choice consistently.

**Alternatives considered**: Prototype's literal `.red`/`.green` class names — rejected as needless duplication of `.pos`/`.neg`.

## R4 — Coin image / avatar fallback

**Decision**: Reuse the exact existing `AvatarImg` sub-component pattern from the current `WalletTab.tsx` (renders `<img>` when `avatarCache[coinId].url` exists, else the first 3 characters of the symbol as initials), just re-skinned onto the new `.coin` class instead of `.avatar`.

**Rationale**: This is already exactly what FR-006 asks for (image with initials fallback); no new logic needed, only a class rename plus moving it under the new `.asset` cell wrapper (was `.coin-cell`).

**Alternatives considered**: Extracting a standalone `AssetCell` component — not requested by PLAN Item 7 (only `MetricCard`/`ContentHeader` are named), so deferred per Principle IV until a second consumer actually needs it (Items 8/9 don't show per-asset rows the same way).

## R5 — Neutral placeholder computation

**Decision**: Keep the existing `inv && atual` truthiness check (from the current `WalletTab.tsx` metrics block) to decide between showing computed values and the em-dash placeholder — this is already exactly the behavior FR-004 describes (placeholder only when the whole wallet's current value totals to zero, i.e., no asset has a known price yet).

**Rationale**: Verified against the current implementation: `totalAtual` sums `qty * (prices[coinId] || 0)` across all assets, so it is exactly `0` only when no asset in the wallet has a cached price. Preserves current behavior exactly (Success Criterion SC-004: zero regressions).

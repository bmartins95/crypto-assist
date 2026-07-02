# Research: History View Redesign with Entry Drawer

## R1 — Drawer as a new component vs. inline state in HistoryTab

**Decision**: Extract a new `web/src/components/OpDrawer.tsx` component, exactly as named in PLAN.md's Item 9 file list, owning its own `opType: 'buy' | 'sell' | 'trade'` state and the two fieldsets, rather than keeping the drawer markup inline in `HistoryTab.tsx`.

**Rationale**: `HistoryTab.tsx` currently mixes table rendering, Buy/Sell form state, and Trade form state in one 300-line component. The drawer adds focus-trap, body-scroll-lock, and Escape/backdrop handling — orthogonal concerns from the table. Splitting them keeps `HistoryTab.tsx` to table + header + drawer-open state (one responsibility per module, Constitution IV) and makes the drawer's accessibility behavior unit-testable in isolation (`OpDrawer.test.tsx`, as PLAN.md specifies).

**Alternatives considered**: Keep everything in `HistoryTab.tsx` — rejected; would grow the file further and make focus-trap/scroll-lock logic untestable without exercising the whole table.

## R2 — Reusing existing CSS primitives vs. introducing new ones

**Decision**: Reuse `.chead`/`.ct`/`.cs` (content header), `.tbl.scroll` (table), `.icon-btn` (row actions), `.empty-state`, and the existing `.seg-ctrl`/`.seg-btn` segmented-control pair (already used by Wallet's grouping toggle and Profit's chart-mode toggle) for the drawer's Buy/Sell/Trade type selector — rather than adding a new `.seg`/`.seg-tipo` class as the design mockup HTML names it. Add only the classes that have no existing equivalent: `.btn-accent`, `.drawer`, `.drawer-backdrop`, `.drawer-head`, `.drawer-body`, `.drawer-foot`, `.drawer-grid`, `.trade-block`, `.trade-block.out`, `.trade-block.in`, `.trade-arrow`, `.fhint`, `.tag`.

**Rationale**: Per prior-item convention (recorded after item 8's QA pass), `.metrics`/`.metric`, `.chart-switcher`/`.chart-btn`, `.tbl`, `.chead` etc. are already shared design-system classes; `.seg-ctrl`/`.seg-btn` is the established segmented-control pattern (confirmed present in `globals.css` and used by `WalletTab.tsx`/`ProfitTab.tsx`). Introducing a second, differently-named segmented-control class for the same visual pattern would violate Constitution IV (no speculative/duplicate abstractions) even though the design mockup's raw HTML uses its own ad hoc names.

**Alternatives considered**: Copy the mockup's exact class names (`.seg`, `.seg-tipo`) verbatim — rejected; would create two parallel segmented-control implementations in the same codebase for identical behavior.

## R3 — Total field: read-only auto-calculated vs. current unit/total toggle

**Decision**: In the drawer's Buy/Sell fieldset, Total is a read-only field computed as `qty * unitPrice (+/- fee depending on type)`, replacing the current `priceMode` toggle (`unit` vs `total` entry) from `HistoryTab.tsx`.

**Rationale**: `docs/design/dashboard-refactor-notes.md` §6.1 explicitly specifies "Total (BRL) — readonly, auto-calculated, with hint" for the redesigned drawer; this is the project's own authoritative design source (cited in PLAN.md Item 9's design reference) and is more current than the toggle behavior it replaces. This is the one intentional behavior change in this otherwise UI-only redesign.

**Alternatives considered**: Preserve the exact toggle behavior — rejected; contradicts the explicit, already-approved design spec for this exact feature.

## R4 — Trade fieldset field shape

**Decision**: The Trade fieldset keeps the same underlying fields the current always-visible trade form captures (`trFromCoinId`/`trFromQty`, `trToCoin`/`trToQty`, `trTotal`, `trFee`, shared `trDate`/platform) and the same op-construction logic in `handleAddTrade`, re-skinned as two visually distinct blocks ("You sell" / "You receive") per the design mockup, rather than changing the underlying trade computation.

**Rationale**: PLAN.md's done-criteria for Item 9 requires "Submitting a Trade creates two ops (one sell, one buy)" with no change to the calculation semantics; the spec's assumptions section confirms this is a UI restructuring, not a feature/logic change. Reusing the existing `syncTradeTotal`/`handleAddTrade` logic verbatim (moved into `OpDrawer.tsx`) avoids re-deriving already-correct, already-tested math.

**Alternatives considered**: Redesign the trade total-sync logic — rejected; out of scope for a UI item, and risks regressing behavior that already works.

## R5 — Focus trap and body-scroll lock implementation

**Decision**: Implement focus trap and body-scroll lock directly in `OpDrawer.tsx` with plain DOM APIs (`element.focus()`, a `keydown` listener scoped to the drawer root that intercepts Tab/Shift+Tab among `querySelectorAll('input, select, button, textarea, [tabindex]')`, and `document.body.style.overflow = 'hidden'`/`''` toggled in a `useEffect`) — no new npm dependency.

**Rationale**: Constitution IV requires checking whether functionality can be written in under 20 lines before adding a package; a focus trap over a bounded, known set of form elements is well within that budget and is a common, already-vetted pattern. No existing dependency in `web/package.json` provides this (verified: no `focus-trap-react`, `react-focus-lock`, or similar in `package.json`).

**Alternatives considered**: Add `focus-trap-react` — rejected; a single-consumer dependency for ~15 lines of vanilla DOM logic, prohibited by Constitution IV.

## R6 — i18n keys

**Decision**: Reuse existing keys verbatim — `history_form_addOp` ("Registrar operação") and `history_form_editOp` ("Editar operação") for the drawer title in add/edit mode and for the header's primary button; `history_opType_buy`/`history_opType_sell`/`history_form_trade` for the type-selector labels; `trade_form_from`/`trade_form_to` ("De (vender)" / "Para (comprar)") for the Trade block headers; `history_form_cancel` for the Cancel button. Add exactly one new key, `history_subtitle`, for the `ContentHeader` subtitle, following the same pattern as `profit_subtitle` added in item 8.

**Rationale**: Checked `shared/src/i18n/locales/pt-BR.ts` — the existing translations already read naturally as drawer copy (e.g. `history_form_addOp: 'Registrar operação'` matches the design mockup's button text exactly). No other view in this codebase's history has needed a subtitle key of its own; `nav_history` supplies the title, but `ContentHeader` requires both `title` and `subtitle` props (see `WalletTab`/`ProfitTab` usage), so a new key is unavoidable for the subtitle only.

**Alternatives considered**: Reuse `nav_history` for both title and subtitle — rejected; every other `ContentHeader` usage in this codebase (Wallet, Profit) has a distinct subtitle string describing the view's content, and duplicating the title would be visually redundant.

## R7 — OpDrawer prop shape vs. PLAN.md's illustrative prop list

**Decision**: `OpDrawer.tsx` takes `open`, `onClose`, `onSubmit`, `editingOp?`, `assets: Asset[]` (for the Trade "sell" side's owned-asset dropdown, mirroring `HistoryTab.tsx`'s current `trFromCoinId` `<select>`), and `apiKey?: string` (forwarded to the relocated `CoinSearch` sub-component) — not the `coins: CoinSearchResult[]` prop PLAN.md's Item 9 file list sketches.

**Rationale**: `CoinSearch` (defined inline in `HistoryTab.tsx`) already self-fetches search results via `searchCoins(query, apiKey)` on each keystroke; it has never taken a pre-fetched coins array as a prop. PLAN.md's file lists are written before implementation and are illustrative, not authoritative — the same pattern was already observed and documented for item 8 (its "Current state" prose undersold what `ProfitTab.tsx` actually had and named the wrong charting library). Matching the real `CoinSearch` contract avoids inventing an unused prop or a redundant second search mechanism.

**Alternatives considered**: Refactor `CoinSearch` to take a pre-fetched `coins` prop — rejected; out of scope for a UI-relocation item and would change already-working search behavior with no spec requirement driving it.

## R8 — Validation-error copy (i18n, not `alert()`)

**Decision**: Add two new i18n keys — `history_form_validationRequired` (generic required-fields message, used by both Buy/Sell and Trade) and `trade_form_sameAsset` (source/destination-asset conflict) — and render them as visible inline text in the drawer, rather than carrying forward the current `handleAddTrade`'s hardcoded Portuguese `alert()` calls.

**Rationale**: Found during `/speckit-analyze` (finding C1): FR-008 requires a visible message when submission is blocked, but no task originally allocated i18n keys for this new copy, and the logic being relocated today uses hardcoded Portuguese strings passed to `alert()`. Constitution V is a MUST — "All UI strings MUST go through the i18n layer... hardcoded Portuguese strings in JSX or TSX are a violation" — so shipping either the old `alert()` text or new hardcoded JSX text would violate it. Inline text also composes better with the focus-trap/dialog semantics (FR-013/FR-015) than a native `alert()`, which briefly steals focus outside the drawer's DOM subtree.

**Alternatives considered**: Keep `alert()` with its existing hardcoded strings — rejected; confirmed Constitution V violation, and flagged as CRITICAL during analysis rather than deferred.

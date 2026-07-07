# Research: Auto-Refresh Prices

## Decision: Web context location and shape

**Decision**: Create `web/src/context/PriceRefreshContext.tsx` (singular `context/`, matching `BalanceContext.tsx` and `CurrencyContext.tsx` in the same directory), not `web/src/contexts/` as the plan item text guessed.

**Rationale**: The codebase already establishes `web/src/context/` as the home for device-preference contexts. `BalanceContext.tsx` is the minimal-shape reference: `createContext<T|null>(null)`, `useState(() => localStorage.getItem(KEY))` initializer, a setter that writes localStorage then calls `setState`, and a `use*()` hook that throws if called outside its provider. `PriceRefreshContext` follows this exact shape — no need for `CurrencyContext`'s extra async-fetch-on-mount complexity since there's no network call involved, just a stored preference.

**Alternatives considered**: Mirroring `CurrencyContext`'s heavier shape (effect-driven fetch + status field) — rejected, there's nothing to fetch; the interval is a pure local preference.

## Decision: Where the web interval effect lives

**Decision**: The `setInterval`/`clearInterval` effect lives inside `AppLayout` (`web/src/components/AppLayout.tsx`), which already owns `fetchPrices` (a `useCallback`, lines ~153-180) and is mounted once for the whole authenticated shell (persists across `/wallet`, `/profit`, `/history` navigation via `<Outlet/>`).

**Rationale**: `fetchPrices` and the `assets` it depends on already live here; this is the "top of the component tree" location the plan item describes. Placing the interval effect anywhere lower (e.g. inside `WalletTab`) would mean losing the interval on route change and duplicating it per-view.

**Alternatives considered**: Per-view effect in `WalletTab`/`ProfitTab` — rejected, would restart/lose the timer on every navigation and duplicate wiring in two places.

## Decision: Web selector control pattern

**Decision**: Reuse the existing `settings-select` CSS-styled `<select>` pattern already used for the currency selector in the same "Moeda e preços" card (`web/src/pages/settings.tsx`), rather than inventing a segmented control or custom dropdown.

**Rationale**: Prior project feedback (custom-styled selects: `appearance:none`, custom chevron, teal focus ring — not raw browser chrome) is already satisfied by the existing `.settings-select` class. The disabled placeholder markup (lines 146-154) already uses this exact class; only the `disabled` attribute and static "Manual" option need to become a live, stateful select bound to `PriceRefreshContext`. Segmented controls are reserved for genuinely binary/ternary visual toggles (Theme); reusing `<select>` keeps the card visually consistent (currency select directly above it looks the same).

**Alternatives considered**: Segmented control (4 options would be visually cramped compared to Theme's 3); fully custom dropdown component — rejected as unnecessary abstraction for a single call site (constitution Principle IV, No Speculative Code).

## Decision: Mobile context location and shape

**Decision**: Create `mobile/src/context/PriceRefreshContext.tsx` (matching `mobile/src/context/BalanceContext.tsx` / `CurrencyContext.tsx`), using `expo-secure-store` (`SecureStore.getItemAsync`/`setItemAsync`) exactly like the existing mobile contexts — not raw `AsyncStorage` as the plan item text assumed, since the established mobile convention for this class of preference has already migrated to `expo-secure-store`.

**Rationale**: Consistency with `BalanceContext`/`CurrencyContext`, which both already use `expo-secure-store` for device-scoped preferences (reads happen in an `useEffect` on mount since the API is async, unlike web's synchronous `localStorage` initializer).

**Alternatives considered**: `AsyncStorage` directly, per the original plan item wording — rejected in favor of matching the already-established mobile pattern; introducing a second storage mechanism for the same class of preference would be inconsistent for no benefit.

## Decision: Where the mobile interval effect lives

**Decision**: Since mobile has **no shared root portfolio context** (each screen — `mobile/app/(tabs)/wallet.tsx`, `profit.tsx` — fetches its own prices independently via its own `load` callback), the interval effect is added **inside each price-displaying screen**, each screen reading `interval` from `usePriceRefresh()` and scheduling its own `setInterval(() => load(), interval)`, cleared on unmount or interval change.

**Rationale**: The plan item's wording ("navigator root sets up the refresh effect") assumed a shared portfolio context that doesn't exist on mobile today; introducing one would be a speculative refactor well beyond this plan item's scope (constitution Principle IV). Per-screen effects are the smallest change consistent with mobile's existing per-screen-fetch architecture, and still satisfy FR-003/FR-005 (each screen independently starts/stops/reschedules its own timer whenever the shared `interval` value changes).

**Alternatives considered**: Introducing a shared mobile portfolio context so a single effect could live at the root — rejected as out of scope; would touch unrelated screens beyond what auto-refresh requires.

## Decision: Mobile selector control pattern

**Decision**: Reuse the existing row/list pattern from `mobile/app/settings.tsx` (`TouchableOpacity` + `accessibilityRole="radio"` + checkmark for the selected option), exactly as already used for the currency and locale rows, replacing the disabled placeholder row (lines ~132-135) with a tappable row that opens the same list-of-options presentation.

**Rationale**: Matches sibling rows in the same "Preferências" group; no new component needed for a single call site.

**Alternatives considered**: Action sheet / native picker — rejected, inconsistent with how the adjacent currency/locale rows already present their options inline.

## Decision: Interval storage representation

**Decision**: Store the interval as a plain number of milliseconds (`30000 | 60000 | 300000`) or the string `null`/absent for Manual, under the key `price_refresh_interval`, on both platforms.

**Rationale**: Matches the plan item's literal storage key name; a raw number avoids a translation layer between stored value and `setInterval`'s argument.

## Decision: Error handling during auto-refresh

**Decision**: No new error handling is introduced. The interval effect calls the exact same `fetchPrices`/`load` function already used by manual refresh, which already updates visible status/error state on failure (constitution Principle II — every `await` in an event-adjacent flow must update visible UI state). The timer itself is not stopped by a failed fetch; it fires again on the next tick.

**Rationale**: Reuses existing, already-tested error-surfacing behavior; introducing a separate error path for automatic vs. manual fetches would be speculative divergence.

## Testing approach

**Decision**: Use `vi.useFakeTimers()` (Vitest) for the web `PriceRefreshContext` test and the `AppLayout` interval-effect test — advancing fake timers to assert `fetchPrices`/the mocked API call fires at the expected cadence, and that changing/clearing the interval reschedules/stops it. This is a new pattern for this repo's context tests (existing `BalanceContext.test.tsx`/`CurrencyContext.test.tsx` don't use fake timers, since they have no interval), introduced here because this is the first interval-driven context.

**Rationale**: Fake timers are the standard, deterministic way to test `setInterval`-based effects without real waiting; consistent with Vitest (already the project's test runner).

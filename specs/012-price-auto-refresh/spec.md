# Feature Specification: Auto-Refresh Prices

**Feature Branch**: `feat/price-auto-refresh`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Plan item 11 — Auto-refresh prices. Users can configure how often prices refresh automatically (Manual [default], 30s, 1min, 5min). Interval stored per-device (localStorage on web, AsyncStorage on mobile) and survives reload. Selected interval shown in Settings 'Moeda e preços' card, replacing the placeholder left in Item 5."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enable automatic price refresh (Priority: P1)

A user viewing their portfolio wants prices to update on their own instead of manually tapping refresh every time they check the app. They open Settings, choose a refresh interval, and from then on prices update automatically while they use the app.

**Why this priority**: This is the entire point of the feature — without it, there is nothing to test or ship.

**Independent Test**: Set the interval to "Every 30 seconds" in Settings, stay on the Wallet view, and confirm prices are re-fetched roughly every 30 seconds without any user interaction.

**Acceptance Scenarios**:

1. **Given** the user is on the Settings page, **When** they select "A cada 30s" in the "Moeda e preços" card, **Then** prices begin refreshing automatically every 30 seconds without further action.
2. **Given** auto-refresh is set to 1 minute, **When** 60 seconds elapse while the app is open, **Then** the prices displayed reflect a new fetch (e.g. last-updated timestamp advances).
3. **Given** auto-refresh is set to 5 minutes, **When** the interval elapses, **Then** prices refresh the same way as the 30s/1min options, just less frequently.

---

### User Story 2 - Turn off automatic refresh (Priority: P2)

A user who prefers full manual control (e.g. to limit network/API usage) wants to disable auto-refresh entirely and go back to pressing the refresh button themselves.

**Why this priority**: Manual is the documented default and must remain a first-class, always-available choice; users must be able to turn auto-refresh off after having turned it on.

**Independent Test**: With an active interval selected, switch back to "Manual" in Settings and confirm no further automatic fetches occur, while the manual refresh button still works.

**Acceptance Scenarios**:

1. **Given** auto-refresh is currently set to any interval, **When** the user selects "Manual" in Settings, **Then** automatic fetching stops immediately.
2. **Given** auto-refresh is set to "Manual", **When** the user presses the existing manual refresh control, **Then** prices still refresh on demand as they do today.

---

### User Story 3 - Preference persists across sessions (Priority: P3)

A user who picked "A cada 1min" yesterday expects the app to remember that choice the next time they open it, without having to reconfigure it.

**Why this priority**: Persistence is required by the plan item but is a smaller increment once the interval mechanism itself (User Story 1/2) exists.

**Independent Test**: Set an interval, reload the web page (or restart the mobile app), and confirm the same interval is shown as selected in Settings and auto-refresh resumes at that cadence without the user reselecting it.

**Acceptance Scenarios**:

1. **Given** the user selected "A cada 30s" and reloads the web page, **When** the app finishes loading, **Then** Settings shows "A cada 30s" as selected and prices resume auto-refreshing every 30 seconds.
2. **Given** the user selected "A cada 5min" on mobile and force-closes/reopens the app, **When** the app finishes loading, **Then** the Settings screen shows "A cada 5min" as selected and auto-refresh resumes at that cadence.
3. **Given** a user who has never changed the setting, **When** they open the app for the first time, **Then** the interval defaults to "Manual".

---

### Edge Cases

- What happens when the user changes the interval while a fetch triggered by the previous interval is still in flight? The in-flight fetch completes; the timer is rescheduled at the new interval going forward (no overlapping duplicate timers).
- What happens if the price fetch fails (network error, upstream rate limit) while auto-refresh is active? The existing manual-refresh error handling (visible status/error message) applies; the timer keeps running and retries on the next tick rather than stopping permanently.
- What happens when the user navigates away from any price-displaying view (e.g. to Settings itself) while auto-refresh is active? Refreshing continues in the background at the configured interval so prices are current when the user returns.
- What happens on mobile when the app is backgrounded? Auto-refresh does not need to keep firing while the app has no active screen; it resumes on the configured cadence once the app is foregrounded again (no missed-tick catch-up fetch is required).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to choose a price auto-refresh interval from exactly four options: Manual, 30 seconds, 1 minute, 5 minutes.
- **FR-002**: The default interval for a user who has never set a preference MUST be Manual (no automatic refreshing).
- **FR-003**: When a non-Manual interval is selected, the system MUST automatically re-fetch prices at that cadence for as long as the interval remains selected, with no further user action required.
- **FR-004**: When Manual is selected, the system MUST NOT perform any automatic price refresh; the existing manual refresh action MUST continue to work unchanged.
- **FR-005**: Changing the interval selection MUST take effect immediately — switching intervals reschedules automatic refreshing at the new cadence without requiring a reload/restart, and switching to Manual stops it immediately.
- **FR-006**: The chosen interval MUST persist per device and be restored automatically the next time the app is opened (page reload on web, app restart on mobile), without the user reselecting it.
- **FR-007**: The Settings screen (web and mobile) MUST display the currently active interval selection in the "Moeda e preços" / price-settings card, replacing the previously disabled placeholder control.
- **FR-008**: The interval selector MUST be presented using the same custom-styled control pattern already used by the adjacent currency selector in the same Settings card (web) and the same row/list pattern used by the adjacent currency row (mobile) — not a raw, unstyled browser control.
- **FR-009**: A price fetch failure while auto-refresh is active MUST surface through the same visible error/status handling already used for manual refresh, and MUST NOT silently stop future automatic attempts.

### Key Entities

- **Price refresh preference**: A per-device setting representing the user's chosen auto-refresh cadence (Manual, 30s, 1min, or 5min). Not tied to a user account or synced across devices — each device remembers its own choice.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user who selects "A cada 30s" sees updated prices at least once within any 30-second window of active app use, with zero additional taps.
- **SC-002**: A user who selects "Manual" sees zero automatic price fetches; prices change only when the user explicitly triggers a refresh.
- **SC-003**: 100% of returning sessions (reload/restart) restore the previously selected interval without the user needing to reconfigure it.
- **SC-004**: Switching between any of the four interval options takes effect within one second, with no leftover automatic refreshing at a stale cadence.

## Assumptions

- "Automatic refreshing" means re-fetching current prices for the coins already in the user's portfolio using the existing prices endpoint/flow — no new backend endpoint is required for this feature.
- The preference is per-device (localStorage on web, AsyncStorage on mobile), consistent with how theme and hide-balances preferences are already stored (Item 5); it is not synced across a user's devices or stored server-side.
- While the app is backgrounded on mobile, missed refresh ticks are not queued or caught up — auto-refresh simply resumes on its configured cadence once the app is foregrounded again.
- The feature applies to whichever views currently display live prices (Wallet and Profit); it does not introduce refreshing on views that don't show prices.

# Phase 0 Research: Historical Charts + Timeframe Selector

No `NEEDS CLARIFICATION` markers remained in the Technical Context — the existing codebase
(`backend/app/routes/prices.py`, `exchange_rates.py`, `shared/src/portfolio.ts`) and
`PLAN.md`'s Item 12 write-up already fixed every open technical question. This document records
the decisions and the alternatives considered.

## Decision: `computeTimeline` walks calendar days, not just operation dates

**Rationale**: The current implementation emits one point per *operation* date and prices it
with **today's** price map. To fix the correctness bug (Item 12's core goal) the function must
price each historical point with the price in effect *on that date*. Once historical prices are
available per-day anyway, emitting one point per calendar day (not just per-op-date) is what lets
the timeframe selector zoom into "1D"/"1W" windows that may contain zero operations — the chart
still needs to show the (flat or drifting) value of existing holdings across days with no
activity.

**Alternatives considered**:
- Keep one point per operation date, only fix the pricing. Rejected: a "1D" or "1W" window on a
  portfolio with sparse operations would then often render 0–1 points, failing FR-009's "<2
  points → empty state" rule far more often than the design intends, and the line chart would
  look identical to today's (wrong) shape for any window without new operations in it.
- Emit points at a coarser granularity for long windows (e.g. weekly for "All"). Rejected: Scope
  (a few years, a handful of coins) is small enough that daily granularity is cheap, and PLAN.md
  explicitly says "for each day in range."

## Decision: nearest-earlier-date fallback capped at 7 days, then zero

**Rationale**: CoinGecko's daily granularity can have gaps (new listings, provider hiccups). A
7-day look-back (matching `PLAN.md`'s explicit instruction) absorbs short gaps without
misrepresenting a long-dead price as current. Beyond that, treating the value as zero is safer
than silently omitting the asset (which would understate `invested` too) or throwing (which would
break the whole chart for one bad coin).

**Alternatives considered**: Look forward as well as backward. Rejected — looking forward would
use a price from *after* the point in time being charted, which is not "historical" and could
leak future information into a past point.

## Decision: reuse CoinGecko `market_chart` via a new `price_history` table, no new provider

**Rationale**: `PLAN.md` Item 13 (price provider abstraction) is a separate, later, item; adding
an abstraction here would be speculative (Constitution Principle IV). The existing
`_fetch_from_coingecko` pattern in `prices.py` (demo API key query param, 429 → `HTTPException`)
is mirrored for `market_chart`.

**Alternatives considered**: Wait for Item 13's provider abstraction first. Rejected — Item 12
does not depend on Item 13 per `PLAN.md`'s own dependency list (Item 12 depends only on Item 10).

## Decision: historical price rows have no TTL; only "today"'s row is potentially stale

**Rationale**: A price for 2026-01-01 does not change once 2026-01-02 arrives — caching it
forever is correct and is what makes the `price_history` cache effective. The one exception is
the *current* day's row, which may be fetched before the day's trading has finished; accepting
that staleness is fine here because the live "current price" experience is served by the
already-existing `/api/prices` endpoint (5-minute TTL), not this one.

**Alternatives considered**: Apply the same 5-minute TTL as `price_cache` to every row. Rejected
— it would force a re-fetch of years of immutable historical data on every request, defeating the
purpose of the cache table and multiplying CoinGecko calls for no benefit.

## Decision: `TimeframeSelector` state lives in `ProfitTab`, not a new Context

**Rationale**: `PLAN.md` explicitly scopes the persisted key (`profit_timeframe`) to
`ProfitTab.tsx` itself, and no other component needs the selection. A `useState` initialized from
`localStorage` (matching the read/write pattern already used by `PriceRefreshContext`, just
without the Context wrapper) is enough; introducing a Context for a single consumer would be
speculative (Constitution Principle IV).

**Alternatives considered**: A `TimeframeContext` mirroring `PriceRefreshContext`. Rejected —
no second consumer exists or is planned; `PLAN.md` describes this as component-local state.

## Decision: duplicate the coin-id validation regex rather than extract a shared helper

**Rationale**: `backend/app/routes/prices.py` already has its own `_COIN_ID_RE`; `exit_prices.py`
has no such check at all. The codebase's existing convention is per-route validation, not a
shared validators module. Extracting one now for two call sites is a premature abstraction
(Constitution Principle IV) — three near-identical lines are cheaper than a new module.

**Alternatives considered**: A shared `app/validation.py`. Rejected per the above; revisit only if
a third route needs the same check.

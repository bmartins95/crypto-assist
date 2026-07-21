# Contract delta: `POST /api/ops/{id}/close`

Base contract unchanged from item 26 (`specs/023-position-closing/contracts/close-endpoint.md`) — same
request/response shape, same auth gating. This document covers only what this feature changes.

## New error cases

| Status | Condition |
|--------|-----------|
| 400 | `{id}` resolves to an operation with `op_kind: 'wallet'` — wallet operations no longer have a close action (spec FR-014). |
| 400 | `closingOp.type` does not match the locked side derived from `{id}`'s `side` (`side: 'short'` requires `type: 'Buy'`; `side: 'long'` requires `type: 'Sell'`) — spec FR-015. Distinct from the existing "not a type capable of closing" 400 in the base contract: this one is side-specific, not just "opposite of the source's own type" (which is still necessary but no longer sufficient, since Swap is also no longer an allowed closing type for a trade — see below). |
| 400 | `closingOp` implies a Swap/Trade-mode close (i.e. would create a second, receiving leg sharing `tradeGroupId`) against a trade position — this path is removed for trades; only a plain Buy or Sell may close a trade position. |

## Removed capability

Item 26's "Trade closes (two legs)" section (closing a position by swapping into a different received
asset) no longer applies when `{id}` is `op_kind: 'trade'`. That capability was for wallet-style
position closing, which this feature removes the close action for entirely (wallet ops are never
closable). It is not reintroduced elsewhere — closing a trade is always a plain, single-leg Buy or Sell.

## New endpoint: `PUT /api/ops/{id}` — classification immutability

Not a new endpoint, but a new rejection case on the existing one:

| Status | Condition |
|--------|-----------|
| 400 | Request body's `kind` differs from the stored operation's `op_kind`, or (for a trade) its `side` differs from the stored `side` — spec FR-025. The existing closure-linked-operation 409 (item 26) is checked first; this 400 is checked regardless of closure state, since it's a distinct invariant (a wallet op with no closures at all still cannot be edited into a trade). |

## `GET /api/op-closures` — unchanged

Same shape as item 26. Callers filter to `op_kind: 'trade'` ops client-side before deriving cycles or
status (see `research.md`'s `computeCycles` decision) — no server-side filtering added, since
`HistoryTab` already fetches the full `ops` list and can cross-reference `op_kind` locally.

# Contract: `POST /api/ops/{id}/close`

Auth-gated (`require_auth`), scoped to the authenticated user's own operations. `{id}` is the
`source_op_id` the user clicked "close" on — the endpoint may still allocate across other older open
operations of the same asset/platform/currency if the requested quantity exceeds that one row's own
outstanding amount (spec FR-008).

## Request body

```jsonc
{
  "closingOp": {
    // shape identical to the existing NewOp (shared/src/types.ts), i.e. exactly
    // what POST /api/ops already accepts: date, coinId, symbol, name, type,
    // qty, price, fee, total, platformId, platformName, currency.
    // "type" must be the opposite of {id}'s own type, or "the other" leg of a
    // trade pair submitted as two calls (see "Trade closes" below).
  },
  "qtyToClose": 3128.352
}
```

## Response — 201 Created

```jsonc
{
  "closingOp": { /* Op, as created */ },
  "closures": [
    {
      "id": "...",
      "sourceOpId": "...",
      "closingOpId": "...",
      "qtyClosed": 3128.352,
      "realizedPnl": 3.17
    }
    // more than one entry only when the requested qtyToClose exceeded {id}'s own
    // outstanding amount and the remainder was drawn from other older open ops
  ]
}
```

## Errors

| Status | Condition |
|--------|-----------|
| 400 | `qtyToClose` exceeds the total outstanding quantity available across all eligible open operations (same asset, platform, currency) for the user. |
| 400 | `closingOp.type` is not a type capable of closing `{id}` (e.g. submitting a Buy against an already-open Buy). |
| 404 | `{id}` does not exist, does not belong to the authenticated user, or is already fully closed. |
| 401 | Missing/invalid `Authorization` header (existing `require_auth` behavior). |
| 422 | `closingOp` fails the existing `NewOp` validation (e.g. mismatched `platformId`/`platformName` pair, per the existing `_validate_platform_pair` check). |

## Trade closes (two legs)

When the user closes a position via Trade mode, the UI makes this a single logical action but it
produces one closure-bearing leg and one brand-new open leg. This contract covers only the
closure-bearing leg (the one matching `{id}`'s opposite type); the other leg is created via the
existing plain `POST /api/ops` (no closure attached — it starts open, per spec FR-015 and Edge Cases).

## `GET /api/op-closures`

Auth-gated, scoped to the user. Returns every closure link referencing any of the user's own
operations (as source or as closing leg):

```jsonc
[
  { "id": "...", "sourceOpId": "...", "closingOpId": "...", "qtyClosed": 3128.352, "realizedPnl": 3.17 }
]
```

Used by the frontend to derive status/remaining-qty/realized-P&L for every row via
`shared/src/positions.ts`, alongside the existing `GET /api/ops`.

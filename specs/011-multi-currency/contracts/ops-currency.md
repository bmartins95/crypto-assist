# Contract: ops currency field

## POST /api/ops, PUT /api/ops/{id}

Request body gains an optional field:

```json
{ "...existing NewOp fields...": "...", "currency": "USD" }
```

- Allowed values: `"BRL" | "USD" | "EUR" | "GBP" | "JPY"`. Anything else → 422.
- Omitted → stored as `"BRL"`.
- `price`, `fee`, `total` are denominated in `currency`.

## GET /api/ops

Every returned op includes `currency` (pre-feature rows report `"BRL"`).

## GET /api/export

Each exported op includes `currency`.

## POST /api/import

- Ops with `currency` keep it (validated against the allowed set).
- Legacy backups without `currency` import as `"BRL"`.

## GET /api/prices (changed semantics, same shape)

`price` values are now denominated in **USD** (previously BRL). Response shape is unchanged: `Record<coinId, { price, image? }>`.

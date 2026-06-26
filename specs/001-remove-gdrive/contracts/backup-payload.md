# Contract: JSON Export/Import File Format

## Overview

The export action produces a `.json` file downloaded to the user's computer.
The import action reads that file back. This contract defines the format and
must remain identical before and after the Google Drive removal.

## File

- **Filename pattern**: `carteira-backup-YYYY-MM-DD.json`
- **MIME type**: `application/json`
- **Encoding**: UTF-8

## Schema

```json
{
  "version": 1,
  "exportedAt": "2026-06-26T14:30:00.000Z",
  "ops": [
    {
      "date": "2024-03-15",
      "coinId": "bitcoin",
      "symbol": "BTC",
      "name": "Bitcoin",
      "type": "Compra",
      "qty": 0.5,
      "price": 220000.00,
      "fee": 10.00,
      "total": 110010.00,
      "platform": "Binance"
    }
  ],
  "exitPrices": {
    "bitcoin": 280000.00
  }
}
```

## Field Rules

| Field | Rule |
|-------|------|
| `version` | Must be `1` |
| `exportedAt` | ISO 8601 UTC timestamp |
| `ops` | Non-null array; may be empty |
| `ops[].type` | Must be `"Compra"` or `"Venda"` |
| `ops[].qty`, `price`, `fee`, `total` | Numeric; non-negative |
| `exitPrices` | Optional; map of CoinGecko ID → BRL price |
| `prices`, `pricesTime` | Legacy optional fields; ignored on import |

## Validation on Import

A file is **accepted** if:
1. It parses as valid JSON.
2. `backup.ops` exists and `Array.isArray(backup.ops)` is `true`.

A file is **rejected** with a visible error message if either check fails.
No existing data is modified when a file is rejected.

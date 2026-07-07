# Contract: GET /api/exchange-rates

**Auth**: required (`Authorization: Bearer <token>`); 401 without it.

## Response 200

```json
{
  "rates": {
    "USD": 1.0,
    "BRL": 5.43210000,
    "EUR": 0.92150000,
    "GBP": 0.78440000,
    "JPY": 157.32000000
  },
  "updatedAt": "2026-07-07T12:00:00+00:00"
}
```

- `rates[c]` = units of currency `c` per 1 USD. `USD` is always exactly `1.0`.
- All five currencies are always present in a 200 response.
- `updatedAt` is the freshness timestamp of the served rates (may be > 1 h old when serving stale fallback).

## Behavior

| Condition | Result |
|-----------|--------|
| DB rates fresh (< 1 h) | 200 from cache, no upstream call |
| DB rates stale/missing, upstream OK | fetch CoinGecko, upsert `exchange_rates`, 200 |
| Upstream fails, any cached rates exist | 200 with stale cached rates |
| Upstream fails, no cached rates | 502 with `detail` explaining rates are unavailable |
| Missing/invalid token | 401 |

## Upstream

`GET https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,brl,eur,gbp,jpy[&x_cg_demo_api_key=...]`

Derivation: `rate_vs_usd[c] = bitcoin[c] / bitcoin['usd']`.
A 429 or non-success upstream response follows the stale-fallback rules above.

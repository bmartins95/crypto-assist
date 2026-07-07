# Quickstart: Multi-currency display

## Run locally

```bash
# Postgres (schema + migration 005 apply automatically on first connection)
docker run -d --name crypto-assist-pg -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=crypto_assist -p 5432:5432 postgres:16

cd backend && uvicorn app.main:app --reload --port 3001
cd web && npm run dev
```

## Verify the feature

1. **Rates endpoint**: `GET /api/exchange-rates` (with a Bearer token) → 200 with 5 rates, `USD: 1.0`. Second call within an hour must not hit CoinGecko (watch backend logs).
2. **Currency switch**: Settings → "Moeda e preços" → pick USD. Wallet/Profit/History values re-render in US$ instantly, no reload. Reload the page → still USD.
3. **Conversion math**: for a coin priced P USD with BRL rate R, the BRL display must equal P×R (2 decimals).
4. **JPY**: pick JPY → values render with ¥ and zero decimal places.
5. **Op entry**: with display = USD, register a buy; `GET /api/ops` shows `"currency": "USD"` on the new op; older ops show `"BRL"`. Totals remain consistent when switching display currency.
6. **Failure path**: stop the backend (or block the route) after clearing localStorage key `crypto-assist:exchange-rates` → UI shows the rates-unavailable status message instead of wrong numbers.

## Tests

```bash
cd backend && pytest --cov=app --cov-report=term-missing
cd web && npm test -- --run
```

New/updated: `test_exchange_rates.py`, `test_prices.py`, `test_ops.py`, `test_export.py`-style assertions in existing suites, `portfolio.test.ts` (convertOpsToUsd), `format.test.ts` (JPY), `CurrencyContext.test.tsx`, `settings.test.tsx`, tab component tests.

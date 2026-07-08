# Quickstart: Price Provider Abstraction

## Backend

```bash
cd backend
pytest
```

Manual check (local dev server + browser DevTools per spec User Story 1):

```bash
uvicorn app.main:app --reload --port 3001
```

1. Log into the web app pointed at this local backend.
2. Open the operation entry drawer, type a coin name in the search field.
3. In DevTools → Network, confirm the only request fired is to
   `http://localhost:3001/api/coins/search?q=...` — no request to `api.coingecko.com`.
4. Confirm results still populate the dropdown as before.

## Provider swap (User Story 2)

```bash
PRICE_PROVIDER=cryptocompare uvicorn app.main:app --reload --port 3001
```

Any `/api/coins/search`, `/api/prices`, or `/api/prices/history` request should now 502
with a clear "not implemented" detail — not crash, not silently return CoinGecko data.
Unset `PRICE_PROVIDER` (or set back to `coingecko`) to restore normal behavior.

## Web

```bash
cd web
npm test
npm run dev
```

Exercise the operation entry drawer's coin search and the "select a coin → price
auto-fills" flow manually, per Story 1's independent test.

## Coverage

```bash
cd backend && pytest --cov=app --cov-report=term-missing
cd web && npm run coverage
```

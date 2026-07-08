# Quickstart: Historical Charts + Timeframe Selector

## Backend

```bash
cd backend
cp .env.example .env   # if not already done
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 3001
```

Needs a local Postgres (see `backend/AGENTS.md` for the disposable Docker container recipe).
Schema + migration `006_price_history.sql` apply automatically on first connection.

Verify the new endpoint manually:

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/prices/history?ids=bitcoin&from=2026-01-01&to=2026-01-10"
```

Run backend tests:

```bash
cd backend && pytest --cov=app --cov-report=term-missing
```

## Web

```bash
cd web
npm run dev
```

Open `/profit`, add a few ops spanning different dates in `/history`, switch chart mode to
"Lucro no tempo" or "Valor da carteira", and confirm the `TimeframeSelector` appears in the panel
header and reflows the chart on each option.

Run web tests:

```bash
cd web && npm test
```

## Manual verification checklist (maps to spec Success Criteria)

- [ ] SC-001: pick an asset whose price has moved >10% since purchase; confirm past chart points
      differ from what "today's price applied everywhere" would produce.
- [ ] SC-002: switch all 5 timeframe options; each reflows within ~1s or shows the loading overlay.
- [ ] SC-003: an asset bought 10 days ago never appears before its purchase date on any timeframe.
- [ ] SC-004: reload the page after selecting a non-default timeframe; selection persists.

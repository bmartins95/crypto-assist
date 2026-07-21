# Quickstart: verifying Position Closing locally

1. Start Postgres and the backend (see `backend/AGENTS.md`):

   ```bash
   docker run -d --name crypto-assist-pg -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password \
     -e POSTGRES_DB=crypto_assist -p 5432:5432 postgres:16
   cd backend && cp .env.example .env && pip install -r requirements-dev.txt
   uvicorn app.main:app --reload --port 3001
   ```

   Migration `012_leverage_and_op_closures.sql` applies automatically on first connection.

2. Start the web app: `cd web && npm run dev`.

3. In the app: register a Buy for some asset with no leverage. Confirm its History row shows status
   "Aberta" and a neutral (no) profit/loss figure.

4. Click that row's close action. Confirm the drawer opens pre-filled with the asset, platform, and
   full outstanding quantity, restricted to Sell/Trade tabs (Buy is not offered). Submit a Sell for
   half the quantity.

5. Confirm: the original row now shows "Parcial" with a realized profit/loss figure; the new Sell row
   also shows a profit/loss figure; the close action is still available on the original row.

6. Click close again on the same row, submit a Sell for the remaining quantity. Confirm the row now
   shows "Fechada" and no close action is offered.

7. Register a new Buy with a leverage multiplier (e.g. 3x). Confirm the row shows a "3x" badge next
   to its type chip, and that clicking its close action does not offer a leverage control.

8. Confirm History groups all of the above operations under a single day-section header (assuming
   they were all entered today), and that switching Buy/Sell/Trade tabs in a fresh (non-closing)
   drawer animates rather than snapping instantly.

9. Run the test suites: `cd backend && pytest --cov=app --cov-report=term-missing` and
   `cd web && npm run coverage`.

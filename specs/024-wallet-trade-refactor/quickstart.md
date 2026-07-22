# Quickstart: verifying the wallet/trade refactor locally

1. Start Postgres and the backend (see `backend/AGENTS.md`):

   ```bash
   docker run -d --name crypto-assist-pg -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password \
     -e POSTGRES_DB=crypto_assist -p 5432:5432 postgres:16
   cd backend && uv run dev.py
   ```

   Migrations `014_op_kind_and_side.sql` and `015_backfill_op_kind.py` apply automatically on first
   connection.

2. Start the web app: `cd web && npm run dev`.

3. **Wallet flow (User Story 1)**: Click "Move wallet", register a Buy for an asset with no leverage.
   Confirm its History row shows no status indicator and no close action. Open "Move wallet" → Sell for
   that asset/platform; confirm the panel shows the available balance and average cost, and that "Max"
   fills the quantity with the full balance. Sell half; confirm the History row shows a realized P/L
   figure (colored) and still no status/close action. Attempt to sell more than the remaining balance;
   confirm it is blocked.

4. **Swap flow**: Use "Move wallet" → Swap to convert the remaining balance to a different asset on the
   same platform (leave destination platform blank). Confirm it appears as a single collapsed History row
   ("AssetA→AssetB") rather than two rows, with no status/close action.

5. **Trade flow (User Stories 2-3)**: Click "New trade", select Short for an asset you hold zero balance
   of, pick a leverage multiplier, and submit. Confirm it's created successfully (no balance error), shows
   an Open status, the leverage badge, and a Short label with the trade-row visual marker in History, and
   that your wallet balance for that asset is unchanged. Click its close action; confirm the panel offers
   no type choice (locked to Buy), shows the position context banner, and defaults quantity to the full
   remaining amount. Close half; confirm the row becomes Partial with a realized P/L figure. Close the
   remainder; confirm it becomes Closed and the close action disappears.

6. **Cycle summary (User Story 4)**: With the partially-then-fully-closed trade position from step 5,
   hover (or tap) the entry row's cycle tag; confirm a popover lists the entry, both closes, and the total
   realized P/L. Confirm hovering/tapping either close row's tag opens the identical popover. Confirm no
   cycle tag appears on any wallet row from steps 3-4.

7. **Edit/delete recompute (User Story 5)**: Buy an asset, sell part of it, then attempt to edit the
   original buy's quantity down below what the sell consumed; confirm the change is blocked. Make a
   smaller edit that still leaves a valid balance; confirm a confirmation dialog (not a native browser
   confirm) describes the affected later operation before applying.

8. **Wallet/Profit exclusion**: Confirm the Wallet and Profit views' totals reflect only the wallet
   operations from steps 3-4, not the trade position from step 5 (open a trade with a large notional value
   and confirm it does not change the Wallet view's portfolio value or the Profit view's P/L figures).

9. Run the test suites: `cd backend && pytest --cov=app --cov-report=term-missing` and
   `cd web && npm run coverage`.

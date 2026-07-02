# Quickstart: History View Redesign with Entry Drawer

1. `cd web && npm run dev`, log in, navigate to `/history`.
2. Confirm no form is visible above the operations table — only the content header (title, subtitle, "Registrar operação" button) and the table.
3. Click "Registrar operação":
   - Confirm the drawer slides in from the right, defaults to Buy mode, and focus lands on the first field.
   - Fill date, asset (via coin search), quantity, unit price, fee — confirm Total updates automatically and is read-only.
   - Submit — confirm one new row appears in the table, the drawer closes, and focus returns to the "Registrar operação" button.
4. Reopen the drawer, switch to Sell — confirm the same fieldset appears with the "moeda vendida" label variant. Submit a Sell op.
5. Reopen the drawer, switch to Trade — confirm the fieldset swaps to two blocks ("Você vende" / "Você recebe") with an arrow between them. Fill both sides and submit — confirm two new rows appear (one Sell, one Buy), sharing the same date.
6. Attempt to submit a Trade with the same asset on both sides — confirm submission is blocked with a visible message and no rows are added.
7. Click a row's edit icon — confirm the drawer opens pre-filled in the matching Buy/Sell mode; change a field and submit — confirm the row updates in place (row count unchanged).
8. With the drawer open, press Escape — confirm it closes with no new row. Reopen, click the backdrop — confirm the same. Reopen, click Cancel — confirm the same.
9. With the drawer open, press Tab repeatedly — confirm focus cycles only within the drawer. Confirm the page behind the drawer does not scroll while it is open, and scrolls normally once closed.
10. Delete a row via its delete icon — confirm it is removed and the drawer never opens as part of delete.
11. Empty-state check: an account with zero ops shows the existing empty-state message instead of a table, with the header and button still visible.

## Verification

```bash
cd web && npm test
cd web && npm run coverage
```

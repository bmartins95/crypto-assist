# Quickstart: Verifying Import Wallet Feedback & Price Freshness

## Automated

```bash
cd web && npm test
cd web && npm run coverage   # confirm ≥90% on changed files
cd backend && pytest         # unaffected, but part of the standard pre-PR gate
```

## Manual smoke test (`cd web && npm run dev`)

1. Log in, go to Settings.
2. Click "Exportar" — confirm a `.json` file downloads. Temporarily break the network (or stop the backend) and retry — confirm an in-app error message appears (not a native `alert()`).
3. Import a backup JSON containing at least one coin not already in your wallet.
   - Confirm the shown message describes an *import* succeeding — not "wallet cleared".
   - Navigate to the Wallet view — confirm the new coin shows a real market price, with no manual refresh click or page reload.
4. Import a malformed file (not valid JSON, or valid JSON missing an `ops` array) — confirm an in-app error message appears describing the failure.
5. Click "Limpar carteira":
   - Confirm the prompt is the app's own styled dialog, not a native browser `confirm()`.
   - Press Escape — confirm the dialog closes and the wallet is untouched.
   - Reopen, click the backdrop — confirm same as above.
   - Reopen, click Cancel — confirm same as above.
   - Reopen, click Confirm — confirm the wallet clears and an in-app success message appears.

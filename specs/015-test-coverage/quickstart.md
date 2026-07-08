# Quickstart: Verifying Test Coverage Gap Closure

This item has no UI or user-facing behavior to click through — verification is running the
test and coverage commands and reading their output.

## Backend

```bash
cd backend
pytest -q                                              # SC-003: zero failures, zero skips
pytest --cov=app --cov-report=term-missing             # SC-001: every app/routes/*.py ≥80%
pytest --cov=app --cov-fail-under=80                   # FR-010: gate exits non-zero below 80%
```

Confirm `app/routes/exit_prices.py` and `app/routes/export_data.py` show no missing lines in
the `PUT`/response-building branches that were previously uncovered.

## Web

```bash
cd web
npm test                                                # SC-003: zero failures, zero skips
npm run coverage                                        # SC-002: dataHandlers.ts, cognito/client.ts ≥90%
```

Confirm `src/lib/dataHandlers.ts` and `src/lib/cognito/client.ts` no longer show 0%/18% in the
coverage table.

## CI gate regression check (manual, once, then reverted — SC-005)

1. Temporarily comment out one assertion in `test_exit_prices.py` (or delete a test in
   `dataHandlers.test.ts`) so coverage drops below the configured threshold.
2. Run the corresponding gated command above (`pytest --cov=app --cov-fail-under=80` or
   `npm run coverage`) and confirm it exits non-zero.
3. Revert the temporary change before committing.

## PR description

Paste both coverage summaries (`pytest --cov` term-missing table; `npm run coverage` v8
table) into the PR description, per CLAUDE.md's test rules.

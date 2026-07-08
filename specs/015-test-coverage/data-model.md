# Data Model: Test Coverage Gap Closure

No database schema changes, no new API request/response models. This item adds tests against
existing endpoints and existing pydantic/TypeScript types. The only "data" this item
introduces is test fixture shapes and the coverage-report artifact spec.md's Key Entities
section refers to.

## Test fixture shapes (backend, `pytest.mark.pgdata`)

| Scenario | `pgdata` payload shape | Consumed by |
|---|---|---|
| Exit price GET, empty | `[]` | `test_exit_prices.py` |
| Exit price GET, populated | `[{"coin_id": "bitcoin", "exit_price": 500000.0}]` | `test_exit_prices.py` |
| Exit price PUT, create/update/delete | not applicable — asserted via `cur.execute.call_args`, not `fetchall` | `test_exit_prices.py` |
| Export, populated account | `cur.fetchall.side_effect = [ops_rows, exit_price_rows]` (two-call stub, see research.md) | `test_export.py` |
| Export, empty account | `cur.fetchall.side_effect = [[], []]` | `test_export.py` |

`ops_rows` mirrors the existing `_SELECT` column list in `export_data.py`
(`id, date, coin_id, symbol, name, type, qty, price, fee, total, platform, currency`) as a
list of dict-rows, matching the shape `test_ops.py` already uses for `ops` fixture rows.

## Test fixture shapes (web)

| Module under test | Mocked boundary | Fixture shape |
|---|---|---|
| `dataHandlers.ts` | `api.exportBackup` / `api.importBackup` (`vi.mock('./api/client')`) | `BackupPayload`-shaped object (`version`, `exportedAt`, `ops: []`, `exitPrices: {}`) |
| `dataHandlers.ts` | DOM (`URL.createObjectURL`, `HTMLAnchorElement.click`) | `vi.fn()` spies, no real file shape needed |
| `cognito/client.ts` | `fetch` (token endpoint responses) | `{ access_token, id_token, refresh_token, expires_in }` (Cognito token-endpoint shape, matching the existing `Tokens` interface minus the computed `expires_at`) |
| `cognito/client.ts` | `localStorage`/`sessionStorage` | Real jsdom Storage, cleared in `beforeEach`; malformed-JSON case writes a raw non-JSON string directly |

## Coverage report (measurement artifact, not application data)

| Field | Source | Used for |
|---|---|---|
| Per-file line/statement % | `pytest --cov=app --cov-report=term-missing` output | SC-001, pasted into PR description |
| Per-file statement/branch/function/line % | `npm run coverage` (`@vitest/coverage-v8`) output | SC-002, pasted into PR description |

These reports are ephemeral CI/local-run output, not persisted application state — captured
here only because spec.md's Key Entities section names them as the artifact done-criteria are
measured against.

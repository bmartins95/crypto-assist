# Research: Test Coverage Gap Closure

## Decision: Backend fixtures — reuse `client_with_db`, no new fixtures

**Decision**: `test_exit_prices.py` and `test_export.py` use the existing
`client_with_db` fixture (`backend/tests/conftest.py`) with `@pytest.mark.pgdata(...)` to
control what the mocked cursor returns, exactly like `test_ops.py`/`test_import.py`. For the
401-without-auth scenarios, call `TestClient(app)` directly with no dependency override
(matching `test_import.py::test_import_requires_auth`), not a new `no_auth_client` fixture.

**Rationale**: `conftest.py`'s `make_pg_stub` already handles both the list-shaped
(`fetchall`) and dict-shaped (`fetchone`) mock cases needed for `GET /api/exit-prices`
(dict-of-rows via `fetchall`) and `GET /api/export` (two sequential `fetchall` calls — ops
then exit prices — already supported by the "first call returns data, subsequent calls
return `[]`" behavior documented in `make_pg_stub`'s docstring). A dedicated `no_auth_client`
fixture already exists in `test_isolation.py` but is file-local, not exported from
`conftest.py`; `test_import.py` shows the simpler, already-established pattern (plain
`TestClient(app)`) is sufficient and avoids importing a fixture across test files.

**Alternatives considered**: Importing `test_isolation.py`'s `no_auth_client`/`user_b_client`
fixtures — rejected as an unnecessary cross-file dependency; those fixtures exist for
isolation testing specifically (two different user IDs), which this item doesn't need.

## Decision: `export_data.py`'s two-sequential-`fetchall` shape needs an explicit stub

**Decision**: For the "populated account" scenario in `test_export.py`, build the mock cursor
manually (not via the shared `make_pg_stub` helper) using `cur.fetchall.side_effect = [ops_rows,
exit_price_rows]`, so the ops query and the exit-prices query each return their own realistic
row set instead of the second query silently getting `[]`.

**Rationale**: `export_data.py` issues two `SELECT`s against the same cursor
(`ops` then `exit_prices`) before building the response. `make_pg_stub`'s default behavior
(first call gets `data`, everything after gets `[]`) exists specifically to prevent one
route's second, unrelated query from colliding with the first query's stubbed rows (a bug
`/speckit-analyze` caught during Item 13) — but here both calls are *this endpoint's own*
queries and both need real data to assert the full `BackupPayload` shape (`ops` non-empty
*and* `exitPrices` non-empty in the same test). A two-element `side_effect` list is the
established escape hatch the `make_pg_stub` docstring itself points to ("tests that care about
that second query's shape should build their own stub").

**Alternatives considered**: Two separate tests, each asserting only one of `ops`/`exitPrices`
— rejected; a single test asserting the full shape is a more direct behavioral check and
matches spec.md's Acceptance Scenario 5 ("response matches the BackupPayload shape exactly").

## Decision: `exit_prices.py` PUT test data shape

**Decision**: Model the three PUT scenarios (create, update-on-conflict, delete-via-zero) as
three separate tests against `client_with_db`, asserting only the HTTP status (204) and the
exact SQL executed (`cur.execute.call_args`) — not a full round-trip through a real database.

**Rationale**: Matches the existing mocked-psycopg testing strategy used everywhere else in
`backend/tests/` (no test in the suite hits a real Postgres instance); asserting the
executed SQL text and params is how `test_import.py` already verifies branch behavior (e.g.
`test_import_coerces_portuguese_type_values` reads `cur.executemany.call_args_list`). The
delete-via-zero branch is asserted by checking that `cur.execute` was called with the
`DELETE FROM exit_prices` statement rather than the `INSERT ... ON CONFLICT` one — this is
the one branch with zero existing coverage.

**Alternatives considered**: A real Postgres integration test — rejected as inconsistent
with the rest of the suite and unnecessary; `postgres_client.py`'s connection logic is not
what these tests are verifying.

## Decision: `dataHandlers.ts` test mocking strategy

**Decision**: Mock `@/lib/api/client`'s `api.exportBackup`/`api.importBackup` with
`vi.fn()` (module mock via `vi.mock('./api/client')`), and mock DOM download side effects
(`URL.createObjectURL`, `URL.revokeObjectURL`, `HTMLAnchorElement.click`) rather than
asserting a real file download occurred (not observable in jsdom).

**Rationale**: This matches the existing `client.test.ts` pattern of mocking `fetch`/module
boundaries rather than hitting a real network, and jsdom does not implement actual file
downloads — the standard, already-used-elsewhere-in-the-repo approach (e.g.
`AuthClient.test.tsx` mocks `window.location`) is to assert the *calls* (anchor created,
`href` set from a blob URL, `.click()` invoked, `revokeObjectURL` called) rather than an
unobservable side effect.

**Alternatives considered**: Spying on `Blob`/`FileReader` internals — rejected as testing
implementation detail instead of the observable contract (a download was triggered with the
right content-type and filename pattern).

## Decision: `cognito/client.ts` test mocking strategy

**Decision**: Mock the global `fetch`, `crypto.subtle.digest`/`crypto.getRandomValues`
(already polyfilled by jsdom in this project per `vitest.setup.ts`), and use real
`localStorage`/`sessionStorage` (jsdom provides working in-memory implementations, no mock
needed) with explicit `beforeEach` clearing.

**Rationale**: `localStorage`/`sessionStorage` are the actual state boundary this module
manages — using jsdom's real (in-memory) implementation, cleared between tests, verifies the
actual read/write round-trip instead of a mocked stand-in. Only network (`fetch`) and
non-deterministic crypto calls need mocking, matching how `AuthClient.test.tsx` (the module
that consumes `exchangeCode`) already mocks fetch at the module boundary.

**Alternatives considered**: Mocking `localStorage` entirely with a `Map`-backed fake —
rejected as redundant; jsdom's built-in Storage implementation already behaves correctly for
this test's needs (get/set/remove, `JSON.parse` failure on corrupt data), and using it keeps
the malformed-JSON test (`getTokens()` returning `null` on unparseable stored data) realistic.

## Decision: CI coverage gate mechanics

**Decision**: Backend — add `pytest-cov` to `backend/requirements-dev.txt` (it already exists
in `pyproject.toml`'s `dependency-groups.dev` for local `uv run pytest`, but CI's
`pip install -r requirements-dev.txt` step does not install it today, so `--cov-fail-under`
would fail with "unrecognized arguments" without this fix) and change both workflow files'
`run: pytest` step to `run: pytest --cov=app --cov-fail-under=80`. Web — change both
workflow files' `run: npm test` step to `run: npm run coverage` (already runs
`vitest run --coverage`) and add a `coverage.thresholds` block scoped to the two gap files in
`web/vitest.config.ts`.

**Rationale**: `--cov-fail-under=80` enforces FR-010's *overall* backend threshold directly
via pytest-cov's built-in gate (no custom script needed) — matching the ≥80%
already-achieved baseline this item establishes, so it fails only on regression, not on the
day it's merged. Vitest's per-file `coverage.thresholds` keys (glob or exact path) let
FR-011's two specific files be gated at 90% without forcing every other web file (many of
which are below 90% today, e.g. `client.ts` at 52%, `storage.ts` at 61%, per the current
report) to also pass a global 90% gate — which would fail CI immediately on files this item's
Assumptions section explicitly puts out of scope.

**Alternatives considered**: A global Vitest coverage threshold — rejected; would fail CI on
files this item's spec explicitly leaves untouched (`client.ts`, `storage.ts`, `cognito.py`,
`postgres_client.py`), which is a larger, unapproved scope expansion. A separate coverage-only
CI job — rejected as unnecessary; the existing `test` job already runs both commands, so
adding a fail-under flag is a one-line change per workflow, keeping the PR small (`pr.yml` and
`deploy.yml` already mirror each other and should keep mirroring, per the existing
convention noted in `plan.md`).

## Testing approach

**Decision**: No new testing pattern (fake timers, MSW, etc.) is introduced. All new tests use
tools already present in the repo: `pytest` + `unittest.mock` (backend), `vitest` +
`@testing-library` + `vi.mock`/`vi.fn` (web).

**Rationale**: This is a coverage-closing item, not a new-pattern item — constitution
Principle IV (No Speculative Code) argues against introducing a new test infrastructure
dependency (e.g. MSW) for four files when the existing mock-the-module-boundary approach
already used by every sibling test file is sufficient.

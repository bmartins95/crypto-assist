# backend/ — FastAPI + Python → AWS Lambda

See the root [`AGENTS.md`](../AGENTS.md) for monorepo-wide conventions.

## Stack

- **FastAPI** + **Mangum** (Lambda adapter)
- **psycopg v3** for PostgreSQL (Aurora Serverless v2 via RDS)
- **PyJWT** + **PyJWKClient** for Cognito RS256 token validation
- **pydantic-settings** for env var / `.env` loading
- Runtime: Python 3.12

## Structure

```
app/
  main.py          # FastAPI app + handler = Mangum(app)
  config.py        # Settings (pydantic-settings, reads .env)
  models.py        # Pydantic request/response models
  cognito.py       # decode_token() — validates Cognito access tokens via JWKS
  dependencies.py  # require_auth FastAPI dependency → AuthContext
  db/
    postgres_client.py  # get_conn() — lazy connect + schema + retry for Aurora 0 ACU
  routes/
    ops.py          # CRUD /api/ops
    exit_prices.py  # /api/exit-prices
    prices.py       # /api/prices (CoinGecko, USD reference, 5-min cache in DB)
    exchange_rates.py  # /api/exchange-rates (CoinGecko-derived fiat rates, 1h cache in DB)
    export_data.py  # GET /api/export
    import_data.py  # POST /api/import
tests/
  conftest.py      # pytest fixtures (mocks Cognito + psycopg)
  test_health.py
  test_ops.py
```

## Token storage accepted risk

Amplify stores Cognito access and refresh tokens in `localStorage` by default. The threat
model is XSS — a script injected into the page could read these tokens and impersonate the
user. This risk is accepted because:

- No `eval()`, `dangerouslySetInnerHTML`, or `innerHTML` with user-controlled content exists
  in the frontend codebase (enforced by ESLint security plugin in CI).
- The CloudFront distribution should serve a Content-Security-Policy header that blocks
  inline scripts and restricts script sources. If CSP is missing, add it to
  `aws-infra/stacks/app-stack.ts` on the CloudFront distribution.

No code change is required here; this note documents the decision.

## Auth

`require_auth` in `dependencies.py` validates the `Authorization: Bearer <token>` header.
`decode_token()` in `cognito.py` fetches Cognito's JWKS endpoint and verifies the RS256 signature.
On success returns `AuthContext(user_id=<cognito_sub>)`.

The JWKS fetch hits `https://cognito-idp.us-east-1.amazonaws.com/<pool_id>/.well-known/jwks.json`.
**The Lambda must have outbound internet to reach this.** The platform VPC provides that via a
NAT instance (`nat: "ec2"` in `aws-infra/stacks/platform.ts`). Without it every request hangs.

## Database

`get_conn()` in `db/postgres_client.py`:
- Returns a cached `psycopg.Connection` (one per Lambda container)
- Runs `db/schema.sql` lazily on first call (idempotent `CREATE TABLE IF NOT EXISTS`),
  then applies pending `db/migrations/*.sql` in sorted order, tracked in `schema_migrations`
- Schema + migration init is serialized across concurrent cold-start containers with a
  Postgres advisory lock (`pg_advisory_lock`) — without it, two containers racing through
  `CREATE TABLE IF NOT EXISTS` can collide and poison the connection
- Retries connection with `connect_timeout=5` up to 10 times with 2s delay — absorbs Aurora
  Serverless v2 wake-up when scaled to 0 ACU (~15-20s)
- **Do NOT call DB code at module import time** — Lambda's cold-start init phase has a hard 10s
  limit; a sleeping Aurora will block it and cause init to time out before any request is served

**Important:** `CREATE TABLE IF NOT EXISTS` never alters an existing table — constraint and
column changes only reach deployed databases through migration files. Migrations only run if
`db/migrations/` is inside the Lambda bundle (see the `copyFiles` gotcha below).

## Known Lambda / Mangum gotchas

- **`redirect_slashes=False` on the FastAPI app is required.** Mangum strips the trailing slash
  from Lambda Function URL paths before passing them to FastAPI. With the default
  `redirect_slashes=True`, a request to `/api/ops` would redirect to `/api/ops/` forever.
  All collection route decorators use `""` not `"/"` (e.g. `@router.get("")`).

- **`logging.basicConfig()` is a no-op in Lambda.** The runtime pre-installs a root handler, so
  `basicConfig` does nothing and the root level stays at WARNING. Use
  `logging.getLogger().setLevel(logging.INFO)` explicitly.

- **No Secrets Manager at runtime.** The Lambda VPC has no NAT/SM endpoint. DB credentials are
  injected as `DB_DSN` at SST deploy time via `$util.all([dbHost, dbPort, dbSecret])`.

- **The Lambda bundle only contains what `copyFiles` in `sst.config.ts` lists.** It must copy
  the whole `db/` directory, not just `db/schema.sql`. Incident 2026-07-06: `copyFiles` shipped
  only the schema file for weeks, `_run_migrations` silently skipped the missing directory, and
  no migration ever ran in any deployed environment — surfacing as a 500 on `/api/import` when
  coerced `'Buy'` rows hit a stale `ops_type_check ('Compra','Venda')` constraint. The skip now
  logs a WARNING; if CloudWatch shows `Migrations: directory ... not found`, check `copyFiles`.

- **FastAPI reports errors as `detail`, not `error`.** The web client (`web/src/lib/api/client.ts`)
  extracts string `detail` from failed responses. When raising `HTTPException`, put the
  actionable message in `detail` — it is the only diagnostic that reaches the UI, and `except`
  blocks that convert exceptions to HTTP errors without logging leave nothing in CloudWatch.

## Running locally

Needs a reachable Postgres instance — Aurora (used in AWS) is not reachable from a local
machine. The quickest option is a disposable Docker container:

```bash
docker run -d --name crypto-assist-pg -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=crypto_assist -p 5432:5432 postgres:16
```

Schema and migrations apply automatically on first backend connection — no manual setup
needed beyond the empty database above.

```bash
cp .env.example .env       # fill in DB_DSN, COGNITO_USER_POOL_ID, etc.
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 3001
pytest
```

## Lambda deployment

`sst.config.ts` deploys a Python Lambda with a Function URL inside the platform VPC.
Credentials are read from SSM at deploy time and injected as env vars. The Lambda URL
is written back to SSM as `/crypto-assist/{stage}/BackendApiUrl`.

Required SSM params (one-time setup per stage, under `/crypto-assist/{stage}/`):
- `CoingeckoApiKey` (SecureString)
- `CognitoUserPoolId`
- `WebUrl`

Platform SSM params (set by `aws-infra` deploy, under `/platform/{stage}/`):
- `DbHost`, `DbPort`, `DbSecretArn`, `VpcPrivateSubnetIds`, `LambdaSgId`

```bash
cd backend
npx sst deploy --stage dev
```

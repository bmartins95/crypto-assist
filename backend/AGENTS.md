# backend/ — FastAPI + Python → AWS Lambda

See the root [`AGENTS.md`](../AGENTS.md) for monorepo-wide conventions.

## Stack

- **FastAPI** + **Mangum** (Lambda adapter)
- **supabase-py** for auth validation (validates Supabase JWT via `admin.auth.get_user()`) and database access (RLS via per-user postgrest client)
- **pydantic-settings** for env var / `.env` loading
- Runtime: Python 3.12

## Structure

```
app/
  main.py          # FastAPI app + handler = Mangum(app)
  config.py        # Settings (pydantic-settings, reads .env)
  models.py        # Pydantic request/response models
  dependencies.py  # require_auth FastAPI dependency → AuthContext
  db/
    supabase_client.py  # get_admin_client() and get_user_client(token)
  routes/
    ops.py          # CRUD /api/ops
    exit_prices.py  # /api/exit-prices
    prices.py       # /api/prices (CoinGecko + 5-min cache)
    export_data.py  # GET /api/export
    import_data.py  # POST /api/import
tests/
  conftest.py      # pytest fixtures with Supabase stubs
  test_health.py
  test_ops.py
```

## Auth middleware

`require_auth` (in `dependencies.py`) is a FastAPI dependency injected via `Depends(require_auth)`.
It validates the `Authorization: Bearer <token>` header by calling Supabase's auth server:

```python
response = get_admin_client().auth.get_user(jwt=token)
```

On success it returns an `AuthContext` dataclass with `user_id`, `access_token`, and a per-user
Supabase client (`supabase`) that respects Row Level Security.

## Database access

All per-user queries go through `auth.supabase` (the RLS-aware user client). The `user_id` filter
is enforced by Supabase RLS policies, not manually.

Admin operations (e.g., price cache writes) use `get_admin_client()`.

## Running locally

```bash
cp .env.example .env       # fill in SUPABASE_* values
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 3001
pytest
```

## Lambda deployment

`sst.config.ts` in this folder deploys a Python Lambda with a Function URL.
Supabase credentials are read from SSM Parameter Store (SecureString) at deploy time
and injected as Lambda env vars. The Lambda URL is written back to SSM as
`/crypto-assist/{stage}/BackendApiUrl` for the frontend build to consume.

Required SSM params (one-time setup per stage):
- `/{stage}/SupabaseUrl`
- `/{stage}/SupabasePublishableKey` (SecureString)
- `/{stage}/SupabaseSecretKey` (SecureString)
- `/{stage}/CoingeckoApiKey` (SecureString, can be empty)

```bash
cd backend
npx sst deploy --stage dev
```

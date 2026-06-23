# Migration Plan — Crypto Assist → AWS

## Target architecture

Stack: **Vite + React (frontend, S3 + CloudFront) + Express/Lambda (backend) + RDS PostgreSQL + Cognito + S3**
Auth: **Amazon Cognito** (Google OAuth + email/password)
Infra: managed in a separate `aws-infra` repo using SST v3 — deploy that repo first.

```
┌──────────────────────────────┐     ┌────────────────────────┐
│   web/ (Vite + React)        │     │  mobile/ (Expo)        │
│   S3 + CloudFront            │     │  iOS / Android         │
└──────────┬────────────────┬──┘     └──────────┬─────────────┘
           │                │                    │
           │ (1) Auth       │ (2) HTTP + Bearer JWT
           ▼                ▼                    │
  ┌────────────────┐   ┌────────────────────────▼──────┐
  │    Cognito     │   │  backend/ (Express → Lambda)   │
  │  User Pool     │   │  /api/ops   /api/prices        │
  │  Google OAuth  │   │  /api/export /api/import       │
  └────────────────┘   │  middleware: Cognito JWT verify │
                        └──────────────────┬─────────────┘
                                           │
                                           ▼
                        ┌──────────────────────────────────┐
                        │               AWS                 │
                        │  ┌────────────────┐  ┌────────┐  │
                        │  │ RDS PostgreSQL  │  │   S3   │  │
                        │  │ (shared)        │  │backups │  │
                        │  └────────────────┘  └────────┘  │
                        └──────────────────────────────────┘
```

**Auth flow (Cognito):**
1. Frontend authenticates via `@aws-amplify/auth` (web) or Expo AuthSession pointing at Cognito hosted UI (mobile).
2. Cognito issues a JWT. Frontend sends it as `Authorization: Bearer <token>` on every backend call.
3. Backend validates the JWT locally against Cognito's JWKS endpoint — no SDK round-trip per request.
4. `req.userId` is set from the Cognito `sub` claim. Every DB query adds `WHERE user_id = $userId` — no RLS.

**What does NOT change:**
- `shared/` — unchanged, same exports and resolution strategy
- API contracts — all routes, method signatures, and JSON shapes are identical
- `mobile/` screens and business logic — only the auth SDK swaps
- SQL schema — reuse `supabase/migrations/` with minor edits (drop RLS policies and Supabase-specific extensions)
- CoinGecko price caching — same logic, `price_cache` becomes a plain pg table

---

## Migration phases (this repo)

> **Prerequisites — all done as of 2026-06-23:**
> - `aws-infra` platform deployed: VPC, RDS Aurora Serverless v2, Cognito User Pool, S3 bucket
> - Cognito: Google IdP configured, domain `crypto-assist.auth.us-east-1.amazoncognito.com`, web + mobile clients created
> - All outputs available in SSM Parameter Store under `/crypto-assist/prd/`
> - See `docs/aws-migration-guide.md` for the platform model and how to add new apps

### Phase 1 — Migrate web/ (Next.js → Vite + React)

- [ ] Remove Next.js; init Vite with React + TypeScript template inside `web/`
- [ ] Add TanStack Router (file-based routing, replaces Next.js App Router)
- [ ] Copy all components from `web/src/components/` — they are plain React, unchanged
- [ ] Replace `next/navigation` / `useRouter` imports with TanStack Router equivalents
- [ ] Replace `@supabase/ssr` session guard (proxy.ts) with Amplify `fetchAuthSession` route guard
- [ ] Update `shared/` resolution: `vite.config.ts` `resolve.alias` (replaces `next.config.ts` webpack alias)
- [ ] Update vitest config: add `@vitejs/plugin-react`, remove Next.js plugin
- [ ] Verify `npm test` passes
- [ ] Delete: `next.config.ts`, `src/app/`, `src/middleware.ts` / `proxy.ts`

### Phase 2 — Migrate auth (Supabase Auth → Cognito)

**Frontend (web/):**
- [ ] Install `@aws-amplify/auth`, remove `@supabase/supabase-js`
- [ ] Create `src/lib/auth.ts` wrapping Amplify (`signIn`, `signOut`, `getSession`, `getAccessToken`)
- [ ] Update login/signup page — custom form calling Amplify APIs or Cognito hosted UI redirect
- [ ] Add new redirect URI in Google Cloud Console OAuth client: `https://<cognito-domain>.auth.<region>.amazoncognito.com/oauth2/idpresponse`

**Mobile:**
- [ ] Replace Supabase auth calls with `amazon-cognito-identity-js` or Amplify
- [ ] Update Expo AuthSession flow: Cognito hosted UI URL replaces Supabase OAuth URL
- [ ] Token storage: configure Amplify's SecureStore adapter (replaces expo-secure-store supabase session)

**Backend:**
- [ ] Replace `src/middleware/auth.ts`: verify Cognito JWT using `jsonwebtoken` + cached JWKS from Cognito
- [ ] Remove `req.supabase` — no longer exists
- [ ] `req.userId` keeps the same name, now sourced from Cognito `sub` claim
- [ ] Remove `src/lib/supabase.ts` entirely (`supabaseForUser` and `supabaseAdmin` are gone)
- [ ] Add `src/lib/db.ts` — a `pg.Pool` connecting to RDS (replaces all Supabase client DB calls)
- [ ] Update test helpers: replace `supabaseStub.ts` with a pg pool mock

### Phase 3 — Migrate database (Supabase PostgreSQL → RDS)

- [ ] Export data: `supabase db dump --data-only > data.sql`
- [ ] Copy `supabase/migrations/001_initial.sql`, strip: `extensions`, `auth.users` FK, all `CREATE POLICY` and `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` blocks. Save as `supabase/migrations/001_initial_aws.sql`
- [ ] Apply schema to RDS: `psql $DB_URL < supabase/migrations/001_initial_aws.sql`
- [ ] Import data: `psql $DB_URL < data.sql`
- [ ] Update every route: replace `req.supabase.from('table').select(...)` with `pool.query('SELECT ... WHERE user_id = $1', [req.userId])`
- [ ] Routes to update: `ops.ts`, `exitPrices.ts`, `prices.ts`, `exportData.ts`, `importData.ts`
- [ ] Run `npm test` — update tests to use a pg pool mock

### Phase 4 — Migrate storage (Supabase Storage → S3)

- [ ] Install `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`
- [ ] Update `routes/exportData.ts` and `routes/importData.ts`: write/read backup JSON to/from S3
- [ ] Remove all remaining `SUPABASE_*` env var references

### Phase 5 — Deploy backend to Lambda

- [ ] Install `@codegenie/serverless-express`
- [ ] Create `src/lambda.ts` — Lambda handler wrapping the Express app from `src/app.ts`
- [ ] Keep `src/index.ts` unchanged for local `npm run dev`
- [ ] Add `sst.config.ts` to `backend/` referencing shared stack outputs (DB URL, Cognito pool ID, S3 bucket)
- [ ] Test with `sst dev`; deploy with `sst deploy --stage prod`

### Phase 6 — Cleanup

- [ ] Remove `@supabase/supabase-js`, `@supabase/ssr` from all `package.json` files
- [ ] Move `supabase/migrations/` content to `docs/db/` for reference; delete `supabase/` folder
- [ ] Delete Vercel project and remove any `vercel.json`
- [ ] Delete Railway project and remove any `railway.json` / `railway.toml`
- [ ] Delete the Supabase project (after confirming all data is in RDS and auth works end-to-end)
- [ ] Update all `.env.example` files to new AWS env vars
- [ ] Add `.github/workflows/deploy.yml` — pipeline that pushes `infra/*.yaml` to `aws-infra/apps/crypto-assist/`, triggers the aws-infra pipeline, reads SSM outputs, and deploys app code

---

## Environment variables (target)

> Prod values come from SSM (`/crypto-assist/prd/*`) — read by the CI pipeline automatically.
> For local dev, copy `.env.example` to `.env` / `.env.local` and fill in the values below.

### `web/.env.local`
```env
VITE_COGNITO_USER_POOL_ID=us-east-1_viyP4Jgbe
VITE_COGNITO_CLIENT_ID=6kgjpokpsck99tu7phcakmi84k
VITE_COGNITO_DOMAIN=https://crypto-assist.auth.us-east-1.amazoncognito.com
VITE_BACKEND_URL=https://<lambda-url>.lambda-url.us-east-1.on.aws
```

### `backend/.env`
```env
DATABASE_URL=postgresql://postgres:<password>@infra-prod-maindbcluster-baeusako.cluster-c2pa2kiqykts.us-east-1.rds.amazonaws.com:5432/infra
COGNITO_USER_POOL_ID=us-east-1_viyP4Jgbe
COGNITO_REGION=us-east-1
AWS_REGION=us-east-1
S3_BUCKET=infra-prod-backupsbucket-onzmeohh
COINGECKO_API_KEY=
FRONTEND_ORIGIN=http://localhost:5173
PORT=3001
```

> DB password: retrieve from Secrets Manager secret `rds!cluster-06de2a7d-3128-4d7a-b76b-c23c28d68b8a`. Never commit it.

### `mobile/.env.local`
```env
EXPO_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_viyP4Jgbe
EXPO_PUBLIC_COGNITO_CLIENT_ID=349nucuq3lupb0p9je5ihrudn6
EXPO_PUBLIC_COGNITO_DOMAIN=https://crypto-assist.auth.us-east-1.amazoncognito.com
EXPO_PUBLIC_BACKEND_URL=https://<lambda-url>.lambda-url.us-east-1.on.aws
```

---

## API contracts

All routes, HTTP methods, and JSON shapes are **unchanged**. The only difference is the JWT issuer (Cognito instead of Supabase) — clients do not observe this.

All routes require `Authorization: Bearer <cognito_jwt>`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ops` | All ops for the authenticated user, ordered by date |
| POST | `/api/ops` | Create an op (body = Op without `id`) |
| PUT | `/api/ops/:id` | Update an op |
| DELETE | `/api/ops/:id` | Delete an op |
| GET | `/api/exit-prices` | `{ coinId: exitPrice }` map for the user |
| PUT | `/api/exit-prices` | Body: `{ coinId, exitPrice }` |
| GET | `/api/prices?ids=bitcoin,ethereum` | CoinGecko prices with 5-min DB cache |
| GET | `/api/export` | Full backup JSON |
| POST | `/api/import` | Import backup JSON |

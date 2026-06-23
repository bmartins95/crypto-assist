# backend/ — Express 5 + TypeScript → AWS Lambda

See the root [`AGENTS.md`](../AGENTS.md) for monorepo-wide conventions and
[`../MIGRATION_PLAN.md`](../MIGRATION_PLAN.md) for the architecture.

## This is Express 5, not Express 4

Express 5 has breaking changes from the Express 4 most training data assumes —
most notably wildcard routes (`app.get('/*', ...)` no longer works; use `/*splat`)
and the removal of several deprecated methods (`app.del`, `res.json(status, body)`,
etc.). Check the [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html)
before adding anything with a wildcard or pattern route.

## Structure

- `src/app.ts` builds and returns the Express app (no `.listen()`) — imported
  directly by tests via Supertest. `src/index.ts` just calls `createApp().listen(...)`.
  `src/lambda.ts` wraps `createApp()` with `@codegenie/serverless-express` for Lambda.
  Keep this three-way split: tests use `app.ts`, local dev uses `index.ts`, Lambda uses `lambda.ts`.
- `src/middleware/auth.ts` validates the Cognito JWT (verified locally against
  Cognito's JWKS endpoint using `jsonwebtoken`) and populates `req.userId` (the
  Cognito `sub` claim) and `req.accessToken`. Routes never read auth state directly.
- `src/lib/db.ts` exports a `pg.Pool` connected to RDS. All DB access goes
  through this pool. There is no Supabase client anywhere — user isolation is
  enforced by `WHERE user_id = $userId` in every query, not by RLS.
- `src/test/` has shared test helpers — reuse them instead of hand-rolling mocks.

## Auth middleware — key detail

The backend no longer calls any external service to validate JWTs. Instead,
`auth.ts` fetches Cognito's JWKS once at startup (and re-fetches periodically),
then verifies each incoming JWT locally. This means:
- Zero latency added per request for auth
- `req.userId` = Cognito `sub` claim (a UUID string)
- No `req.supabase` — that pattern is gone

## Database access

Use `pool.query(sql, params)` from `src/lib/db.ts`. Always parameterize queries —
never interpolate user-controlled values into SQL strings. Every query that
accesses per-user data must include `WHERE user_id = $n` using `req.userId`.

Example:
```typescript
const { rows } = await pool.query(
  'SELECT * FROM ops WHERE user_id = $1 ORDER BY date DESC',
  [req.userId]
);
```

## Running locally

```bash
npm run dev    # tsx watch src/index.ts (Express on port 3001)
npm test       # Vitest + Supertest
npm run build  # tsc → dist/ (used by Lambda)
```

Lambda deployment is handled by SST (`sst.config.ts` in this folder).
`sst dev` runs a live Lambda tunnel for local end-to-end testing against real AWS resources.

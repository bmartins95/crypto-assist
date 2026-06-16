# backend/ — Express + TypeScript

See the root [`AGENTS.md`](../AGENTS.md) for monorepo-wide conventions
(language, testing commands, env var naming) and
[`../PLANO_BACKEND.md`](../PLANO_BACKEND.md) for the architecture.

## This is Express 5, not Express 4

Express 5 has breaking changes from the Express 4 most training data and
tutorials assume — most notably wildcard routes (`app.get('/*', ...)` no
longer works; use `/*splat`) and the removal of several deprecated methods
(`app.del`, `res.json(status, body)`, etc.). Check the
[Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html)
before adding anything with a wildcard or pattern route — none of the
current routes use one, so there's no existing example to copy from.

## Structure

- `src/app.ts` builds and returns the Express app (no `.listen()`) —
  imported directly by tests via Supertest. `src/index.ts` just calls
  `createApp().listen(...)`. Keep this split: don't move route/middleware
  setup back into `index.ts`.
- `src/middleware/auth.ts` populates `req.userId`, `req.accessToken` and
  `req.supabase` (a client scoped to that user's JWT, so Postgres RLS
  enforces isolation automatically — routes never filter by `user_id`
  manually).
- `src/lib/supabase.ts` also exports `supabaseAdmin` (secret key, bypasses
  RLS). Only use it for operations that aren't per-user, like writing to
  the shared `price_cache` table — see `routes/prices.ts`.
- `src/test/` has the shared test helpers (`supabaseStub.ts`,
  `testApp.ts`) — reuse them instead of hand-rolling new mocks per test
  file.

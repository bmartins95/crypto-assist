# Crypto Assist — monorepo guide

This repo has four projects that share the same Supabase project and `backend/` API:

- **`shared/`** — Pure TypeScript (no framework, no build step). Contains the
  types, formatters, and portfolio calculation logic used by both `web/` and
  `mobile/`. Import from `@crypto-assist/shared` — each project resolves it via
  its own path alias (see below).
- **`web/`** — Next.js 16 frontend, deployed on Vercel. Has its own `AGENTS.md`
  with Next.js-specific breaking-change warnings — read that too when working
  inside `web/`.
- **`backend/`** — Express 5 + TypeScript HTTP API, deployed on Railway. No auth
  logic of its own; validates the Supabase JWT and serves data. Has its own
  `AGENTS.md` (Express 5 gotchas, app.ts/index.ts split).
- **`mobile/`** — Expo SDK 56 + React Native, not yet deployed. Uses expo-router
  (file-based routing) and the same `backend/` API as `web/`. Has its own
  `AGENTS.md` — read it before working inside `mobile/`.
- **`supabase/`** — SQL migrations, shared by all projects.

See [`PLANO_BACKEND.md`](PLANO_BACKEND.md) for the full architecture, auth flow,
API contracts and the phased implementation plan (Fases 1–5).

## Shared code (`shared/`)

`shared/src/` exports three modules — all plain TypeScript, no runtime deps:

| File | Exports |
|------|---------|
| `types.ts` | `Op`, `NewOp`, `Asset`, `MarketPrices`, `BackupPayload`, etc. |
| `format.ts` | `fmt`, `fmtPct`, `fmtQty`, `fmtDate` |
| `portfolio.ts` | `computePositions`, `collectAssets`, `computeTimeline`, etc. |

**Resolution — no npm workspaces** (they caused root-level `node_modules`
pollution and broke per-project installs):

- `web/`: tsconfig `paths` + webpack `alias` in `next.config.ts` + vitest `resolve.alias`
- `mobile/`: Metro `resolver.extraNodeModules` in `metro.config.js`

Never install packages at the repo root.

## Language convention

Decided explicitly partway through this project: **code is in English, the
product is in Portuguese.**

- English: variable/field/type names, comments, API error messages, SQL
  schema, commit messages, and internal docs (this file, `PLANO_BACKEND.md`,
  the per-project `AGENTS.md` files).
- Portuguese: everything the end user actually sees — UI labels, buttons,
  table headers, alert/toast messages. The app's audience is Brazilian and
  values are in BRL; don't translate user-facing strings to English.
- Exception: data values that happen to be Portuguese words (e.g. the
  `Op.type` values `'Compra'`/`'Venda'`) are data, not code — leave them as
  they are everywhere (DB check constraint, API payloads, UI).

## Testing

`web/` and `backend/` use Vitest. Run from inside each folder:

```bash
cd web && npm test       # Vitest + Testing Library (lib/ + components/)
cd backend && npm test   # Vitest + Supertest (middleware/ + routes/)
```

`mobile/` has no automated tests yet.

See `backend/AGENTS.md` for how the backend tests avoid needing a real
Supabase project.

## Environment variables

Supabase's current API key naming: `*_PUBLISHABLE_KEY` (safe in the browser,
replaces the old "anon key") and `*_SECRET_KEY` (server-only, replaces the old
"service_role key"). Each project has a `.env.example` — copy it to
`.env`/`.env.local`, never commit the real values.

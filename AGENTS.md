# Crypto Assist — monorepo guide

This repo has four projects sharing the same `backend/` API, deployed on AWS:

- **`shared/`** — Pure TypeScript (no framework, no build step). Contains the
  types, formatters, and portfolio calculation logic used by both `web/` and
  `mobile/`. Import from `@crypto-assist/shared` — each project resolves it via
  its own path alias (see below).
- **`web/`** — Vite + React + TanStack Router frontend, deployed to S3 + CloudFront.
  Has its own `AGENTS.md` — read it when working inside `web/`.
- **`backend/`** — Express 5 + TypeScript HTTP API, deployed to AWS Lambda via SST.
  Validates Cognito JWTs and queries RDS directly. Has its own `AGENTS.md`
  (Express 5 gotchas, app.ts/index.ts split, Lambda adapter).
- **`mobile/`** — Expo SDK 54 + React Native. Uses expo-router (file-based routing)
  and the same `backend/` API as `web/`. Has its own `AGENTS.md` — read it before
  working inside `mobile/`.

Infrastructure (VPC, RDS, Cognito, S3 buckets) is managed in a separate `aws-infra`
repo using SST v4. `aws-infra` is a multi-app platform — this repo self-registers by
pushing YAML configs to `aws-infra/apps/crypto-assist/` and triggering its pipeline.
See [`MIGRATION_PLAN.md`](MIGRATION_PLAN.md) for the full architecture, auth flow,
API contracts, and the phased migration checklist.
See [`docs/aws-migration-guide.md`](docs/aws-migration-guide.md) for the platform
model, YAML config format, and SSM output conventions.

## Shared code (`shared/`)

`shared/src/` exports three modules — all plain TypeScript, no runtime deps:

| File | Exports |
|------|---------|
| `types.ts` | `Op`, `NewOp`, `Asset`, `MarketPrices`, `BackupPayload`, etc. |
| `format.ts` | `fmt`, `fmtPct`, `fmtQty`, `fmtDate` |
| `portfolio.ts` | `computePositions`, `collectAssets`, `computeTimeline`, etc. |

**Resolution — no npm workspaces** (they caused root-level `node_modules`
pollution and broke per-project installs):

- `web/`: tsconfig `paths` + `resolve.alias` in `vite.config.ts` + vitest `resolve.alias`
- `mobile/`: Metro `resolver.extraNodeModules` in `metro.config.js`

Never install packages at the repo root.

## Language convention

Decided explicitly partway through this project: **code is in English, the
product is in Portuguese.**

- English: variable/field/type names, comments, API error messages, SQL
  schema, commit messages, and internal docs (this file, `MIGRATION_PLAN.md`,
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

Each project has a `.env.example` — copy it to `.env`/`.env.local`, never commit real values.
See `MIGRATION_PLAN.md` for the full list of env vars for each project (web, backend, mobile).

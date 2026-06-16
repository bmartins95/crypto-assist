# Crypto Assist — monorepo guide

This repo has three independent projects, each deployed separately:

- **`web/`** — Next.js 16 frontend. Has its own `AGENTS.md` with Next.js-specific
  breaking-change warnings — read that one too when working inside `web/`.
- **`backend/`** — Express + TypeScript HTTP API. No auth logic of its own; it
  only validates the Supabase JWT sent by the frontend and serves data. Has
  its own `AGENTS.md` (Express 5 gotchas, app.ts/index.ts split) — read that
  one too when working inside `backend/`.
- **`supabase/`** — SQL migrations, shared by both projects (and future `mobile/`).

See [`PLANO_BACKEND.md`](PLANO_BACKEND.md) for the full architecture, auth flow,
API contracts and the phased implementation plan (Fase 1–5).

## Language convention

Decided explicitly partway through this project: **code is in English, the
product is in Portuguese.**

- English: variable/field/type names, comments, API error messages, SQL
  schema, commit messages, and internal docs (this file, `PLANO_BACKEND.md`,
  the `backend/`/`web/` READMEs).
- Portuguese: everything the end user actually sees — UI labels, buttons,
  table headers, alert/toast messages. The app's audience is Brazilian and
  values are in BRL; don't translate user-facing strings to English.
- Exception: data values that happen to be Portuguese words (e.g. the
  `Op.type` values `'Compra'`/`'Venda'`) are data, not code — leave them as
  they are everywhere (DB check constraint, API payloads, UI).

## Testing

Both projects use Vitest. Run from inside each folder:

```bash
cd web && npm test       # Vitest + Testing Library (lib/ + components/)
cd backend && npm test   # Vitest + Supertest (middleware/ + routes/)
```

See `backend/AGENTS.md` for how the backend's tests avoid needing a real
Supabase project.

## Environment variables

Supabase's current API key naming: `*_PUBLISHABLE_KEY` (safe in the browser,
replaces the old "anon key") and `*_SECRET_KEY` (server-only, replaces the old
"service_role key"). Both projects have a `.env.example` — copy it, never
commit the real `.env`/`.env.local`.

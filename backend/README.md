# Backend — Crypto Portfolio

HTTP API in Express + TypeScript, consumed by `web/` (and eventually `mobile/`).
It doesn't handle login/signup — that's done by the frontend directly against
Supabase Auth. Here we only validate the received JWT and serve data
(ops, exit prices, prices, backup).

See [`../PLANO_BACKEND.md`](../PLANO_BACKEND.md) for the full architecture.

## Setup

```bash
cp .env.example .env
# fill in SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY
# (Supabase Dashboard -> Project Settings -> API)

npm install
npm run dev      # http://localhost:3001, with auto reload
```

## Scripts

- `npm run dev` — development (tsx watch)
- `npm run build` — compiles to `dist/`
- `npm start` — runs the build (`dist/index.js`)

## Routes

All require `Authorization: Bearer <supabase_access_token>`, except `/health`.

| Method | Route | Description |
|---|---|---|
| GET | `/api/ops` | lists the user's operations |
| POST | `/api/ops` | creates an operation |
| PUT | `/api/ops/:id` | updates an operation |
| DELETE | `/api/ops/:id` | removes an operation |
| GET | `/api/exit-prices` | the user's exit price targets |
| PUT | `/api/exit-prices` | sets/removes an exit price target |
| GET | `/api/prices?ids=bitcoin,ethereum` | prices (5-minute cache) |
| GET | `/api/export` | full backup as JSON |
| POST | `/api/import` | restores a backup from JSON |

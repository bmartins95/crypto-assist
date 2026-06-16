# Backend Plan — Crypto Portfolio

Stack: **Next.js 16 (frontend) + Express + TypeScript (backend) + Supabase + Vercel**
Auth: **Supabase Auth** (Google OAuth + email/password) — used directly by the frontend, bypassing the backend
Future mobile: **Expo + React Native**, consuming the same `backend/`

> Decision: frontend (`web/`) and backend (`backend/`) are separate projects in the same
> repository, so the future mobile app (`mobile/`) can consume the same HTTP backend
> without depending on the Next.js project.

---

## Architecture overview

```
┌─────────────────────────────┐     ┌───────────────────────┐
│        web/ (Next.js)       │     │  mobile/ (Expo, future)│
│   UI only — no API routes   │     │  iOS / Android         │
└──────────┬───────────────┬──┘     └──────────┬─────────────┘
           │               │                    │
           │ (1) Direct    │ (2) HTTP + Bearer JWT
           │ Auth          │     │              │
           ▼               ▼     ▼              │
   ┌───────────────┐   ┌────────────────────────▼────┐
   │ Supabase Auth  │   │     backend/ (Express)      │
   │ (login/signup, │   │  /api/ops   /api/prices     │
   │  Google OAuth) │   │  /api/exit-prices            │
   └───────┬────────┘   │  /api/export /api/import    │
           │            │  Middleware: validates JWT   │
           │            │  Supabase (per-user RLS)     │
           │            └──────────────┬───────────────┘
           │                           │
           ▼                           ▼
   ┌──────────────────────────────────────────────────┐
   │                     Supabase                      │
   │  ┌─────────────┐  ┌──────────────┐  ┌──────────┐  │
   │  │ PostgreSQL   │  │ Supabase Auth│  │ Storage  │  │
   │  │ (RLS)        │  │              │  │ (backups)│  │
   │  └─────────────┘  └──────────────┘  └──────────┘  │
   └────────────────────────────────────────────────────┘
```

**Auth flow:**
1. The frontend (web or mobile) talks **directly to Supabase Auth** via `@supabase/supabase-js` for login, signup, Google OAuth and session refresh. Reimplementing this flow in the backend wouldn't add value — the Supabase SDK already handles PKCE, refresh tokens, etc., and this is naturally shared between web and mobile as-is.
2. To call the backend, the frontend sends the Supabase session's **JWT access token** in the `Authorization: Bearer <token>` header.
3. The backend validates that token (via `supabase.auth.getUser(token)`) in a middleware, and uses a Supabase client **authenticated with the user's token** so Postgres RLS automatically enforces `user_id` isolation.
4. For operations that require server privileges (e.g. writing to the shared price cache), the backend uses a separate client with the `secret key`.

---

## Database schema (PostgreSQL)

See [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql) — contains the `profiles`, `ops`, `exit_prices` and `price_cache` tables, all with RLS enabled.

---

## Repository folder structure

```
crypto-assist/
├── web/                             ← Next.js (frontend, UI only)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             ← redirects to /dashboard or /auth
│   │   │   ├── auth/
│   │   │   │   ├── page.tsx         ← login/signup (Google + email/password)
│   │   │   │   └── callback/route.ts← exchanges the OAuth code for a session
│   │   │   └── dashboard/
│   │   │       ├── layout.tsx       ← verifies the session server-side, header with logout
│   │   │       └── page.tsx         ← main app (used to be app/page.tsx)
│   │   ├── components/              ← already exist
│   │   ├── lib/
│   │   │   ├── types.ts             ← already exists
│   │   │   ├── format.ts            ← already exists
│   │   │   ├── portfolio.ts         ← already exists
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts        ← browser client (publishable key)
│   │   │   │   └── server.ts        ← server client (Server Components/Route Handlers)
│   │   │   └── api/
│   │   │       └── client.ts        ← fetch() functions to call the backend/
│   │   └── proxy.ts                 ← Next 16: protects /dashboard (renamed from middleware)
│   └── .env.local                   ← NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
│                                       NEXT_PUBLIC_BACKEND_URL
│
├── backend/                         ← Express + TypeScript (HTTP API, independent project)
│   ├── src/
│   │   ├── index.ts                 ← Express bootstrap (cors, json, routes)
│   │   ├── middleware/
│   │   │   └── auth.ts              ← validates Bearer token, populates req.user
│   │   ├── lib/
│   │   │   └── supabase.ts          ← supabaseAdmin (secret key) + supabaseForUser(token)
│   │   └── routes/
│   │       ├── ops.ts               ← GET/POST /api/ops, PUT/DELETE /api/ops/:id
│   │       ├── exitPrices.ts        ← GET/PUT /api/exit-prices
│   │       ├── prices.ts            ← GET /api/prices (CoinGecko cache)
│   │       ├── exportData.ts        ← GET /api/export
│   │       └── importData.ts        ← POST /api/import
│   ├── .env                         ← SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY,
│   │                                   COINGECKO_API_KEY, FRONTEND_ORIGIN (for CORS)
│   ├── package.json
│   └── tsconfig.json
│
├── mobile/                          ← Expo + React Native (future)
├── supabase/
│   └── migrations/
│       └── 001_initial.sql
└── PLANO_BACKEND.md
```

---

## Environment variables

### `web/.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001        # production: the backend's Vercel URL
```

### `backend/.env`
```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...                  # same value as the frontend's publishable key
SUPABASE_SECRET_KEY=sb_secret_...                            # never exposed to the client
COINGECKO_API_KEY=                                    # optional, CoinGecko Demo key
FRONTEND_ORIGIN=http://localhost:3000                 # for CORS configuration
PORT=3001
```

---

## API — contracts (backend/, `/api` prefix)

All routes (except the health check) require the `Authorization: Bearer <supabase_access_token>` header.

### `GET /api/ops`
Returns all of the authenticated user's operations, ordered by date.
```json
[
  {
    "id": "uuid",
    "date": "2024-01-15",
    "coinId": "bitcoin",
    "symbol": "BTC",
    "name": "Bitcoin",
    "type": "Compra",
    "qty": 0.01,
    "price": 250000,
    "fee": 5,
    "total": 2505,
    "platform": "Binance"
  }
]
```

### `POST /api/ops`
Creates a new operation. Body = an Op object without `id`.

### `PUT /api/ops/:id`
Updates an existing operation.

### `DELETE /api/ops/:id`
Removes an operation.

### `GET /api/exit-prices`
Returns `{ coinId: exitPrice }` for the user.

### `PUT /api/exit-prices`
Body: `{ coinId: string, exitPrice: number }`

### `GET /api/prices?ids=bitcoin,ethereum`
Fetches CoinGecko prices (and coin images) with a 5-minute cache in the `price_cache` table (written with the secret key).
Returns: `{ bitcoin: { price: 350000, image: "https://..." }, ethereum: { price: 18000 } }` — `image` is omitted when unknown.

### `GET /api/export`
Generates and returns the user's full backup as JSON.

### `POST /api/import`
Imports a backup JSON (same format as the export).

---

## Authentication — detailed flow

```
1. User opens web/ at "/"
2. proxy.ts (Next.js) checks the Supabase session via cookie
3. If not authenticated -> redirect to /auth
4. /auth offers: "Sign in with Google" or email/password, via supabase-js in the browser
5. Supabase creates a session (JWT access + refresh token), persisted in cookies by @supabase/ssr
6. proxy.ts grants access to /dashboard
7. The frontend reads the session's access token and sends it as a Bearer token on every call to backend/
8. The backend's middleware validates the token (supabase.auth.getUser(token))
9. Postgres RLS guarantees user_id isolation even if the JWT leaks
```

On mobile (future), the same `@supabase/supabase-js` is used for login, and the access token is attached to calls to the same `backend/`.

---

## Migrating existing data

For users who already use `index.html` with `localStorage`:
1. The first time they access the app authenticated, check whether there's data in `localStorage`
2. Offer: "We found local data. Would you like to import it into your account?"
3. If yes -> call `POST /api/import` (on backend/) with the `localStorage` data
4. Clear `localStorage` after a successful import

---

## Mobile (Expo + React Native) — future strategy

Expo will consume the same `backend/` (HTTP API) and the same Supabase project (for Auth), exactly like `web/` does today.

Code sharing between web and mobile:
- `lib/types.ts` — 100% reusable (plain TypeScript) → candidate to become `shared/`
- `lib/format.ts` — 100% reusable
- `lib/portfolio.ts` — 100% reusable
- `lib/api/client.ts` — 100% reusable (HTTP fetch to the backend/)
- UI (React components) — **not** directly reusable; recreated in React Native

---

## Implementation order

### Phase 1 — Supabase + Auth
1. Create the Supabase project
2. Run `supabase/migrations/001_initial.sql`
3. Configure Google OAuth in Supabase
4. Install `@supabase/ssr` in `web/`
5. Create `lib/supabase/client.ts` and `lib/supabase/server.ts`
6. Create `proxy.ts` to protect routes
7. Create the `/auth` page with Google + email/password login
8. Create `dashboard/layout.tsx` + move the current app to `dashboard/page.tsx`

### Phase 2 — Express backend
9. Scaffold `backend/` (Express + TypeScript)
10. Authentication middleware (validates Bearer token)
11. `GET/POST /api/ops`, `PUT/DELETE /api/ops/:id`
12. `GET/PUT /api/exit-prices`
13. `GET /api/prices` (with cache in the `price_cache` table)
14. `GET /api/export` and `POST /api/import`

### Phase 3 — Migrate the frontend
15. Create `lib/api/client.ts` in `web/` (fetch + automatic Bearer token)
16. Replace `localStorage` calls with calls to `backend/`
17. Add loading states to the tables
18. Implement detection and import of `localStorage` data

### Phase 4 — Deploy
19. Push to GitHub
20. Connect `web/` and `backend/` as **two separate Vercel projects** (each with its own root directory)
21. Add environment variables to each project on Vercel
22. Configure `NEXT_PUBLIC_BACKEND_URL` in `web/` pointing to the backend's production URL
23. Configure a custom domain (optional)

### Phase 5 — Mobile (future session)
24. Create the `mobile/` folder with `npx create-expo-app`
25. Extract `shared/` with types, format, portfolio, api client
26. Implement equivalent screens in React Native
27. Configure Google OAuth in Expo
28. Point the app at the same `backend/` and Supabase project
29. Deploy to the App Store / Google Play via EAS Build

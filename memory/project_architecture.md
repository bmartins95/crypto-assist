---
name: project-architecture
description: Crypto Assist monorepo structure — web/Next.js, backend/Express, mobile/Expo, shared/pure TS
metadata:
  type: project
---

This is a monorepo with four independent projects deployed separately:

- **`web/`** — Next.js 16, deployed on Vercel. Auth via Supabase SSR.
- **`backend/`** — Express 5 + TypeScript, deployed on Railway. JWT auth middleware, Supabase RLS.
- **`mobile/`** — Expo SDK 56 + React Native. expo-router (file-based), Supabase SecureStore session.
- **`shared/`** — Pure TypeScript (no build, no framework). Contains `types.ts`, `format.ts`, `portfolio.ts`, `index.ts`.

**Why:** `shared/` was extracted in Fase 5 so mobile and web share the same types and business logic.

**How to apply:** When working in mobile or web, types/formatters/portfolio logic come from `shared/`. Never duplicate these files.

Shared code resolution (no npm workspaces):
- `web/`: tsconfig paths `@crypto-assist/shared → ../shared/src/index` + webpack alias in `next.config.ts` + vitest alias
- `mobile/`: Metro `extraNodeModules['@crypto-assist/shared'] → ../shared/src` in `metro.config.js`

See [[feedback-no-root-workspaces]] for why npm workspaces were avoided.

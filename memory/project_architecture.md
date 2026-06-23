---
name: project-architecture
description: Crypto Assist monorepo — web/Vite+React, backend/Express+Lambda, mobile/Expo, shared/pure TS; migrating from Supabase/Vercel/Railway to AWS
metadata:
  type: project
---

This is a monorepo with four independent projects deployed separately on AWS:

- **`web/`** — Vite + React + TanStack Router, deployed to S3 + CloudFront. Auth via `@aws-amplify/auth`.
- **`backend/`** — Express 5 + TypeScript, deployed to AWS Lambda via SST. Cognito JWT auth middleware, RDS PostgreSQL.
- **`mobile/`** — Expo SDK 54 + React Native. expo-router (file-based), Cognito auth via Amplify.
- **`shared/`** — Pure TypeScript (no build, no framework). Contains `types.ts`, `format.ts`, `portfolio.ts`, `index.ts`.

**Migration status:** In progress — migrating from Supabase/Vercel/Railway to AWS. Infrastructure (VPC, RDS, Cognito) is already deployed in `aws-infra`.

**Why:** `shared/` was extracted so mobile and web share the same types and business logic. Language convention: code in English, UI in Portuguese (Brazilian users, BRL values).

**How to apply:** When working in mobile or web, types/formatters/portfolio logic come from `shared/`. Never duplicate these files.

## Infrastructure

Managed in the separate `aws-infra` repo (SST v4). aws-infra is a multi-app platform — crypto-assist registers its resources via YAML configs that trigger the aws-infra pipeline. See [[project-platform-architecture]] in the aws-infra memory for details.

Prod resources already deployed:
- Cognito User Pool: `us-east-1_viyP4Jgbe` (Google OAuth enabled)
- Cognito Domain: `crypto-assist.auth.us-east-1.amazoncognito.com`
- Web Client ID: `6kgjpokpsck99tu7phcakmi84k`
- Mobile Client ID: `349nucuq3lupb0p9je5ihrudn6`
- RDS endpoint: `infra-prod-maindbcluster-baeusako.cluster-c2pa2kiqykts.us-east-1.rds.amazonaws.com`
- S3 Backup Bucket: `infra-prod-backupsbucket-onzmeohh`

## Shared code resolution (no npm workspaces)

- `web/`: tsconfig paths `@crypto-assist/shared → ../shared/src/index` + `resolve.alias` in `vite.config.ts` + vitest alias
- `mobile/`: Metro `extraNodeModules['@crypto-assist/shared'] → ../shared/src` in `metro.config.js`

See [[feedback-no-root-workspaces]] for why npm workspaces were avoided.

# Crypto Assist — monorepo guide

This repo has four projects sharing the same `backend/` API, deployed on AWS:

- **`shared/`** — Pure TypeScript (no framework, no build step). Types, formatters, and portfolio calculation logic used by `web/` and `mobile/`. Import from `@crypto-assist/shared` via path aliases.
- **`web/`** — Vite + React + TanStack Router frontend. Has its own `AGENTS.md`.
- **`backend/`** — Python FastAPI + Mangum API, deployed to AWS Lambda via SST. Validates Cognito JWTs and queries RDS Aurora. Has its own `AGENTS.md`.
- **`mobile/`** — Expo SDK 54 + React Native. Has its own `AGENTS.md`.

Infrastructure (VPC, RDS, Cognito, S3) is in `aws-infra` repo. This repo self-registers by pushing YAML configs to `aws-infra/apps/crypto-assist/`.

## Language convention

**Code in English, product is multilingual.**

- English: variable/field names, comments, API errors, SQL schema, commit messages, docs
- UI strings (labels, buttons, toasts, table headers): driven by the user's selected locale via the i18n layer in `shared/src/i18n/`
- Default locale: `pt-BR` (Portuguese / BRL) — used when no preference is stored
- Exception: data values that are Portuguese words (`Op.type` = `'Compra'`/`'Venda'`) stay as-is everywhere

## Shared code (`shared/`)

| File | Exports |
|------|---------|
| `types.ts` | `Op`, `NewOp`, `Asset`, `MarketPrices`, `BackupPayload`, etc. |
| `format.ts` | `fmt`, `fmtPct`, `fmtQty`, `fmtDate` |
| `portfolio.ts` | `computePositions`, `collectAssets`, `computeTimeline`, etc. |

No npm workspaces — each project resolves `@crypto-assist/shared` via its own path alias. Never install packages at repo root.

## Testing

- **`backend/`** — pytest. Run: `cd backend && pytest`
- **`web/`** — Vitest + Testing Library. Run: `cd web && npm test`
- `mobile/` has no automated tests yet.

## CI/CD pipeline

Triggered on push to `develop`. Sequential: Test → Register dev → Deploy dev → Approve stg → Register stg → Deploy stg → Approve prod → Register prod → Deploy prod.

Each deploy stage calls `bmartins95/aws-shared-pipeline/.github/workflows/deploy-stage.yml@master`, which runs:
1. `scripts/ci-deploy.sh <stage>` — deploys the backend Lambda via `npx sst deploy`
2. Reads platform SSM outputs (Cognito IDs, BackendApiUrl)
3. `scripts/ci-build-web.sh <stage>` — builds the Next.js web app with injected env vars

Branch promotion: after deploy-stg → force-push to `staging`; after deploy-prod → force-push to `master`. Uses `PROMOTE_TOKEN` (owner PAT) to bypass the Admin-only branch ruleset on those branches.

## Branch protection

- `develop`: PRs required, no bypass — all changes via feature branches
- `master` / `staging`: GitHub Ruleset (Admin bypass only). Pipeline uses PROMOTE_TOKEN (Admin) to push; humans cannot merge directly.
- Default branch is `develop` — `gh pr create` without `--base` targets develop.

**IMPORTANT for agents:** Never push directly to `develop`, `staging`, or `master`. Always work on a feature branch and open a PR. Merging to `develop` is the only way to trigger the CI/CD deploy pipeline.

## Environment variables

Copy `backend/.env.example` to `backend/.env` for local dev. Never commit real values.

Backend SSM params (stored in AWS SSM, injected at Lambda deploy time):
- `/crypto-assist/{stage}/CoingeckoApiKey` (SecureString)
- `/crypto-assist/{stage}/CognitoUserPoolId`
- `/crypto-assist/{stage}/WebUrl`
- `/crypto-assist/{stage}/BackendApiUrl` — written automatically after each deploy

Platform SSM params (set by `aws-infra` deploy, under `/platform/{stage}/`):
- `DbHost`, `DbPort`, `DbSecretArn`, `VpcPrivateSubnetIds`, `LambdaSgId`

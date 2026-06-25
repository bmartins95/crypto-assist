@AGENTS.md
@PLAN.md

## Implementation rules

### Workflow
- Always branch from `develop` before starting any work. Never commit directly to `develop`, `staging`, or `master`.
- Branch naming: `feat/`, `fix/`, `chore/`, `docs/`, `test/`, `refactor/` + a short descriptive slug.
- One branch per plan item. If an item is large, split it into sequential branches (e.g. `feat/i18n-shared`, `feat/i18n-web`, `feat/i18n-mobile`).
- Open a PR to `develop` when the item is done. Do not start the next plan item until the current PR is merged.
- When a plan item's PR merges, tick its checkbox in `PLAN.md` in the same commit or a follow-up `chore:` commit on `develop`.

### Commits
- Single line only, 72 characters max.
- Conventional commit prefix required: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `style:`.
- No body paragraph. No Co-Authored-By footer. No bullet lists.

### Code
- No comments unless the WHY is non-obvious (a hidden constraint, a workaround, a subtle invariant). Never explain WHAT the code does.
- No code beyond what the current plan item requires. No speculative abstractions.
- TypeScript: no `any`. Prefer explicit types. New shared types go in `shared/src/types.ts`; new shared utilities get their own file in `shared/src/`.
- Always use the `@crypto-assist/shared` path alias. Never use relative imports across packages.
- New exports from `shared/` must be added to `shared/src/index.ts`.

### Tests
- New backend routes require at least one happy-path and one error-path test in `backend/tests/`.
- New shared library functions require tests in `web/src/lib/*.test.ts` or `shared/src/*.test.ts`.
- Run `cd backend && pytest` and `cd web && npm test` before opening a PR. Fix all failures before marking done.

### Plan tracking
- Before starting any plan item, read its entry in `PLAN.md` in full — current state, files, done criteria.
- Do not skip ahead or combine plan items unless explicitly told to.
- If a plan item's dependencies are not yet merged, say so and stop rather than working around them.

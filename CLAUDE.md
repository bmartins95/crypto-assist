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
- No comments. The only exception is a single line explaining WHY when there is a hidden constraint, a non-obvious workaround, or a subtle invariant that would surprise a reader. Never explain WHAT — well-named identifiers do that.
- No code beyond what the current plan item requires. No speculative abstractions, no helper functions for a single call site, no future-proofing.
- Code must be modular: one responsibility per function, one concern per module, no god-objects. Follow the patterns already established in the codebase (factory functions, context providers, route handlers) rather than introducing new structural patterns.
- TypeScript: no `any`. No type assertions (`as T`) without a comment explaining why it is safe. No non-null assertions (`!`) unless the surrounding logic proves the value is non-null. Prefer explicit return types on exported functions.
- Always use the `@crypto-assist/shared` path alias. Never use relative imports across packages.
- New exports from `shared/` must be added to `shared/src/index.ts`.
- No dead code. No commented-out code blocks. No unused imports or variables. The linter catches most of these — fix them before committing.

### Tests
- Target ≥90% code coverage on every changed module. Run `pytest --cov=app --cov-report=term-missing` (backend) and `npm run coverage` (web) before opening a PR and paste the summary in the PR description.
- Coverage alone is not enough. Every feature and user-facing behaviour must have an explicit test: the happy path, the main error paths, and any edge cases documented in the plan item. A line being executed by a test is not the same as a behaviour being verified.
- Good path: the operation succeeds and the response/state is exactly what is expected.
- Bad paths: invalid input, missing auth, resource not found, upstream failure (mock it), concurrent modification — whichever apply to the feature.
- New shared library functions require tests alongside the function in `shared/src/*.test.ts` or `web/src/lib/*.test.ts`.
- Run `cd backend && pytest` and `cd web && npm test` before opening a PR. Fix all failures first.

### Error handling
- Never swallow errors silently. Every `catch` block must do one of: re-throw, return a meaningful error response, or log and fail visibly. Empty `catch {}` is only acceptable when ignoring is genuinely correct, and a comment must say why.
- In the backend, unhandled exceptions must surface as an HTTP error with a useful `detail` message, not a silent 500.
- In the frontend, every `await` in an event handler must have a `catch` that updates visible UI state (an error message, a toast, a status field) — never just `console.error`.

### Dependencies
- Before adding an npm or pip package, check if the functionality exists in current dependencies or can be written in under 20 lines. If a new package is genuinely needed, note the reason in the PR description.
- Do not add packages with no active maintenance or that would be the sole consumer of a single function.

### Database
- Migrations are additive only. Never remove a column, rename a column, or add a `NOT NULL` constraint to an existing nullable column in a single step. Add first, migrate data, remove in a later migration after the deploy is stable.
- All schema changes go through a migration file committed alongside the code that uses them. Never run `ALTER TABLE` manually in any environment.

### PR scope
- A PR must do exactly one thing. If a branch grows too large, split it into sequential branches. A reviewer or future AI session should be able to understand the full change in one reading.

### Accessibility
- Every `<input>` must have an associated `<label>`. Every interactive element that is not a `<button>` or `<a>` needs an `aria-label`. Images need `alt` text.
- In React Native, use `accessibilityLabel` on all touchable elements and images.

### Security
- Never trust client-supplied data. Validate all inputs at the API boundary in `backend/`.
- No secrets, API keys, or credentials in source code or committed files. All sensitive values come from SSM or environment variables.
- No `eval()`, no `dangerouslySetInnerHTML`, no `innerHTML` with user-controlled content.

### Mobile parity
- If a change touches `shared/` types or a component used by mobile, verify the mobile app still builds and the affected screen still renders correctly before opening the PR.
- Do not merge a change that breaks the mobile type contract even if the web side compiles cleanly.

### Plan tracking
- Before starting any plan item, read its entry in `PLAN.md` in full — current state, files, done criteria.
- Do not skip ahead or combine plan items unless explicitly told to.
- If a plan item's dependencies are not yet merged, say so and stop rather than working around them.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/019-platform-field-catalog/plan.md
<!-- SPECKIT END -->

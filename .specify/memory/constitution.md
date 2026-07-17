<!--
Sync Impact Report
==================
Version change: template (unversioned) → 1.0.0 (initial ratification)

Principles defined (all new):
  - I.  Shared-First Architecture
  - II. Security at the Boundary
  - III. Behavior Coverage Over Line Coverage
  - IV. No Speculative Code
  - V.  Accessibility and Internationalisation

Sections added:
  - Technology Standards
  - Development Workflow
  - Governance

Templates reviewed:
  - .specify/templates/plan-template.md   ✅ "Constitution Check" gate present; no update needed
  - .specify/templates/spec-template.md   ✅ No constitution-specific constraints; no update needed
  - .specify/templates/tasks-template.md  ✅ No principle-driven task types requiring change
  - .specify/templates/checklist-template.md ✅ Generic structure; no update needed

Deferred placeholders: none
-->

# Crypto Assist Constitution

## Core Principles

### I. Shared-First Architecture

All cross-package types, formatters, and portfolio calculation logic MUST live in
`shared/src/`. The `web/` and `mobile/` packages are consumers only; they MUST NOT
duplicate shared concerns or import directly from each other. New exports from `shared/`
MUST be added to `shared/src/index.ts`. The `@crypto-assist/shared` path alias is
mandatory — relative cross-package imports are forbidden.

If a change touches `shared/` types or a component used by mobile, the mobile app MUST
still build and the affected screen MUST still render correctly before the PR can be
opened. A change that breaks the mobile type contract MUST NOT be merged even if the web
side compiles cleanly.

### II. Security at the Boundary

All inputs MUST be validated at the API boundary in `backend/`. Client-supplied data is
never trusted. Secrets, API keys, and credentials MUST be stored in AWS SSM or
environment variables — never in source code or committed files. CORS MUST restrict
allowed origins to known CloudFront URLs; `allow_origins=["*"]` is prohibited in any
environment. `eval()`, `dangerouslySetInnerHTML`, and `innerHTML` with user-controlled
content are prohibited.

Every `catch` block MUST do one of: re-throw, return a meaningful error response, or
log and fail visibly. Empty `catch {}` requires a comment explaining why ignoring is
correct. In the frontend, every `await` in an event handler MUST update visible UI state
on failure — never just `console.error`.

### III. Behavior Coverage Over Line Coverage

Test coverage ≥90% per changed module is required before opening a PR, but coverage
alone is insufficient. Every user-facing behaviour MUST have an explicit test covering:
the happy path, the primary error paths (invalid input, missing auth, resource not
found, upstream failure), and any edge cases documented in the plan item. A line being
executed by a test is not the same as a behaviour being verified.

New shared library functions require tests alongside the function in
`shared/src/*.test.ts`. Run `cd backend && pytest` and `cd web && npm test` before
opening a PR; fix all failures first.

### IV. No Speculative Code

Code MUST be limited to what the current plan item explicitly requires. No abstractions
for single call sites, no helper functions added for hypothetical future callers, no
backwards-compatibility shims unless removing a live dependency. Three similar lines are
better than a premature abstraction.

Dead code, commented-out blocks, and unused imports MUST NOT be committed. No
comments explaining WHAT code does — well-named identifiers do that. A comment is only
acceptable when the WHY is non-obvious: a hidden constraint, a subtle invariant, or a
workaround for a specific bug.

Before adding an npm or pip package, check whether the functionality exists in current
dependencies or can be written in under 20 lines. Packages with no active maintenance
or that would be the sole consumer of a single function MUST NOT be added.

### V. Accessibility and Internationalisation

Every `<input>` MUST have an associated `<label>`. Every interactive element that is
not a `<button>` or `<a>` MUST have an `aria-label`. Images MUST have `alt` text. In
React Native, all touchable elements and images MUST have `accessibilityLabel`.

All UI strings MUST go through the i18n layer (`useLocale()` / `UIText`); hardcoded
Portuguese strings in JSX or TSX are a violation. The default locale is `pt-BR`.
Product language is Portuguese (Brazilian audience, values in BRL). Code, comments, API
errors, SQL schema, and commit messages are in English.

## Technology Standards

The stack is fixed. Introducing technologies outside this list requires a plan item that
explicitly justifies the addition and documents the reason in the PR description.

- **Backend**: Python + FastAPI + Mangum, deployed to AWS Lambda via SST
- **Frontend**: Vite + React + TanStack Router
- **Mobile**: Expo SDK 54 + React Native
- **Shared**: Pure TypeScript — no framework, no build step
- **Database**: AWS RDS Aurora (PostgreSQL); migrations are additive only (add first,
  migrate data, remove in a later migration after the deploy is stable)
- **Auth**: AWS Cognito with Amplify on clients; token storage risk is documented and
  mitigated by CSP and the absence of `eval`/`innerHTML`
- **TypeScript**: `any` is prohibited. Type assertions (`as T`) require an inline
  comment explaining why the assertion is safe. Non-null assertions (`!`) require
  surrounding logic that proves the value is non-null.

## Development Workflow

All changes flow through feature branches. Direct commits to `develop`, `staging`, or
`master` are prohibited.

- **Branching**: `feat/`, `fix/`, `chore/`, `docs/`, `test/`, or `refactor/` prefix
  plus a short descriptive slug. One branch per plan item; split large items into
  sequential branches.
- **PRs**: Open to `develop` when the item is complete. Do not start the next plan item
  until the current PR merges. Tick the plan item checkbox in `docs/PLAN.md` in the same or
  a follow-up `chore:` commit on `develop`.
- **Commits**: Single line, ≤72 characters, Conventional Commit prefix required
  (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `style:`). No body
  paragraph, no bullet lists, no Co-Authored-By footer.
- **PR scope**: A PR MUST do exactly one thing. A reviewer or future AI session MUST be
  able to understand the full change in a single reading.
- **Pre-PR gate**: Run `cd backend && pytest` and `cd web && npm test`; fix all
  failures. Paste coverage summary in the PR description.

## Governance

This constitution supersedes all other practices in the repository. Where `CLAUDE.md`,
`AGENTS.md`, or any other file conflicts with a principle defined here, this document
takes precedence.

**Amendment procedure**:
1. Open a PR that modifies this file, updates `CONSTITUTION_VERSION` and
   `LAST_AMENDED_DATE`, and prepends a Sync Impact Report as an HTML comment.
2. Version bump follows semantic versioning: MAJOR for removed or redefined principles;
   MINOR for new sections or material additions; PATCH for wording or typo fixes.
3. All templates under `.specify/templates/` MUST be reviewed and updated in the same
   PR if any principle change affects them.

All PRs MUST verify compliance with this constitution before merge. Complexity
violations — abstractions beyond the plan item, additional dependencies, speculative
code — MUST be justified in the PR description or the PR MUST be rejected.

**Version**: 1.0.0 | **Ratified**: 2026-06-26 | **Last Amended**: 2026-06-26

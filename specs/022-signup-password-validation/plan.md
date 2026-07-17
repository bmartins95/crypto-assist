# Implementation Plan: Signup Password Validation UX

**Branch**: `fix/signup-password-feedback` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-signup-password-validation/spec.md`

## Summary

Replace the signup and password-reset forms' minimal password feedback (a static "minimum 8
characters" placeholder, and a generic error for every server rejection) with a live requirements
checklist, a derived strength meter, a show/hide toggle, a live confirm-password match indicator
(signup only), and specific error messages for a server-side password-policy rejection —
distinguished from both the generic fallback and the existing "email already registered" /
"invalid code" messages. Technical approach: a new pure `web/src/auth/passwordPolicy.ts` module
(rule evaluation + strength derivation, matching the Cognito dev pool's confirmed policy), a new
`PasswordRequirements` display component reused by both forms, a `revealed` toggle added inside
the existing `PasswordField` without disturbing its Chrome-autofill masking mechanism, and
`err.name`-based branches added to both forms' existing catch blocks.

## Technical Context

**Language/Version**: TypeScript, React 19 (no new language/runtime)

**Primary Dependencies**: Existing stack only — React, `aws-amplify/auth` (already used via
`web/src/auth/useAuth.ts`), `@crypto-assist/shared` i18n layer. No new npm packages (both new
modules/components are well under the constitution's 20-line dependency-addition threshold).

**Storage**: N/A — no schema, backend, or persisted-data change. The existing `signUp` /
`confirmResetPassword` Amplify calls are reused unmodified; only their thrown-error handling
changes.

**Testing**: Vitest + Testing Library (`cd web && npm test` / `npm run coverage`). `cd backend &&
pytest` is unaffected but re-run per the pre-PR gate.

**Target Platform**: Web only (`web/src/auth/`). Mobile has no signup/reset screen today (custom
auth UI is web-only per Items 17-18), so it is unaffected; only the additive `shared/` i18n keys
are visible to it.

**Project Type**: Web application (monorepo frontend package `web/`, shared package `shared/`)

**Performance Goals**: N/A — no new performance-sensitive path; rule evaluation is five cheap
regex/length checks run on keystroke, well within React's per-render budget.

**Constraints**: No new dependencies. Must not regress the existing Chrome-autofill masking
mechanism in `PasswordField.tsx` (see its inline comments) — the show/hide toggle must never
unmount/remount the underlying `<input>` node outside its existing masked/plain transition. Must
not break the mobile type contract (Principle I) — the only shared-package change is additive
`UIText` keys.

**Scale/Scope**: Two screens (`SignupScreen.tsx`, `EmailLoginScreen.tsx`'s reset-confirm mode),
one changed shared component (`PasswordField.tsx`), one new component
(`PasswordRequirements.tsx`), one new pure module (`passwordPolicy.ts`), i18n additions across 10
locale files. No backend, database, or infra changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Shared-First Architecture** — PASS. The only `shared/` change is additive `UIText` keys
  (see `contracts/component-interfaces.md`) added to `shared/src/i18n/types.ts` and all 10 locale
  files. No mobile screen consumes these new keys, so the mobile type contract and rendering are
  unaffected; mobile build is still verified as part of done-criteria. `passwordPolicy.ts` and
  `PasswordRequirements.tsx` deliberately live in `web/`, not `shared/` — see `research.md`'s
  "Where the rule/strength-computation logic lives" decision.
- **II. Security at the Boundary** — PASS (mostly N/A). No backend routes, inputs, or trust
  boundaries change. The client-side rule checklist is a UX aid only — Cognito's own server-side
  policy remains the actual enforcement point, and a password that somehow bypasses the disabled
  submit button is still rejected server-side and now surfaces a specific message instead of a
  silent/generic one.
- **III. Behavior Coverage Over Line Coverage** — PASS, enforced by task list: new
  `passwordPolicy.test.ts` covers every rule individually and the strength-level boundaries;
  `PasswordRequirements.test.tsx` covers the empty-password (nothing rendered) and populated
  states; `PasswordField.test.tsx` gains show/hide toggle cases including a check that no DOM node
  is replaced by the toggle; `SignupScreen.test.tsx` and `EmailLoginScreen.test.tsx` gain cases for
  the new `InvalidPasswordException` branch, the preserved `UsernameExistsException` /
  code-invalid branches, and the confirm-password match/mismatch indicator. Target ≥90% coverage
  on all changed files.
- **IV. No Speculative Code** — PASS. `PasswordRequirements` is scoped to exactly its two real call
  sites (signup, reset); no generic "form validation framework" is introduced. The
  confirm-password match indicator is inlined directly in `SignupScreen.tsx` rather than extracted
  to a component, since it has exactly one call site (Principle IV: three similar lines beat a
  premature abstraction — here it's one call site, not even three). The two intermediate strength
  colors are scoped literals, not new global design tokens (see `research.md`).
- **V. Accessibility and Internationalisation** — PASS. The show/hide toggle button gets an
  `aria-label` (`t.auth_password_show`/`auth_password_hide`), matching this repo's rule that
  non-`button`/`a` interactive elements need one (the toggle *is* a `<button>`, but the label is
  still added for icon-only clarity to screen readers). The requirements checklist and
  match/mismatch indicators use `aria-live`/`role="status"` semantics appropriate for live-updating
  text (finalized in `tasks.md`). Every new string routes through `t.*`; new keys added to all 10
  locale files, keeping `UIText` satisfied for every locale (compile-time enforced).

No violations. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/022-signup-password-validation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── component-interfaces.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
shared/
└── src/
    └── i18n/
        ├── types.ts                        # + auth_password_rule_*, auth_password_strength_*,
        │                                    #   auth_error_password_rejected, auth_password_match,
        │                                    #   auth_password_mismatch, auth_password_show/hide
        └── locales/*.ts                     # all 10 locale files, same new keys

web/
└── src/
    └── auth/
        ├── passwordPolicy.ts                # NEW — pure rule/strength functions
        ├── passwordPolicy.test.ts           # NEW
        ├── PasswordRequirements.tsx          # NEW — checklist + strength bar display component
        ├── PasswordRequirements.test.tsx     # NEW
        ├── PasswordField.tsx                 # + revealed state, eye-icon toggle
        ├── PasswordField.test.tsx            # + toggle tests (incl. no-remount assertion)
        └── screens/
            ├── SignupScreen.tsx               # + <PasswordRequirements>, confirm-match indicator,
            │                                  #   isPasswordValid(), InvalidPasswordException branch
            ├── SignupScreen.test.tsx          # + new-branch tests
            ├── EmailLoginScreen.tsx           # + <PasswordRequirements> in forgot-confirm mode,
            │                                  #   InvalidPasswordException branch in handleForgotConfirm
            └── EmailLoginScreen.test.tsx      # + new-branch tests

web/src/app/globals.css                        # + .auth-eye-toggle, .auth-strength-*, .auth-rule-*,
                                                #   .auth-confirm-match/.auth-confirm-mismatch
```

**Structure Decision**: Follows the existing `web/src/auth/` flat-file convention already used by
`PasswordField.tsx`, `AuthField.tsx`, `BackButton.tsx`, etc. (page-agnostic auth UI pieces live
directly in `auth/`, screens live in `auth/screens/`). `passwordPolicy.ts` sits alongside
`PasswordField.tsx` rather than in a new `utils/` subdirectory, matching how `credentials.ts`
(another auth-local pure module) is already placed. No new top-level directories; no backend or
mobile paths touched.

## Complexity Tracking

*No constitution violations — table not needed.*

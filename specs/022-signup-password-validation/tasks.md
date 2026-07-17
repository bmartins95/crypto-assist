---

description: "Task list for signup password validation UX (PLAN.md Item 23)"
---

# Tasks: Signup Password Validation UX

**Input**: Design documents from `/specs/022-signup-password-validation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/component-interfaces.md, quickstart.md

**Tests**: Included — the constitution's Principle III (Behavior Coverage Over Line Coverage) requires
an explicit test for every user-facing behaviour, and the pre-PR gate requires ≥90% coverage on
changed modules.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and
testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps the task to US1/US2/US3 from spec.md
- File paths are exact and repo-relative

## Path Conventions

Web app monorepo: `shared/src/` (cross-package types + i18n), `web/src/` (frontend). No `backend/`
or `mobile/` source changes — see plan.md's Technical Context / Target Platform.

---

## Phase 1: Setup

No project initialization required — this feature reuses the existing `web/` toolchain (Vite,
Vitest, TypeScript) and adds no new dependencies (plan.md Technical Context). Proceed directly to
Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The i18n keys and pure rule/strength logic every user story's UI depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 Add new `UIText` keys to `shared/src/i18n/types.ts`: `auth_password_rule_length`,
      `auth_password_rule_uppercase`, `auth_password_rule_lowercase`, `auth_password_rule_number`,
      `auth_password_rule_special`, `auth_password_strength_weak`, `auth_password_strength_fair`,
      `auth_password_strength_good`, `auth_password_strength_strong`,
      `auth_error_password_rejected`, `auth_password_match`, `auth_password_mismatch`,
      `auth_password_show`, `auth_password_hide` (contracts/component-interfaces.md's exact key list)
- [X] T002 [P] Add translations for the T001 keys to `shared/src/i18n/locales/pt-BR.ts` (reference
      locale — write this one first for wording, others may translate from it)
- [X] T003 [P] Add translations for the T001 keys to `shared/src/i18n/locales/en-US.ts`
- [X] T004 [P] Add translations for the T001 keys to `shared/src/i18n/locales/es-ES.ts`
- [X] T005 [P] Add translations for the T001 keys to `shared/src/i18n/locales/fr-FR.ts`
- [X] T006 [P] Add translations for the T001 keys to `shared/src/i18n/locales/de-DE.ts`
- [X] T007 [P] Add translations for the T001 keys to `shared/src/i18n/locales/zh-CN.ts`
- [X] T008 [P] Add translations for the T001 keys to `shared/src/i18n/locales/ja-JP.ts`
- [X] T009 [P] Add translations for the T001 keys to `shared/src/i18n/locales/ar-SA.ts`
- [X] T010 [P] Add translations for the T001 keys to `shared/src/i18n/locales/hi-IN.ts`
- [X] T011 [P] Add translations for the T001 keys to `shared/src/i18n/locales/ru-RU.ts`
- [X] T012 [P] Implement `evaluatePasswordRules`, `computePasswordStrength`, and `isPasswordValid`
      in `web/src/auth/passwordPolicy.ts` per contracts/component-interfaces.md (pure functions, no
      React/i18n dependency; rule set matches the Cognito dev pool policy confirmed in research.md)
- [X] T013 [P] Write `web/src/auth/passwordPolicy.test.ts`: each of the 5 rules individually
      (met/unmet), `isPasswordValid` true only when all 5 pass, `computePasswordStrength` returns
      `null` for an empty password and the correct level at each of the 5 rule-count boundaries
      (0-2 → weak, 3 → fair, 4 → good, 5 → strong)

**Checkpoint**: i18n keys compile (`UIText` satisfied by all 10 locales) and `passwordPolicy.ts` is
fully tested. User story implementation can now begin.

---

## Phase 3: User Story 1 - See password requirements while typing (Priority: P1) 🎯 MVP

**Goal**: Live requirements checklist + strength meter on both the signup form's password field and
the password-reset form's new-password field; submit disabled until valid; show/hide toggle on
every password field (FR-001–004, FR-012).

**Independent Test**: Type a password character-by-character on `/signup`; each of the 5 checklist
items and the strength label update live with no submit needed. Repeat on the reset form's
new-password field.

### Implementation for User Story 1

- [X] T014 [P] [US1] Implement `PasswordRequirements.tsx` in `web/src/auth/PasswordRequirements.tsx`:
      renders nothing when `password === ''`; otherwise the 4-segment strength bar + 5-rule
      checklist, resolving labels/colors via `useLocale()` from `evaluatePasswordRules`/
      `computePasswordStrength` (T012); use `role="status" aria-live="polite"` on the checklist
      container so screen readers announce changes without being re-read on every keystroke
- [X] T015 [P] [US1] Write `web/src/auth/PasswordRequirements.test.tsx`: renders nothing for an
      empty password; shows all 5 rules with correct met/unmet state for a partially-valid
      password; shows the strongest strength label/color for a fully-valid password
- [X] T016 [P] [US1] Add a `revealed` boolean state and eye-icon show/hide toggle button to
      `web/src/auth/PasswordField.tsx`: toggling only adds/removes the `-webkit-text-security`
      masking CSS class (or, pre-first-keystroke, flips the still-real `type="password"` element's
      `type` in place) — it must never change the `key` prop or otherwise cause React to
      unmount/remount the `<input>` node (see research.md's "Show/hide toggle placement" decision
      and the file's existing Chrome-autofill comments). Toggle button gets
      `aria-label={t.auth_password_show / t.auth_password_hide}` based on current state.
- [X] T017 [US1] Update `web/src/auth/PasswordField.test.tsx` with toggle cases: clicking the
      toggle reveals the value (input becomes visually unmasked) and toggling back re-masks it;
      the underlying DOM node reference is unchanged across a toggle (assert `getInput()` returns
      the same element before/after, unlike the existing masked/plain transition tests); the
      toggle button's `aria-label` reflects the current state (depends on T016)
- [X] T018 [US1] Add CSS for the strength bar, rule checklist rows, and eye-toggle button to
      `web/src/app/globals.css`: reuse `--s-accent` for the strongest level and `--danger` for the
      weakest, scoped literal colors for the two intermediate levels (research.md's "Strength-level
      colors" decision); position the toggle button per the design reference
      (`docs/design/signup-password-validation.html`) (depends on T014, T016 for exact class names)
- [X] T019 [US1] In `web/src/auth/screens/SignupScreen.tsx`: replace `validate()`'s
      `password.length < 8` branch with `!isPasswordValid(password)` (still mapped to
      `t.auth_error_password_short`); render `<PasswordRequirements password={password} />`
      directly under the password `PasswordField`. **Deviation from the original task wording**:
      submit is gated via `validate()` returning false (existing pattern, matches FR-004's
      "or otherwise prevented" clause) rather than a hard `disabled` attribute — hard-disabling on
      password validity would also have disabled the button for an entirely empty form, breaking
      the existing "click submit on an empty form to reveal all required-field errors at once" UX
      covered by `SignupScreen.test.tsx`'s pre-existing "shows validation errors for an empty
      submission" test.
- [X] T020 [US1] In `web/src/auth/screens/EmailLoginScreen.tsx`'s `forgot-confirm` mode: render
      `<PasswordRequirements password={newPassword} />` under the new-password `PasswordField`.
      Same deviation as T019: `handleForgotConfirm` now returns early with
      `t.auth_error_password_short` when `!isPasswordValid(newPassword)`, instead of a hard
      `disabled` attribute (this form had no prior client-side validation at all, so this is a new
      but consistent prevention path, not a UX regression).
- [X] T021 [P] [US1] Update `web/src/auth/screens/SignupScreen.test.tsx`: the checklist appears
      once typing starts; submit stays disabled until the password is valid and becomes enabled
      once it is (depends on T019)
- [X] T022 [P] [US1] Update `web/src/auth/screens/EmailLoginScreen.test.tsx`: the checklist appears
      in `forgot-confirm` mode once typing starts in the new-password field; that mode's submit
      stays disabled until the new password is valid (depends on T020)

**Checkpoint**: User Story 1 is fully functional and testable independently — a user gets live
requirement feedback and a working show/hide toggle on both forms.

---

## Phase 4: User Story 2 - Specific feedback when the server rejects a password (Priority: P1)

**Goal**: An `InvalidPasswordException` from Cognito shows a specific message on both forms,
distinct from the generic fallback and from the existing "email already registered" / "invalid
code" messages, which must keep working exactly as today (FR-005–009).

**Independent Test**: Mock `signUp`/`confirmResetPassword` to throw an error named
`InvalidPasswordException` and confirm the specific message renders on each form; mock
`UsernameExistsException` (signup) and a code-related exception (reset) and confirm their existing
messages are unaffected.

### Implementation for User Story 2

- [X] T023 [US2] In `web/src/auth/screens/SignupScreen.tsx`'s `handleSubmit` catch block: add an
      `errName === 'InvalidPasswordException'` branch mapped to `t.auth_error_password_rejected`,
      checked before the existing `UsernameExistsException` → `t.auth_error_email_taken` branch and
      before the `t.auth_error_generic` fallback (depends on T001/T003 for the new key; touches the
      same file as T019 — apply after T019 lands to avoid conflicting edits)
- [X] T024 [US2] In `web/src/auth/screens/EmailLoginScreen.tsx`'s `handleForgotConfirm` catch
      block: branch on `err instanceof Error ? err.name : ''` — `'InvalidPasswordException'` →
      `t.auth_error_password_rejected`; anything else → keep today's `t.auth_error_code_invalid`
      (fixes the current unconditional generic-to-code-invalid mapping named in spec.md's Current
      State; depends on T001/T003; touches the same file as T020 — apply after T020 lands)
- [X] T025 [P] [US2] Update `web/src/auth/screens/SignupScreen.test.tsx`: an `InvalidPasswordException`
      shows `t.auth_error_password_rejected`; a `UsernameExistsException` still shows
      `t.auth_error_email_taken` (regression); an unrecognized error name still shows
      `t.auth_error_generic` (regression) (depends on T023)
- [X] T026 [P] [US2] Update `web/src/auth/screens/EmailLoginScreen.test.tsx`'s `forgot-confirm`
      tests: an `InvalidPasswordException` shows `t.auth_error_password_rejected`; a
      `CodeMismatchException` (or any non-password error name) still shows
      `t.auth_error_code_invalid` (regression, closing the bug where every failure previously
      showed this message) (depends on T024)

**Checkpoint**: User Stories 1 and 2 both work independently; existing error paths are unregressed.

---

## Phase 5: User Story 3 - Confirm-password match feedback (Priority: P2)

**Goal**: A live match/mismatch indicator under the signup form's confirm-password field
(FR-010).

**Independent Test**: Type a password, then a non-matching confirmation — a mismatch indicator
appears live; correct it to match — the indicator updates to a match state live, with no submit.

### Implementation for User Story 3

- [X] T027 [US3] In `web/src/auth/screens/SignupScreen.tsx`: under the confirm-password
      `PasswordField`, render a derived, inline indicator (no new component — single call site
      per plan.md's Principle IV rationale): `confirmPassword !== '' && confirmPassword ===
      password` → match state (`t.auth_password_match`, `role="status"`); `confirmPassword !== ''
      && confirmPassword !== password` → mismatch state (`t.auth_password_mismatch`,
      `role="status"`); `confirmPassword === ''` → nothing rendered (touches the same file as
      T019/T023 — apply after both land)
- [X] T028 [P] [US3] Update `web/src/auth/screens/SignupScreen.test.tsx`: mismatch indicator shows
      live for a non-matching confirm value; switches to the match indicator once corrected;
      neither shows while the confirm field is empty (depends on T027)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T029 [P] Run `cd web && npm run coverage` and confirm ≥90% coverage on every file touched by
      T001–T028; add any missing edge-case tests the report surfaces. Result: `passwordPolicy.ts`
      and `PasswordRequirements.tsx` 100%; `PasswordField.tsx` 91.52%; `SignupScreen.tsx` 100%;
      `EmailLoginScreen.tsx` 98.43% — remaining uncovered lines are pre-existing, unrelated to this
      feature (e.g. the Chrome-autofill-detect animation handler). Full suite: 531/531 tests passing
      across 47 files, no regressions.
- [X] T030 Verify the mobile app still builds after the additive `shared/src/i18n/types.ts` /
      locale changes (constitution Principle I): `cd mobile && npx tsc --noEmit` (or the project's
      existing build check per `specs/019-platform-field-catalog/quickstart.md`'s precedent); no
      mobile screen consumes the new keys, so no rendering change is expected. Result: no i18n/UIText
      errors; the 2 pre-existing `app/settings.tsx` errors (expo-file-system, `BackupPayload`
      conversion) were confirmed present on `develop` too via `git stash`, unrelated to this change.
- [ ] T031 Execute `specs/022-signup-password-validation/quickstart.md`'s manual smoke test end to
      end against `cd web && npm run dev`. **Not performed** — no browser tool was available in this
      session to drive the dev server. Left for manual verification before merge.
- [X] T032 Run `cd backend && pytest` per the pre-PR gate (unaffected by this change, but required
      before opening the PR). Result: 169/169 passed, unaffected as expected.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None — no tasks.
- **Foundational (Phase 2)**: No dependencies — BLOCKS all user stories (T001 blocks T002–T011;
  T012 blocks T013 and all of Phase 3+ that calls `passwordPolicy.ts`).
- **User Stories (Phase 3-5)**: All require Phase 2 complete. US1, US2, and US3 are each
  independently testable per spec.md, but US2's and US3's screen-file edits (T023/T024/T027) are
  sequenced *after* US1's screen-file edits (T019/T020) purely to avoid clobbering the same lines
  of `SignupScreen.tsx`/`EmailLoginScreen.tsx` in a solo-implementation pass — a team could instead
  branch each story from the Foundational checkpoint and merge/rebase.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Parallel Opportunities

- T002–T011 (10 locale files) can all run in parallel once T001 lands.
- T012/T013 (passwordPolicy.ts + its test) can run in parallel with the entire i18n chain
  (T001–T011) — no shared files.
- T014/T015 (PasswordRequirements + its test) and T016 (PasswordField toggle) can run in parallel
  with each other — different files — but both need T012 available for T014, and T012 is already
  a Foundational dependency.
- T021 and T022 can run in parallel (different test files).
- T025 and T026 can run in parallel (different test files).

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (i18n keys + `passwordPolicy.ts`).
2. Complete Phase 3: User Story 1 — this alone already closes the plan item's headline complaint
   (no more vague "minimum 8 characters" hint).
3. **STOP and VALIDATE**: run `quickstart.md` steps 1–4 and 6 independently.

### Incremental Delivery

1. Foundational → Phase 3 (US1) → validate → Phase 4 (US2) → validate → Phase 5 (US3) → validate
   → Phase 6 (Polish) → open PR.

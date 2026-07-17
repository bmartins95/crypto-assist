# Feature Specification: Signup Password Validation UX

**Feature Branch**: `fix/signup-password-feedback` (spec directory `022-signup-password-validation`)

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "Item 23 — Signup password validation UX (docs/PLAN.md). Show the real password requirements enforced by Cognito during signup and password reset, with a live checklist and strength indicator, and map password-specific server rejections to specific, actionable messages instead of a generic error. Design reference: docs/design/signup-password-validation.html."

## Clarifications

### Session 2026-07-17

- Q: Should the password-reset ("forgot password") form get the full live requirements checklist + strength meter (User Story 1's UI), or only the specific-error-mapping fix (User Story 2)? → A: Full treatment — reset form gets the same live checklist and strength meter as signup, since the same server-enforced policy applies to both and a user choosing a new password during reset benefits from the same live guidance a signup user gets.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See password requirements while typing (Priority: P1)

A user creating an account, or resetting a forgotten password, starts typing a new password. Before they ever submit the form, they see exactly which requirements their password already satisfies and which it still needs — not just a vague "minimum 8 characters" hint.

**Why this priority**: This is the core of the fix — today the only guidance is a static placeholder that understates the real policy, so users routinely submit a password that looks fine to them and then get rejected with no useful explanation. Showing the real rules live is what prevents that failure in the first place, on both the account-creation and password-reset paths.

**Independent Test**: On the signup form, type a password one character at a time and confirm each requirement (length, uppercase, lowercase, number, special character) visibly flips from unmet to met the moment it becomes true, with no page reload or submit needed. Repeat on the password-reset form's new-password field with the same result.

**Acceptance Scenarios**:

1. **Given** the signup form's password field is empty, **When** the user starts typing, **Then** a checklist of every password requirement appears, showing which are currently met and which are not.
2. **Given** the user has typed a password missing one requirement (e.g. no special character), **When** they add a character that satisfies it, **Then** that requirement's status updates to met immediately, without needing to leave the field or submit the form.
3. **Given** the user has typed a password satisfying all requirements, **When** they view the checklist, **Then** every requirement shows as met and an overall strength indicator reflects the strongest level.
4. **Given** the password-reset form's new-password field is empty, **When** the user starts typing, **Then** the same live checklist and strength indicator appear as on the signup form.

---

### User Story 2 - Specific feedback when the server rejects a password (Priority: P1)

A user submits a signup (or password reset) form with a password that satisfies every requirement shown on-screen, but the server still rejects it for a reason not visible client-side (e.g. it matches a known-breached password). Instead of a generic "something went wrong" message, they see a specific explanation of why the password was rejected and what to do next.

**Why this priority**: Equal priority to Story 1 because it closes the other half of the gap described in the plan item — even a fully accurate client-side checklist cannot predict every server-side rejection reason, so the error path must also be specific. Without this, a user can be stuck resubmitting the same rejected password with no clue why.

**Independent Test**: Simulate a server rejection response for a password that passed all client-side checks, and confirm the shown message names the actual problem rather than a generic fallback.

**Acceptance Scenarios**:

1. **Given** a user submits a signup form with a password meeting every displayed requirement, **When** the server rejects the account creation because of the password itself, **Then** a specific message describing the password problem is shown, not the generic error message.
2. **Given** a user submits a signup form with an email that is already registered, **When** the server rejects the request for that reason, **Then** the existing specific "email already registered" message continues to be shown (unchanged behavior).
3. **Given** a user completes the "forgot password" flow and submits a new password that the server rejects, **When** the rejection occurs, **Then** a message describing the actual password problem is shown, not the unrelated "invalid or expired code" message currently shown for every reset failure.

---

### User Story 3 - Confirm-password match feedback (Priority: P2)

A user typing into the "confirm password" field on signup sees, as they type, whether it currently matches the password they entered above — before they attempt to submit.

**Why this priority**: A smaller, standalone improvement to the same form — useful on its own even if delivered separately from Stories 1-2, but lower priority since a mismatch is already caught at submit time today; this only makes the feedback appear earlier.

**Independent Test**: Type a password, then type a non-matching confirmation, and confirm a mismatch indicator appears live; then correct it to match and confirm the indicator updates to a match state, all without submitting.

**Acceptance Scenarios**:

1. **Given** the user has typed a password and started typing into "confirm password", **When** the two fields differ, **Then** a mismatch indicator is shown.
2. **Given** a mismatch indicator is showing, **When** the user edits either field so the two values become equal, **Then** the indicator updates to a match state immediately.
3. **Given** the confirm-password field is empty, **When** the user has not yet typed anything into it, **Then** neither the match nor mismatch indicator is shown.

### Edge Cases

- A password satisfies all 5 client-side rules the instant a qualifying character is typed for the last unmet rule — the checklist and strength indicator must update within the same render, not on a subsequent keystroke.
- The server rejects a password for a reason not anticipated by any specific mapped message (a Cognito error the app has not seen before) — the existing generic fallback message must still be shown rather than nothing or a crash.
- A user pastes a full password rather than typing it character by character — the checklist and strength indicator must still reflect the pasted value immediately.
- The show/hide password toggle is used while a live requirements checklist is showing — checklist state must be based on the actual value, unaffected by whether the value is currently masked or visible on screen.
- On the password-reset ("forgot password") form, the new-password field's server-rejection handling must not regress the existing valid-code-but-weak-password vs. actually-invalid-code distinction: an invalid/expired code must still show the code-specific message, not the password-specific one.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The signup form and the password-reset form's new-password field MUST each display, once the user begins typing a password, a live checklist of every password requirement enforced by the server: minimum length, at least one uppercase letter, at least one lowercase letter, at least one number, and at least one special character.
- **FR-002**: Each requirement in the checklist MUST independently reflect, on every change to the password value, whether it is currently met or not — with no need to submit the form or move focus away from the field.
- **FR-003**: The signup form and the password-reset form MUST each display an overall password strength indicator, derived from how many requirements are currently met, that updates live alongside the checklist.
- **FR-004**: The signup submit action MUST remain disabled (or otherwise prevented) until every password requirement is met and the confirm-password field matches the password field. The password-reset form's submit action MUST remain disabled (or otherwise prevented) until every password requirement is met for the new password.
- **FR-005**: When the server rejects a signup because the submitted password fails its policy, the form MUST show a message specific to that failure, distinct from the generic fallback error and distinct from the "email already registered" message.
- **FR-006**: The existing "email already registered" specific error message MUST continue to be shown for that failure case, unaffected by the new password-error handling added alongside it.
- **FR-007**: When the server rejects a signup or password-reset submission for any reason the application does not have a specific mapped message for, the generic fallback error message MUST still be shown.
- **FR-008**: The password-reset ("forgot password") form's new-password submission MUST show a message specific to a password-policy rejection when that is the actual failure reason, instead of the unrelated invalid-code message it shows today for every failure.
- **FR-009**: The password-reset form's new-password submission MUST continue to show the invalid/expired-code message when the failure is actually due to the code, not the password.
- **FR-010**: The signup form's confirm-password field MUST show a live indicator of whether its current value matches the password field, once the user has entered a non-empty value into it, updating on every change to either field.
- **FR-011**: All new user-facing copy (requirement labels, strength levels, specific error messages) MUST be delivered through the application's existing i18n layer, translated for every supported locale, not hardcoded in one language.
- **FR-012**: Every password entry field on the signup and password-reset forms MUST offer a visible control to reveal the typed password as plain text and to re-mask it, without disrupting the field's existing autofill behavior.

### Key Entities

- **Password requirement**: A single rule the server enforces on a password (e.g. "contains a number"), with a label and a current met/unmet status derived from the in-progress password value.
- **Password strength level**: A derived, discrete rating (e.g. weak/fair/good/strong) computed from how many requirements are currently met.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the password requirements actually enforced by the server are shown and live-tracked on both the signup form and the password-reset form — no requirement is hidden or represented only as a generic length hint on either form.
- **SC-002**: Users attempting to submit a password that already satisfies every displayed requirement are never blocked from submitting by the client-side check, on either form.
- **SC-003**: When a signup is rejected due to the password itself, the message shown names the password as the problem — it is never the generic "something went wrong" text.
- **SC-004**: When a password-reset submission fails due to an invalid/expired code, the message shown continues to describe the code, not the password, 100% of the time.
- **SC-005**: Zero regressions in the existing "email already registered" signup error path.

## Assumptions

- Only the signup form and the "forgot password" reset form are in scope, matching the plan item's stated scope (`SignupScreen.tsx`, `EmailLoginScreen.tsx`, `PasswordField.tsx`); both get the full live checklist/strength-meter treatment (User Story 1), not just signup. Login (existing-password entry, not creation) is unaffected since no policy checklist applies there.
- The password policy to display (minimum 8 characters, uppercase, lowercase, number, special character) is the one actually configured on the Cognito user pool, confirmed directly against the dev environment before this spec was written; if the policy is ever changed server-side, the displayed checklist must be updated to match rather than silently drifting out of sync — but keeping them in sync automatically (e.g. fetching the policy at runtime) is out of scope for this fix.
- "Password appears in a known data breach" is a real Cognito rejection category (surfaced via `InvalidPasswordException` when triggered), but the environment checked does not currently have the Cognito setting enabled that would produce it (compromised-credentials / advanced security checks are off). The specific messaging for this case is still implemented so it degrades gracefully to something specific rather than generic if that setting is ever turned on, but end-to-end verification of this exact scenario is not possible in the current environment.
- Password strength here is a simple derived count of the same 5 server-enforced requirements (not a separate, more sophisticated entropy-based strength algorithm) — matching the design reference exactly, since a more sophisticated model is not required by the plan item and would be a speculative addition.
- This is a web-only fix. The mobile app has no equivalent signup/reset screen today, so it is unaffected.

# Research: Signup Password Validation UX

## Decision: Password policy source of truth

**Decision**: Hardcode the 5 client-side rules (min 8 chars, uppercase, lowercase, number, special
character) as a static list in web code, matching the Cognito dev pool's actual `PasswordPolicy`
(confirmed via `aws cognito-idp describe-user-pool` before this spec was written).

**Rationale**: Fetching the live policy from Cognito at runtime would require a new backend
endpoint or a client-side Cognito API call solely to read configuration that changes essentially
never — a disproportionate amount of new surface for a plan item scoped as a UX fix, and out of
step with Principle IV (No Speculative Code). A hardcoded list matching the confirmed policy is
correct today and no worse than the status quo (the current `password.length < 8` check is
already hardcoded).

**Alternatives considered**: Runtime policy fetch (rejected — disproportionate scope, no plan item
calls for a backend change); reading the policy from an env var injected at build time (rejected —
policy is identical across dev/stg/prod today per `aws-infra`, so a build-time variable would add
indirection with no behavioral benefit; revisit only if the policies ever diverge per stage).

## Decision: Where the rule/strength-computation logic lives

**Decision**: A new pure module `web/src/auth/passwordPolicy.ts`, not `shared/src/`.

**Rationale**: Constitution Principle I reserves `shared/` for cross-package concerns consumed by
both `web/` and `mobile/`. Per this spec's Assumptions, this fix is web-only — the mobile app has
no signup/reset screen today (custom auth UI was scoped web-only in Item 17/18). Adding this
logic to `shared/` would be a speculative cross-package abstraction with a single real consumer,
which Principle IV prohibits. If mobile later grows its own signup screen, promoting this module to
`shared/` at that time is straightforward (pure functions, no React/DOM dependency).

**Alternatives considered**: `shared/src/passwordPolicy.ts` (rejected per above); inlining the rule
list directly in each component (rejected — the same 5 rules are needed in both `SignupScreen.tsx`
and `EmailLoginScreen.tsx`'s reset form, so a shared web-local module avoids duplicating the rule
list and its test coverage).

## Decision: New `PasswordRequirements` component vs. folding into `PasswordField`

**Decision**: A new component, `web/src/auth/PasswordRequirements.tsx`, rendered as a sibling
under the relevant `PasswordField`, not merged into `PasswordField` itself.

**Rationale**: `PasswordField` is reused for the login password field and the reset flow's code
field is a different input entirely — neither wants a requirements checklist. Keeping the
checklist as a separate, opt-in component (rendered only where `SignupScreen.tsx` and the reset
form's `newPassword` field call for it) avoids adding a rarely-used prop branch to a component that
three unrelated call sites already share, and keeps `PasswordField` focused on being a password
input, not a password-creation widget.

**Alternatives considered**: A `showRequirements` boolean prop on `PasswordField` (rejected — would
force every `PasswordField` call site to reason about a prop it doesn't use, and mixes two
concerns — masked-input behavior and policy display — in one component).

## Decision: Show/hide toggle placement and interaction with the Chrome autofill workaround

**Decision**: Add the eye-icon show/hide toggle directly inside `PasswordField.tsx`, as a `revealed`
boolean that toggles a CSS class controlling `-webkit-text-security` visibility — independent of
the existing `masked` state's `key`-based element-replacement mechanism. The toggle never causes
the underlying `<input>` node to unmount/remount.

**Rationale**: `PasswordField.tsx`'s existing masking mechanism (see its inline comments) exists
specifically because Chrome's password manager permanently flags any element that was ever
`type="password"`, and unmounting such a field while the user is mid-flow gets misread as a
successful-login signal, triggering an unwanted save-password prompt. The existing `masked` state
already solves this for the plain-vs-obscured transition by giving React a fresh, never-flagged
`type="text"` element the instant typing starts. A show/hide toggle must not reintroduce that risk:
toggling `revealed` only adds/removes the CSS class that visually obscures the (already
`type="text"`, already-masked) element — it never changes `type` and never remounts the node. Before
the user's first keystroke (still a real `type="password"` element, autofill not yet triggered),
toggling `revealed` can safely flip that same node's `type` between `password`/`text` in place
(still no unmount — same element, same key), since the field was already flagged as a password
field the moment it rendered; flipping its `type` attribute doesn't add or remove that flag.

**Alternatives considered**: A separate always-masked-text-then-reveal `type` swap on every
keystroke (rejected — conflates the reveal toggle with the existing masked/plain transition,
risking a regression of the autofill-prompt fix); showing the toggle only after the masked state is
active (rejected — the design shows the eye icon from the first render, and doing so is safe per
the above).

## Decision: Mapping `InvalidPasswordException` to a specific message

**Decision**: Catch `err.name === 'InvalidPasswordException'` in both `SignupScreen.tsx`'s
`handleSubmit` and `EmailLoginScreen.tsx`'s `handleForgotConfirm`, and show one specific,
translated message distinct from the generic fallback and (on signup) distinct from the
"email already registered" message. The message covers both a plain policy violation and a
known-breached-password rejection in one wording, rather than two separate messages keyed off the
exception's free-text `message` string.

**Rationale**: Cognito's `InvalidPasswordException` is the same exception name for a plain
policy-rule violation and for a compromised-credentials rejection; distinguishing them requires
parsing AWS's free-text exception message, which is not a documented, stable contract and cannot be
verified in the current environment (the dev pool's `AdvancedSecurityMode` is `OFF`, so the
breach-check path cannot be exercised end-to-end regardless). Since the client-side checklist
already prevents nearly all plain policy-rule violations from ever reaching the server, a real
`InvalidPasswordException` in production is more likely to be the breach case in practice — but
either way, one clear, specific message ("this password can't be used — it may not meet the
required rules or may have been found in a known breach; choose a different one") is honest about
both possibilities and is a strict improvement over today's fully generic fallback, without
building fragile message-string sniffing into the client.

**Alternatives considered**: Parsing `err.message` for known Cognito substrings to show the
design's two distinct texts verbatim (rejected — fragile, unverifiable in this environment, and
liable to silently stop matching if AWS ever changes wording); leaving `InvalidPasswordException`
unmapped (rejected — this is exactly the gap the plan item exists to close).

## Decision: Reset form's error-mapping bug fix

**Decision**: `EmailLoginScreen.tsx`'s `handleForgotConfirm` catch block currently maps every
error to `t.auth_error_code_invalid` unconditionally. Change it to check `err.name` first:
`InvalidPasswordException` → the new password-specific message; anything else (including
`CodeMismatchException`/`ExpiredCodeException`) → keep today's `auth_error_code_invalid` message,
preserving existing behavior for the actually-invalid-code case.

**Rationale**: This is the concrete bug named in the plan item's "Current state" — today a weak
new password on the reset form is misreported as an invalid code, which is actively confusing.
Defaulting anything not recognized as a password error to the existing code-invalid message
preserves today's (correct) behavior for that case rather than risking a regression by trying to
special-case every possible Cognito exception name.

## Decision: Strength-level colors

**Decision**: Reuse the existing `--s-accent` token for the strongest ("Forte") level (it already
resolves to the same teal used in the design reference) and the existing `--danger` token for the
weakest ("Fraca") level. The two intermediate levels ("Razoável", "Boa") use scoped literal hex
values (`#f97316` orange, `#eab308` yellow) local to the new strength-meter CSS rather than new
global design tokens.

**Rationale**: `--s-accent` and `--danger` already exist and already match the design's colors for
the strongest/weakest levels, so reusing them keeps the strength meter consistent with the rest of
the auth UI's theming (including light/dark mode, since both tokens are already defined for both).
The two middle levels have no existing token and are narrowly specific to this one 4-level scale;
promoting them to global tokens now would be speculative (Principle IV) since nothing else in the
app currently needs an "orange" or "yellow" semantic color.

**Alternatives considered**: Adding four brand-new tokens (rejected — over-engineering for a single
component's internal scale); using `--danger`/`--success` interpolation (rejected — more complex
than just declaring two literal colors, for no reuse benefit).

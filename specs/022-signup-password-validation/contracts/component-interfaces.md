# Component & Module Interfaces: Signup Password Validation UX

No REST/API contracts change — this feature is entirely client-side. The "contracts" below are the
new/changed TypeScript interfaces other code in `web/` depends on.

## `web/src/auth/passwordPolicy.ts` (new)

```ts
export type PasswordRuleKey = 'length' | 'uppercase' | 'lowercase' | 'number' | 'special';

export interface PasswordRule {
  key: PasswordRuleKey;
  met: boolean;
}

export interface PasswordStrength {
  level: 0 | 1 | 2 | 3;
}

export function evaluatePasswordRules(password: string): PasswordRule[];
export function computePasswordStrength(rules: PasswordRule[]): PasswordStrength | null;
export function isPasswordValid(password: string): boolean; // all rules met — replaces the current `password.length < 8` check
```

Pure, framework-free functions — no i18n, no React. Labels/colors are resolved by the component
layer (`PasswordRequirements.tsx`) from `rule.key` / `strength.level`, keeping this module
free of `useLocale()` so it stays trivially unit-testable.

## `web/src/auth/PasswordRequirements.tsx` (new)

```ts
interface PasswordRequirementsProps {
  password: string;
}
```

Renders the live rule checklist and strength bar for a `password` value. Internally calls
`evaluatePasswordRules`/`computePasswordStrength` and resolves labels via `useLocale()`. Renders
nothing when `password === ''` (matches the design's `showStrength`/`rules` empty-password
behavior). Stateless — no props for callbacks; purely a display component driven by the caller's
existing password state.

## `web/src/auth/PasswordField.tsx` (changed)

```ts
interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  // no new required props — the show/hide toggle is always rendered
}
```

No prop signature change. Internally gains a `revealed` boolean state and the eye-icon toggle
button; the masked/plain `key`-switch mechanism is unchanged. Every existing call site (login,
signup password + confirm, reset new-password) gets the toggle automatically.

## `web/src/auth/screens/SignupScreen.tsx` (changed)

- Renders `<PasswordRequirements password={password} />` under the password `PasswordField`.
- Renders a live match/mismatch indicator under the confirm-password `PasswordField`, derived
  inline from `confirmPassword !== '' && confirmPassword === password` /
  `confirmPassword !== '' && confirmPassword !== password` (no new component — single call site).
- `validate()`'s password branch changes from `password.length < 8` to
  `!isPasswordValid(password)`, both mapped to `t.auth_error_password_short` (label reused —
  the checklist is the primary feedback mechanism now; this string remains the client-side
  fallback for the disabled-submit case, e.g. programmatic form submission bypassing the button).
- `handleSubmit`'s catch block gains an `InvalidPasswordException` branch mapped to a new
  `t.auth_error_password_rejected` message, checked before falling through to
  `t.auth_error_generic`. The existing `UsernameExistsException` branch is unchanged.

## `web/src/auth/screens/EmailLoginScreen.tsx` (changed)

- `forgot-confirm` mode renders `<PasswordRequirements password={newPassword} />` under the
  new-password `PasswordField`.
- `handleForgotConfirm`'s catch block branches on `err.name`: `InvalidPasswordException` →
  `t.auth_error_password_rejected` (new, shared with signup); anything else → today's
  `t.auth_error_code_invalid` (unchanged default), preserving the existing invalid-code message
  for that case.

## `shared/src/i18n/types.ts` / `shared/src/i18n/locales/*.ts` (changed, additive only)

New `UIText` keys (added to `types.ts` and all 10 locale files):

- `auth_password_rule_length`, `auth_password_rule_uppercase`, `auth_password_rule_lowercase`,
  `auth_password_rule_number`, `auth_password_rule_special`
- `auth_password_strength_weak`, `auth_password_strength_fair`, `auth_password_strength_good`,
  `auth_password_strength_strong`
- `auth_error_password_rejected`
- `auth_password_match`, `auth_password_mismatch`
- `auth_password_show`, `auth_password_hide` (toggle button `aria-label`/`title`)

No existing key is removed or renamed. `auth_error_password_short` and `auth_error_code_invalid`
are reused as-is per the interfaces above.

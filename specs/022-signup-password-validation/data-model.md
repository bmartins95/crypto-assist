# Data Model: Signup Password Validation UX

No persisted data changes — no database, backend model, or API contract is touched by this
feature. The entities below are transient, in-memory shapes computed client-side from the
in-progress password value; they exist only in `web/`.

## PasswordRule

Represents one server-enforced password requirement and whether the current in-progress value
satisfies it.

| Field | Type | Notes |
|-------|------|-------|
| `key` | `'length' \| 'uppercase' \| 'lowercase' \| 'number' \| 'special'` | Stable identifier, also used as the i18n key suffix for the rule's label. |
| `label` | `string` | Translated via `t.auth_password_rule_*`, not stored — derived at render time from `key`. |
| `met` | `boolean` | Result of evaluating the rule's test function against the current password string. |

Derived, not persisted: recomputed on every keystroke from the password value via
`evaluatePasswordRules(password: string): PasswordRule[]` in `web/src/auth/passwordPolicy.ts`.

## PasswordStrength

Represents the overall strength rating derived from how many `PasswordRule`s are currently met.

| Field | Type | Notes |
|-------|------|-------|
| `level` | `0 \| 1 \| 2 \| 3` | 0 = Fraca/Weak, 1 = Razoável/Fair, 2 = Boa/Good, 3 = Forte/Strong. `-1`/empty-password state is represented separately (no bars filled, no label) rather than as a fifth level. |
| `label` | `string` | Translated via `t.auth_password_strength_*`. |
| `color` | `string` | CSS color for the label text and filled strength-bar segments at or below `level`. |

Derived via `computePasswordStrength(rules: PasswordRule[]): PasswordStrength \| null` (`null` when
the password is empty, matching the design's "no strength shown yet" state).

## No changes to existing entities

- `Op`, `NewOp`, and all other `shared/src/types.ts` entities are untouched.
- No new backend model, migration, or endpoint.
- No new `UIText` entity shape — only additive string keys on the existing `UIText` interface
  (see `contracts/component-interfaces.md` for the exact key list).

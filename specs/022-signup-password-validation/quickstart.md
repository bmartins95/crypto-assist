# Quickstart: Verifying Signup Password Validation UX

## Automated

```bash
cd web && npm test
cd web && npm run coverage   # confirm ≥90% on changed files
cd backend && pytest         # unaffected, but part of the standard pre-PR gate
```

## Manual smoke test (`cd web && npm run dev`)

1. Go to `/signup`. Start typing a password one character at a time (e.g. `p`, `pa`, `pas`...).
   - Confirm a live checklist of 5 requirements appears the moment you type the first character.
   - Confirm each requirement (length, uppercase, lowercase, number, special char) flips to "met"
     the instant it becomes true — no need to click away or submit.
   - Confirm the strength bar/label updates alongside the checklist (Fraca → Razoável → Boa →
     Forte as more rules pass).
2. Click the eye icon on the password field — confirm the typed value becomes visible as plain
   text, then click again to re-mask it. Confirm this does not trigger a Chrome
   "save password?" prompt (open DevTools > Application > note no unexpected navigation/remount).
3. Type a password that satisfies every rule, then type a different value into "Confirmar senha" —
   confirm a mismatch indicator appears live. Correct it to match — confirm it switches to a match
   indicator, still live (no submit needed).
4. Confirm the submit button stays disabled until all 5 rules are met and the confirm field
   matches; then becomes enabled.
5. Submit a signup with an email that's already registered — confirm the existing
   "email already registered" message still appears (regression check).
6. Go to `/login/email` → "Esqueci minha senha" → request a code → enter the code and a new
   password. Confirm the same live checklist/strength meter appears under the new-password field.
7. Enter an invalid/expired reset code with an otherwise-valid new password — confirm the
   existing "invalid or expired code" message still appears (regression check for FR-009).

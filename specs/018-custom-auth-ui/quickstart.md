# Quickstart: Custom Auth UI

Manual verification steps once the implementation is in place. Run against local dev (`cd web && npm run dev`) with `web/.env.local` pointing at the dev Cognito pool.

## 1. Hero landing (unauthenticated)

1. Sign out if signed in. Visit `/`.
2. Confirm the hero renders: topbar with logo + "Entrar", headline, product preview panel, three feature cards.
3. Click "Começar agora" → lands on `/login`. Go back, click "Já tenho conta" → lands on `/login/email`.

## 2. Email/password signup

1. From `/login/email`, click "Criar conta" → `/signup`.
2. Submit name/email/password for a fresh test address.
3. Confirm the confirmation-code step appears; enter the code emailed by Cognito.
4. Confirm sign-in succeeds and the app loads.

## 3. Email/password login + forgot password

1. Sign out. Visit `/login/email`, sign in with the account created above — confirm success.
2. Sign out. Attempt login with a wrong password — confirm a specific on-screen error, form stays on screen with email preserved.
3. Click "Esqueci a senha" → request a reset code → enter code + new password → sign in with the new password.

## 4. Social sign-in

1. Visit `/login`, click "Continuar com Google" (or Facebook).
2. Confirm the provider's own consent screen appears.
3. After consenting, confirm the browser returns to `/auth/callback` showing the branded "Autenticando" loading screen (never blank), then lands in the app.
4. Repeat, denying consent — confirm a graceful return to `/login` with a message, not a broken/blank page.

## 5. Already-authenticated redirects

1. While signed in, visit `/`, `/login`, `/signup` directly — confirm each redirects straight into the app.

## 6. Post-auth bootstrap gate

1. Sign in fresh (clear cache/localStorage first so the first fetch is genuinely cold).
2. Confirm the branded "Preparando sua carteira" loading screen appears with rotating messages before the app renders.
3. Simulate a stuck fetch (e.g. throttle network to offline mid-load in DevTools) — confirm the error+retry state appears within ~30s, and "Tentar novamente" retries the fetch.

## 7. Terms/Privacy links

1. On `/login/email` or `/signup`, click "Termos" → `/terms` renders. Click "Política de Privacidade" → `/privacy` renders (unchanged).

## 8. Accessibility / reduced motion

1. Enable OS-level "reduce motion" and reload any auth screen — confirm animations are skipped/instant.
2. Tab through each form — confirm every input has a visible label and logical tab order.

## 9. Automated checks

```bash
cd web && npm test
cd web && npm run coverage
cd backend && pytest   # confirm untouched/still green
```

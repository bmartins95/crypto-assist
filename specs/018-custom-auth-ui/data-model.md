# Data Model: Custom Auth UI

This feature introduces no database tables, backend models, or `shared/src/types.ts` entities — it is a client-side auth UI layered on the existing Cognito user pool. The entities below are UI/client-state concepts only, used to drive `tasks.md` and component design.

## Account (client-side view)

Represents what the UI knows about the signed-in (or signing-up) user, derived entirely from Amplify's session/user objects — not a new stored type.

| Field | Source | Notes |
|---|---|---|
| `email` | Amplify `fetchUserAttributes()` / ID token claim | Replaces today's `getEmailFromIdToken(idToken)` helper usage in `Sidebar.tsx`. |
| `name` | Amplify `fetchUserAttributes()` | Collected at signup (FR-002); not currently displayed anywhere in the app — display is out of scope for this item (see spec.md Assumptions). |
| `emailVerified` | Cognito attribute, implicit | Gates whether sign-in succeeds post-signup; surfaced only as "enter your confirmation code" UX, not read directly by the frontend. |

## Session (client-side view)

The authenticated state Amplify manages internally (tokens, expiry, refresh) — the UI only ever asks "is there a valid session" via `fetchAuthSession()`, mirroring today's synchronous `getSession()` call, now async.

| Field | Notes |
|---|---|
| `isAuthenticated` | `Boolean(session.tokens)` after `fetchAuthSession()` resolves. Used in `RequireAuth`/route `beforeLoad` and in the landing/login/signup routes' "already authenticated → redirect into app" guard (FR-007). |

## Auth Screen Flow State

The enum of steps a visitor/user can be in, driving which screen/step renders. Not a persisted type — local component state within the relevant screen.

| State | Screen | Entered from | Exits to |
|---|---|---|---|
| `hero` | `HeroPage` (`/`) | Unauthenticated visit to `/` | `login` or `login-email` |
| `login` | `LoginScreen` (`/login`) | Hero primary CTA, direct visit | `login-email`, provider redirect, `signup` |
| `login-email` | `EmailLoginScreen` (`/login/email`) | Hero secondary CTA, `LoginScreen`'s e-mail option | app (on success), `signup`, `forgot-password` |
| `forgot-password` | Within `EmailLoginScreen` | "Esqueci a senha" link | `login-email` (after reset completes) |
| `signup` | `SignupScreen` (`/signup`) | `EmailLoginScreen`'s "Criar conta" link | `confirm-code`, `login-email` |
| `confirm-code` | Within `SignupScreen` | Successful `signUp()` call | app (on success) |
| `oauth-callback` | `AuthCallback` (`/auth/callback`) | Provider redirect return | app (on success), `login` (on failure/cancel) |
| `bootstrap` | `AppBootstrapGate` | Any successful authentication | app (on success), error+retry (on timeout) |

## Loading/Success/Error presentational state

Shared by `LoadingState`/`SuccessState` across the `oauth-callback` and `bootstrap` flow states — not a domain entity, just the props shape reused by both call sites (`title`, `messages: string[]`, and, for `AppBootstrapGate` only, an `onRetry` callback for the timeout case).

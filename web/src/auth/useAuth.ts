import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  resendSignUpCode as amplifyResendSignUpCode,
  resetPassword as amplifyResetPassword,
  confirmResetPassword as amplifyConfirmResetPassword,
  signInWithRedirect as amplifySignInWithRedirect,
  signOut as amplifySignOut,
  fetchAuthSession,
  fetchUserAttributes as amplifyFetchUserAttributes,
  getCurrentUser as amplifyGetCurrentUser,
} from 'aws-amplify/auth';

export type SocialProvider = 'Google' | 'Facebook';

export type SignInOutcome = 'done' | 'confirm-signup';

export async function signIn(email: string, password: string): Promise<SignInOutcome> {
  // Amplify surfaces an unconfirmed user either as a CONFIRM_SIGN_UP next step or
  // as a thrown UserNotConfirmedException depending on flow — normalize both so
  // callers can route the user to the confirmation-code step instead of treating
  // the sign-in as a silent no-op.
  try {
    const result = await amplifySignIn({ username: email, password });
    if (result.nextStep.signInStep === 'CONFIRM_SIGN_UP') return 'confirm-signup';
    if (result.isSignedIn) return 'done';
    throw new Error(`Unsupported sign-in step: ${result.nextStep.signInStep}`);
  } catch (err) {
    if (err instanceof Error && err.name === 'UserNotConfirmedException') return 'confirm-signup';
    throw err;
  }
}

export async function signUp(name: string, email: string, password: string): Promise<void> {
  await amplifySignUp({
    username: email,
    password,
    options: { userAttributes: { email, name } },
  });
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  await amplifyConfirmSignUp({ username: email, confirmationCode: code });
}

export async function resendSignUpCode(email: string): Promise<void> {
  await amplifyResendSignUpCode({ username: email });
}

export async function resetPassword(email: string): Promise<void> {
  await amplifyResetPassword({ username: email });
}

export async function confirmResetPassword(email: string, code: string, newPassword: string): Promise<void> {
  await amplifyConfirmResetPassword({ username: email, confirmationCode: code, newPassword });
}

export async function signInWithRedirect(provider: SocialProvider): Promise<void> {
  await amplifySignInWithRedirect({ provider });
}

export type SignOutOutcome = 'redirecting' | 'done';

export async function signOut(): Promise<SignOutOutcome> {
  // Amplify only hard-redirects through Cognito's hosted logout endpoint for
  // sessions created via signInWithRedirect. On 'done' the caller must navigate
  // itself; on 'redirecting' it must NOT, or it races the hard redirect and
  // double-loads the page. signInDetails is how the session was CREATED — Amplify
  // populates it for native (email/password) sign-ins only, never for hosted-UI
  // redirects. The id token's `identities` claim cannot distinguish this: accounts
  // linked across providers carry it even on email/password sessions.
  const currentUser = await amplifyGetCurrentUser().catch(() => null);
  await amplifySignOut();
  if (!currentUser) return 'done';
  return currentUser.signInDetails?.authFlowType ? 'done' : 'redirecting';
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await fetchAuthSession();
  return Boolean(session.tokens);
}

export async function getAccessToken(): Promise<string> {
  const session = await fetchAuthSession();
  const token = session.tokens?.accessToken?.toString();
  if (!token) throw new Error('Session not found. Please log in again.');
  return token;
}

export async function fetchUserAttributes(): Promise<{ email: string; name: string }> {
  const attrs = await amplifyFetchUserAttributes();
  return { email: attrs.email ?? '', name: attrs.name ?? '' };
}

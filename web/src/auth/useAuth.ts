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
} from 'aws-amplify/auth';

export type SocialProvider = 'Google' | 'Facebook';

export async function signIn(email: string, password: string): Promise<void> {
  await amplifySignIn({ username: email, password });
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

export async function signOut(): Promise<void> {
  await amplifySignOut();
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

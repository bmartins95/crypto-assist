import { describe, it, expect, vi, beforeEach } from 'vitest';

const amplifyAuth = vi.hoisted(() => ({
  signIn: vi.fn(async () => undefined),
  signUp: vi.fn(async () => undefined),
  confirmSignUp: vi.fn(async () => undefined),
  resendSignUpCode: vi.fn(async () => undefined),
  resetPassword: vi.fn(async () => undefined),
  confirmResetPassword: vi.fn(async () => undefined),
  signInWithRedirect: vi.fn(async () => undefined),
  signOut: vi.fn(async () => undefined),
  fetchAuthSession: vi.fn(async () => ({ tokens: undefined })),
  fetchUserAttributes: vi.fn(async () => ({})),
}));

vi.mock('aws-amplify/auth', () => amplifyAuth);

import {
  signIn,
  signUp,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
  signInWithRedirect,
  signOut,
  isAuthenticated,
  getAccessToken,
  fetchUserAttributes,
} from './useAuth';

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signIn forwards email/password to Amplify as username/password', async () => {
    await signIn('user@example.com', 'pw');
    expect(amplifyAuth.signIn).toHaveBeenCalledWith({ username: 'user@example.com', password: 'pw' });
  });

  it('signUp forwards name/email/password with email/name as user attributes', async () => {
    await signUp('Bruno', 'user@example.com', 'pw');
    expect(amplifyAuth.signUp).toHaveBeenCalledWith({
      username: 'user@example.com',
      password: 'pw',
      options: { userAttributes: { email: 'user@example.com', name: 'Bruno' } },
    });
  });

  it('confirmSignUp forwards email/code', async () => {
    await confirmSignUp('user@example.com', '123456');
    expect(amplifyAuth.confirmSignUp).toHaveBeenCalledWith({ username: 'user@example.com', confirmationCode: '123456' });
  });

  it('resendSignUpCode forwards email', async () => {
    await resendSignUpCode('user@example.com');
    expect(amplifyAuth.resendSignUpCode).toHaveBeenCalledWith({ username: 'user@example.com' });
  });

  it('resetPassword forwards email', async () => {
    await resetPassword('user@example.com');
    expect(amplifyAuth.resetPassword).toHaveBeenCalledWith({ username: 'user@example.com' });
  });

  it('confirmResetPassword forwards email/code/newPassword', async () => {
    await confirmResetPassword('user@example.com', '123456', 'newpw');
    expect(amplifyAuth.confirmResetPassword).toHaveBeenCalledWith({
      username: 'user@example.com',
      confirmationCode: '123456',
      newPassword: 'newpw',
    });
  });

  it('signInWithRedirect forwards the provider', async () => {
    await signInWithRedirect('Google');
    expect(amplifyAuth.signInWithRedirect).toHaveBeenCalledWith({ provider: 'Google' });
  });

  it('signOut calls Amplify signOut', async () => {
    await signOut();
    expect(amplifyAuth.signOut).toHaveBeenCalledTimes(1);
  });

  it('isAuthenticated returns false when no session tokens exist', async () => {
    amplifyAuth.fetchAuthSession.mockResolvedValueOnce({ tokens: undefined });
    expect(await isAuthenticated()).toBe(false);
  });

  it('isAuthenticated returns true when session tokens exist', async () => {
    amplifyAuth.fetchAuthSession.mockResolvedValueOnce({ tokens: { accessToken: 'x' } });
    expect(await isAuthenticated()).toBe(true);
  });

  it('getAccessToken returns the access token string when present', async () => {
    amplifyAuth.fetchAuthSession.mockResolvedValueOnce({
      tokens: { accessToken: { toString: () => 'jwt-token' } },
    });
    expect(await getAccessToken()).toBe('jwt-token');
  });

  it('getAccessToken throws when no session exists', async () => {
    amplifyAuth.fetchAuthSession.mockResolvedValueOnce({ tokens: undefined });
    await expect(getAccessToken()).rejects.toThrow('Session not found. Please log in again.');
  });

  it('fetchUserAttributes returns email/name, defaulting to empty strings', async () => {
    amplifyAuth.fetchUserAttributes.mockResolvedValueOnce({ email: 'user@example.com', name: 'Bruno' });
    expect(await fetchUserAttributes()).toEqual({ email: 'user@example.com', name: 'Bruno' });
  });

  it('fetchUserAttributes defaults missing attributes to empty strings', async () => {
    amplifyAuth.fetchUserAttributes.mockResolvedValueOnce({});
    expect(await fetchUserAttributes()).toEqual({ email: '', name: '' });
  });
});

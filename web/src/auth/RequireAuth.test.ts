import { describe, it, expect, vi, beforeEach } from 'vitest';

const isAuthenticatedMock = vi.fn();
vi.mock('./useAuth', () => ({ isAuthenticated: () => isAuthenticatedMock() }));

vi.mock('@tanstack/react-router', () => ({
  redirect: (opts: { to: string }) => Object.assign(new Error('redirect'), opts),
}));

import { requireAuth, redirectIfAuthenticated } from './RequireAuth';

describe('RequireAuth', () => {
  beforeEach(() => {
    isAuthenticatedMock.mockReset();
  });

  it('requireAuth resolves without throwing when authenticated', async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    await expect(requireAuth()).resolves.toBeUndefined();
  });

  it('requireAuth throws a redirect to /login when unauthenticated', async () => {
    isAuthenticatedMock.mockResolvedValue(false);
    await expect(requireAuth()).rejects.toMatchObject({ to: '/login' });
  });

  it('redirectIfAuthenticated resolves without throwing when unauthenticated', async () => {
    isAuthenticatedMock.mockResolvedValue(false);
    await expect(redirectIfAuthenticated()).resolves.toBeUndefined();
  });

  it('redirectIfAuthenticated throws a redirect to /wallet when authenticated', async () => {
    isAuthenticatedMock.mockResolvedValue(true);
    await expect(redirectIfAuthenticated()).rejects.toMatchObject({ to: '/wallet' });
  });
});

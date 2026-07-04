import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthClient from './AuthClient';
import { LocaleProvider } from '@/context/LocaleContext';

vi.mock('@/lib/cognito/client', () => ({
  buildAuthUrl: vi.fn(async () => 'https://auth.example.com'),
}));

vi.mock('@/lib/api/client', () => ({
  api: { warmupDb: vi.fn(() => Promise.resolve(new Response())) },
}));

function renderAuth() {
  render(
    <LocaleProvider>
      <AuthClient />
    </LocaleProvider>
  );
}

describe('AuthClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders the Google and email sign-in buttons', () => {
    renderAuth();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('fires the database warm-up ping once on mount', async () => {
    const { api } = await import('@/lib/api/client');
    renderAuth();
    await waitFor(() => expect(api.warmupDb).toHaveBeenCalledTimes(1));
  });

  it('builds the Google auth URL when the Google button is clicked', async () => {
    const { buildAuthUrl } = await import('@/lib/cognito/client');
    renderAuth();
    fireEvent.click(screen.getAllByRole('button')[0]);
    await waitFor(() => expect(buildAuthUrl).toHaveBeenCalledWith('Google'));
  });

  it('builds the email auth URL when the email button is clicked', async () => {
    const { buildAuthUrl } = await import('@/lib/cognito/client');
    renderAuth();
    fireEvent.click(screen.getAllByRole('button')[1]);
    await waitFor(() => expect(buildAuthUrl).toHaveBeenCalledWith());
  });

  it('still renders when the warm-up ping fails', async () => {
    const { api } = await import('@/lib/api/client');
    vi.mocked(api.warmupDb).mockRejectedValueOnce(new Error('db asleep'));
    renderAuth();
    await waitFor(() => expect(api.warmupDb).toHaveBeenCalledTimes(1));
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});

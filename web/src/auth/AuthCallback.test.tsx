import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import AuthCallback from './AuthCallback';
import { LocaleProvider } from '@/context/LocaleContext';

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

let hubCallback: ((data: { payload: { event: string } }) => void) | null = null;
const hubListenMock = vi.fn((_channel: string, cb: (data: { payload: { event: string } }) => void) => {
  hubCallback = cb;
  return vi.fn();
});
vi.mock('aws-amplify/utils', () => ({
  Hub: { listen: (channel: string, cb: (data: { payload: { event: string } }) => void) => hubListenMock(channel, cb) },
}));

vi.mock('./useAuth', () => ({
  isAuthenticated: vi.fn(() => Promise.resolve(false)),
}));

function renderCallback() {
  render(
    <LocaleProvider>
      <AuthCallback />
    </LocaleProvider>
  );
}

describe('AuthCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hubCallback = null;
  });

  it('shows the branded loading state while the exchange is in progress', () => {
    renderCallback();
    expect(screen.getByText(/autenticando/i)).toBeTruthy();
  });

  it('navigates into the app when the redirect sign-in succeeds', () => {
    renderCallback();
    act(() => hubCallback?.({ payload: { event: 'signInWithRedirect' } }));
    expect(navigateMock).toHaveBeenCalledWith({ to: '/wallet' });
  });

  it('shows a failure message and a way back to login when the redirect fails', () => {
    renderCallback();
    act(() => hubCallback?.({ payload: { event: 'signInWithRedirect_failure' } }));
    expect(screen.getByText(/falha na autenticação/i)).toBeTruthy();
    expect(screen.getByText(/voltar para o login/i)).toBeTruthy();
  });

  it('navigates into the app immediately if already authenticated on mount', async () => {
    const { isAuthenticated } = await import('./useAuth');
    vi.mocked(isAuthenticated).mockResolvedValueOnce(true);
    renderCallback();
    await vi.waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/wallet' }));
  });
});

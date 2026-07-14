import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import AppBootstrapGate, { WALLET_ENTERED_KEY } from './AppBootstrapGate';
import { LocaleProvider } from '@/context/LocaleContext';
import { useBootstrapStatus } from './BootstrapStatusContext';

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('./useAuth', () => ({
  signOut: vi.fn(() => Promise.resolve('done')),
}));

function renderGate(run: () => Promise<void>) {
  render(
    <LocaleProvider>
      <AppBootstrapGate run={run}>
        <div data-testid="app-content">app</div>
      </AppBootstrapGate>
    </LocaleProvider>
  );
}

function StatusReadout() {
  const status = useBootstrapStatus();
  return <div data-testid="app-content">status:{status}</div>;
}

function renderGateWithStatus(run: () => Promise<void>) {
  render(
    <LocaleProvider>
      <AppBootstrapGate run={run}>
        <StatusReadout />
      </AppBootstrapGate>
    </LocaleProvider>
  );
}

describe('AppBootstrapGate', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the branded loading state while the run promise is pending', () => {
    let resolveRun: () => void = () => undefined;
    const run = vi.fn(() => new Promise<void>(resolve => { resolveRun = resolve; }));
    renderGate(run);
    expect(screen.getByText(/preparando sua carteira/i)).toBeTruthy();
    expect(screen.queryByTestId('app-content')).toBeNull();
    resolveRun();
  });

  it('renders children once the run promise resolves', async () => {
    const run = vi.fn(() => Promise.resolve());
    renderGate(run);
    expect(await screen.findByTestId('app-content')).toBeTruthy();
  });

  it('shows the error state immediately if the run promise rejects', async () => {
    const run = vi.fn(() => Promise.reject(new Error('boom')));
    renderGate(run);
    expect(await screen.findByText(/não foi possível carregar/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^tentar novamente$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^sair$/i })).toBeTruthy();
  });

  it('shows an error state with retry when the timeout is reached', async () => {
    vi.useFakeTimers();
    const run = vi.fn(() => new Promise<void>(() => undefined));
    renderGate(run);
    await act(() => vi.advanceTimersByTimeAsync(30000));
    expect(screen.getByText(/não foi possível carregar/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^tentar novamente$/i })).toBeTruthy();
  });

  it('retries inline on the same error card — no bounce back to the loading screen', async () => {
    const run = vi.fn(() => Promise.reject(new Error('boom')));
    renderGate(run);
    await screen.findByText(/não foi possível carregar/i);

    let resolveRetry: () => void = () => undefined;
    run.mockImplementationOnce(() => new Promise<void>(resolve => { resolveRetry = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: /^tentar novamente$/i }));

    expect(screen.queryByText(/preparando sua carteira/i)).toBeNull();
    expect(await screen.findByRole('button', { name: /tentando/i })).toBeTruthy();

    resolveRetry();
    expect(await screen.findByTestId('app-content')).toBeTruthy();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('stays on the error card and resets the button after a failed retry', async () => {
    const run = vi.fn(() => Promise.reject(new Error('boom')));
    renderGate(run);
    await screen.findByText(/não foi possível carregar/i);

    fireEvent.click(screen.getByRole('button', { name: /^tentar novamente$/i }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: /^tentar novamente$/i })).toBeTruthy();
    expect(screen.getByText(/não foi possível carregar/i)).toBeTruthy();
  });

  it('signs out and navigates home when the exit button is clicked', async () => {
    const { signOut } = await import('./useAuth');
    const run = vi.fn(() => Promise.reject(new Error('boom')));
    renderGate(run);
    await screen.findByText(/não foi possível carregar/i);

    fireEvent.click(screen.getByRole('button', { name: /^sair$/i }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/' }));
  });

  it('does not navigate on exit when the sign-out is already redirecting (federated session)', async () => {
    const { signOut } = await import('./useAuth');
    vi.mocked(signOut).mockResolvedValueOnce('redirecting');
    const run = vi.fn(() => Promise.reject(new Error('boom')));
    renderGate(run);
    await screen.findByText(/não foi possível carregar/i);

    fireEvent.click(screen.getByRole('button', { name: /^sair$/i }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('still navigates home on exit if sign-out itself throws', async () => {
    const { signOut } = await import('./useAuth');
    vi.mocked(signOut).mockRejectedValueOnce(new Error('network'));
    const run = vi.fn(() => Promise.reject(new Error('boom')));
    renderGate(run);
    await screen.findByText(/não foi possível carregar/i);

    fireEvent.click(screen.getByRole('button', { name: /^sair$/i }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/' }));
  });

  describe('warm boot (a refresh in a tab that already showed the wallet once)', () => {
    it('sets the wallet:entered flag once bootstrap succeeds for the first time', async () => {
      expect(sessionStorage.getItem(WALLET_ENTERED_KEY)).toBeNull();
      const run = vi.fn(() => Promise.resolve());
      renderGate(run);
      await screen.findByTestId('app-content');
      expect(sessionStorage.getItem(WALLET_ENTERED_KEY)).toBe('1');
    });

    it('never shows the full-screen loader, rendering children immediately while bootstrap is still pending', () => {
      sessionStorage.setItem(WALLET_ENTERED_KEY, '1');
      const run = vi.fn(() => new Promise<void>(() => undefined));
      renderGateWithStatus(run);
      expect(screen.queryByText(/preparando sua carteira/i)).toBeNull();
      expect(screen.getByTestId('app-content')).toHaveTextContent('status:pending');
    });

    it('flips the shared status from pending to ready once bootstrap resolves, without ever unmounting children', async () => {
      sessionStorage.setItem(WALLET_ENTERED_KEY, '1');
      let resolveRun: () => void = () => undefined;
      const run = vi.fn(() => new Promise<void>(resolve => { resolveRun = resolve; }));
      renderGateWithStatus(run);
      expect(screen.getByTestId('app-content')).toHaveTextContent('status:pending');
      resolveRun();
      await waitFor(() => expect(screen.getByTestId('app-content')).toHaveTextContent('status:ready'));
    });

    it('still falls back to the full-screen error card on a genuine failure, even on warm boot', async () => {
      sessionStorage.setItem(WALLET_ENTERED_KEY, '1');
      const run = vi.fn(() => Promise.reject(new Error('boom')));
      renderGate(run);
      expect(await screen.findByText(/não foi possível carregar/i)).toBeTruthy();
      expect(screen.queryByTestId('app-content')).toBeNull();
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import AppBootstrapGate from './AppBootstrapGate';
import { LocaleProvider } from '@/context/LocaleContext';

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

describe('AppBootstrapGate', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
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
});

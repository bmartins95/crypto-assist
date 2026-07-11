import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import AppBootstrapGate from './AppBootstrapGate';
import { LocaleProvider } from '@/context/LocaleContext';

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
  });

  it('shows an error state with retry when the timeout is reached', async () => {
    vi.useFakeTimers();
    const run = vi.fn(() => new Promise<void>(() => undefined));
    renderGate(run);
    await act(() => vi.advanceTimersByTimeAsync(30000));
    expect(screen.getByText(/não foi possível carregar/i)).toBeTruthy();
    const retryButton = screen.getByRole('button', { name: /tentar novamente/i });
    expect(retryButton).toBeTruthy();
  });

  it('retries by calling run again when the retry button is clicked', async () => {
    vi.useFakeTimers();
    const run = vi.fn(() => new Promise<void>(() => undefined));
    renderGate(run);
    await act(() => vi.advanceTimersByTimeAsync(30000));
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(run).toHaveBeenCalledTimes(2);
  });
});

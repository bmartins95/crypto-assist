import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createAppRouter } from '@/router';
import { LocaleProvider } from '@/context/LocaleContext';
import { BalanceProvider } from '@/context/BalanceContext';
import { ThemeProvider } from '@/context/ThemeContext';

vi.mock('@/lib/api/client', () => ({
  api: {
    getOps: vi.fn(async () => []),
    getExitPrices: vi.fn(async () => ({})),
    getPrices: vi.fn(async () => ({})),
    createOp: vi.fn(async () => ({})),
    updateOp: vi.fn(async () => ({})),
    deleteOp: vi.fn(async () => undefined),
    setExitPrice: vi.fn(async () => undefined),
    importBackup: vi.fn(async () => undefined),
    exportBackup: vi.fn(async () => ({ version: 1, exportedAt: '', ops: [] })),
    clearOps: vi.fn(async () => ({ deleted: 0 })),
  },
}));

vi.mock('@/lib/storage', () => ({
  storage: {
    getAvatars: vi.fn(() => ({})),
    setAvatars: vi.fn(),
  },
  getLegacyOps: vi.fn(() => []),
  getLegacyExitPrices: vi.fn(() => ({})),
  hasMigrationBeenDeclined: vi.fn(() => false),
  declineMigration: vi.fn(),
  clearLegacyData: vi.fn(),
}));

const sessionTokens = vi.hoisted(() => ({
  id_token: 'token',
  access_token: 'access',
  refresh_token: 'refresh',
  expires_at: Date.now() + 3600_000,
}));

vi.mock('@/lib/cognito/client', () => ({
  getSession: vi.fn(() => sessionTokens),
  getEmailFromIdToken: vi.fn(() => 'user@example.com'),
  clearSession: vi.fn(),
  buildLogoutUrl: vi.fn(() => 'https://logout.example.com'),
  exchangeCode: vi.fn(async () => undefined),
}));

vi.mock('@/components/WalletTab', () => ({
  default: (props: { statusMsg: string; onFetchPrices: () => void; onExitPriceChange: (coinId: string, value: string) => void }) => (
    <div data-testid="wallet-view">
      <span data-testid="status-msg">{props.statusMsg}</span>
      <button onClick={props.onFetchPrices}>fetch-prices</button>
      <button onClick={() => props.onExitPriceChange('bitcoin', '99')}>set-exit</button>
    </div>
  ),
}));
vi.mock('@/components/ProfitTab', () => ({ default: () => <div data-testid="profit-view" /> }));
vi.mock('@/components/HistoryTab', () => ({
  default: (props: { onAddOp: (op: unknown) => void; onEditOp: (id: string, op: unknown) => void; onRemoveOp: (id: string) => void }) => (
    <div data-testid="history-view">
      <button onClick={() => props.onAddOp({ coinId: 'bitcoin' })}>add-op</button>
      <button onClick={() => props.onEditOp('1', { coinId: 'bitcoin' })}>edit-op</button>
      <button onClick={() => props.onRemoveOp('1')}>remove-op</button>
    </div>
  ),
}));
vi.mock('@/app/auth/AuthClient', () => ({ default: () => <div data-testid="auth-view" /> }));

async function renderAt(path: string) {
  const testRouter = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  render(
    <ThemeProvider>
      <LocaleProvider>
        <BalanceProvider>
          <RouterProvider router={testRouter} />
        </BalanceProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
  return testRouter;
}

describe('AppLayout', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => false));
    const { getSession } = await import('@/lib/cognito/client');
    vi.mocked(getSession).mockReturnValue(sessionTokens);
    const { api } = await import('@/lib/api/client');
    vi.mocked(api.getOps).mockResolvedValue([]);
    vi.mocked(api.getExitPrices).mockResolvedValue({});
    const storageMod = await import('@/lib/storage');
    vi.mocked(storageMod.getLegacyOps).mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads portfolio data once and renders the wallet view at /wallet', async () => {
    const { api } = await import('@/lib/api/client');
    await renderAt('/wallet');
    await waitFor(() => expect(screen.getByTestId('wallet-view')).toBeTruthy());
    expect(api.getOps).toHaveBeenCalledTimes(1);
    expect(api.getExitPrices).toHaveBeenCalledTimes(1);
  });

  it('renders the sidebar with i18n labels and active route highlighted', async () => {
    await renderAt('/wallet');
    await waitFor(() => expect(screen.getByTestId('wallet-view')).toBeTruthy());
    expect(screen.getByRole('link', { name: /carteira/i }).className).toContain('active');
    expect(screen.getByRole('link', { name: /lucro/i }).className).not.toContain('active');
    expect(screen.getByRole('link', { name: /histórico/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /configurações/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /sair/i })).toBeTruthy();
    expect(screen.getByText('user@example.com')).toBeTruthy();
  });

  it('switches routes via sidebar without refetching portfolio data', async () => {
    const { api } = await import('@/lib/api/client');
    const testRouter = await renderAt('/wallet');
    await waitFor(() => expect(screen.getByTestId('wallet-view')).toBeTruthy());
    await testRouter.navigate({ to: '/profit' });
    await waitFor(() => expect(screen.getByTestId('profit-view')).toBeTruthy());
    await testRouter.navigate({ to: '/history' });
    await waitFor(() => expect(screen.getByTestId('history-view')).toBeTruthy());
    expect(api.getOps).toHaveBeenCalledTimes(1);
    expect(api.getExitPrices).toHaveBeenCalledTimes(1);
  });

  it('shows a load-error status when the initial fetch fails', async () => {
    const { api } = await import('@/lib/api/client');
    vi.mocked(api.getOps).mockRejectedValueOnce(new Error('network'));
    await renderAt('/wallet');
    await waitFor(() => expect(screen.getByTestId('wallet-view').textContent).not.toBe(''));
  });

  it('offers legacy migration and imports on confirm', async () => {
    const { api } = await import('@/lib/api/client');
    const storageMod = await import('@/lib/storage');
    vi.mocked(storageMod.getLegacyOps).mockReturnValue([
      { coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Buy', qty: 1, price: 10, fee: 0, total: 10, date: '2026-01-01', platform: 'Binance' },
    ]);
    vi.stubGlobal('confirm', vi.fn(() => true));
    await renderAt('/wallet');
    await waitFor(() => expect(api.importBackup).toHaveBeenCalledTimes(1));
    expect(storageMod.clearLegacyData).toHaveBeenCalledTimes(1);
  });

  it('redirects unauthenticated users to /auth', async () => {
    const { getSession } = await import('@/lib/cognito/client');
    vi.mocked(getSession).mockReturnValue(null);
    await renderAt('/wallet');
    await waitFor(() => expect(screen.getByTestId('auth-view')).toBeTruthy());
    expect(screen.queryByTestId('wallet-view')).toBeNull();
  });

  it('does not resolve the removed /dashboard route', async () => {
    await renderAt('/dashboard');
    await waitFor(() => expect(screen.queryByTestId('wallet-view')).toBeNull());
    expect(screen.queryByTestId('profit-view')).toBeNull();
    expect(screen.queryByTestId('history-view')).toBeNull();
  });

  it('renders the settings page inside the sidebar shell at /settings', async () => {
    await renderAt('/settings');
    await waitFor(() => expect(document.querySelector('.settings-page')).toBeTruthy());
    expect(document.querySelector('.sb')).toBeTruthy();
  });

  describe('sidebar collapse persistence', () => {
    it('starts expanded when no preference is stored', async () => {
      await renderAt('/wallet');
      await waitFor(() => expect(document.querySelector('.layout')).toBeTruthy());
      expect(document.querySelector('.layout')?.className).not.toContain('collapsed');
    });

    it('starts collapsed when localStorage has sidebar:collapsed=1', async () => {
      localStorage.setItem('sidebar:collapsed', '1');
      await renderAt('/wallet');
      await waitFor(() => expect(document.querySelector('.layout')).toBeTruthy());
      expect(document.querySelector('.layout')?.className).toContain('collapsed');
    });

    it('treats an unexpected stored value as expanded', async () => {
      localStorage.setItem('sidebar:collapsed', 'garbage');
      await renderAt('/wallet');
      await waitFor(() => expect(document.querySelector('.layout')).toBeTruthy());
      expect(document.querySelector('.layout')?.className).not.toContain('collapsed');
    });

    it('toggling writes the preference and flips the layout class', async () => {
      await renderAt('/wallet');
      await waitFor(() => expect(document.querySelector('.layout')).toBeTruthy());
      const toggle = screen.getByRole('button', { name: /alternar barra lateral/i });
      fireEvent.click(toggle);
      expect(localStorage.getItem('sidebar:collapsed')).toBe('1');
      expect(document.querySelector('.layout')?.className).toContain('collapsed');
      fireEvent.click(toggle);
      expect(localStorage.getItem('sidebar:collapsed')).toBe('0');
      expect(document.querySelector('.layout')?.className).not.toContain('collapsed');
    });
  });

  it('auto-fetches prices once when assets exist', async () => {
    const { api } = await import('@/lib/api/client');
    vi.mocked(api.getOps).mockResolvedValue([
      { id: '1', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Buy', qty: 1, price: 10, fee: 0, total: 10, date: '2026-01-01', platform: 'Binance' },
    ]);
    const testRouter = await renderAt('/wallet');
    await waitFor(() => expect(api.getPrices).toHaveBeenCalledTimes(1));
    await testRouter.navigate({ to: '/profit' });
    await waitFor(() => expect(screen.getByTestId('profit-view')).toBeTruthy());
    expect(api.getPrices).toHaveBeenCalledTimes(1);
  });

  it('redirects the root URL to /wallet', async () => {
    await renderAt('/');
    await waitFor(() => expect(screen.getByTestId('wallet-view')).toBeTruthy());
  });

  describe('portfolio handlers', () => {
    const oneOp = { id: '1', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Buy' as const, qty: 1, price: 10, fee: 0, total: 10, date: '2026-01-01', platform: 'Binance' };

    it('creates an op via HistoryTab and surfaces failures with an alert', async () => {
      const { api } = await import('@/lib/api/client');
      vi.mocked(api.createOp).mockResolvedValueOnce(oneOp);
      await renderAt('/history');
      await waitFor(() => expect(screen.getByTestId('history-view')).toBeTruthy());
      fireEvent.click(screen.getByText('add-op'));
      await waitFor(() => expect(api.createOp).toHaveBeenCalledTimes(1));
      expect(window.alert).not.toHaveBeenCalled();

      vi.mocked(api.createOp).mockRejectedValueOnce(new Error('fail'));
      fireEvent.click(screen.getByText('add-op'));
      await waitFor(() => expect(window.alert).toHaveBeenCalledTimes(1));
    });

    it('edits and removes ops via HistoryTab, alerting on failure', async () => {
      const { api } = await import('@/lib/api/client');
      vi.mocked(api.updateOp).mockResolvedValueOnce(oneOp);
      await renderAt('/history');
      await waitFor(() => expect(screen.getByTestId('history-view')).toBeTruthy());
      fireEvent.click(screen.getByText('edit-op'));
      await waitFor(() => expect(api.updateOp).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByText('remove-op'));
      await waitFor(() => expect(api.deleteOp).toHaveBeenCalledTimes(1));
      expect(window.alert).not.toHaveBeenCalled();

      vi.mocked(api.updateOp).mockRejectedValueOnce(new Error('fail'));
      fireEvent.click(screen.getByText('edit-op'));
      await waitFor(() => expect(window.alert).toHaveBeenCalledTimes(1));
      vi.mocked(api.deleteOp).mockRejectedValueOnce(new Error('fail'));
      fireEvent.click(screen.getByText('remove-op'));
      await waitFor(() => expect(window.alert).toHaveBeenCalledTimes(2));
    });

    it('sets an exit price and shows a status message on failure', async () => {
      const { api } = await import('@/lib/api/client');
      await renderAt('/wallet');
      await waitFor(() => expect(screen.getByTestId('wallet-view')).toBeTruthy());
      fireEvent.click(screen.getByText('set-exit'));
      await waitFor(() => expect(api.setExitPrice).toHaveBeenCalledWith('bitcoin', 99));

      vi.mocked(api.setExitPrice).mockRejectedValueOnce(new Error('fail'));
      fireEvent.click(screen.getByText('set-exit'));
      await waitFor(() => expect(screen.getByTestId('status-msg').textContent).not.toBe(''));
    });

    it('reports a status message when fetching prices with no assets', async () => {
      await renderAt('/wallet');
      await waitFor(() => expect(screen.getByTestId('wallet-view')).toBeTruthy());
      fireEvent.click(screen.getByText('fetch-prices'));
      await waitFor(() => expect(screen.getByTestId('status-msg').textContent).not.toBe(''));
    });

    it('updates prices and status on successful fetch, and reports rate limiting', async () => {
      const { api } = await import('@/lib/api/client');
      vi.mocked(api.getOps).mockResolvedValue([oneOp]);
      vi.mocked(api.getPrices).mockResolvedValue({ bitcoin: { price: 50, image: 'https://img' } });
      await renderAt('/wallet');
      await waitFor(() => expect(api.getPrices).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByTestId('status-msg').textContent).toMatch(/\d{2}:\d{2}/));

      vi.mocked(api.getPrices).mockRejectedValueOnce(Object.assign(new Error('rate'), { status: 429 }));
      fireEvent.click(screen.getByText('fetch-prices'));
      await waitFor(() => expect(api.getPrices).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByTestId('status-msg').textContent).not.toMatch(/\d{2}:\d{2}/));
    });
  });

  describe('auth callback', () => {
    it('exchanges the code and proceeds when present', async () => {
      const { exchangeCode } = await import('@/lib/cognito/client');
      window.history.pushState({}, '', '/auth/callback?code=abc');
      await renderAt('/auth/callback');
      await waitFor(() => expect(exchangeCode).toHaveBeenCalledWith('abc'));
    });

    it('shows the failure message when the exchange fails', async () => {
      const { exchangeCode } = await import('@/lib/cognito/client');
      vi.mocked(exchangeCode).mockRejectedValueOnce(new Error('bad code'));
      window.history.pushState({}, '', '/auth/callback?code=bad');
      await renderAt('/auth/callback');
      await waitFor(() => expect(screen.getByText(/falha na autenticação/i)).toBeTruthy());
    });

    it('does not exchange when the code is missing', async () => {
      const { exchangeCode } = await import('@/lib/cognito/client');
      window.history.pushState({}, '', '/auth/callback');
      await renderAt('/auth/callback');
      await waitFor(() => expect(screen.queryByTestId('wallet-view')).toBeNull());
      expect(exchangeCode).not.toHaveBeenCalled();
    });
  });
});

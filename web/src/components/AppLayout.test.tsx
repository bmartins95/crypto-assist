import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createAppRouter } from '@/router';
import { LocaleProvider } from '@/context/LocaleContext';
import { BalanceProvider } from '@/context/BalanceContext';
import { CurrencyProvider } from '@/context/CurrencyContext';
import { PriceRefreshProvider } from '@/context/PriceRefreshContext';
import type { Op } from '@/lib/types';

beforeEach(() => {
  localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify({ BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 }));
});
import { ThemeProvider } from '@/context/ThemeContext';

vi.mock('@/lib/api/client', () => ({
  api: {
    getOps: vi.fn(async () => []),
    getOpClosures: vi.fn(async () => []),
    closeOp: vi.fn(async () => ({ closingOp: {}, closures: [] })),
    getExchangeRates: vi.fn(async () => ({ rates: { BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 }, updatedAt: '2026-01-01T00:00:00Z' })),
    getExitPrices: vi.fn(async () => ({})),
    getPrices: vi.fn(async () => ({})),
    searchCoins: vi.fn(async () => []),
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

vi.mock('@/auth/useAuth', () => ({
  isAuthenticated: vi.fn(async () => true),
  fetchUserAttributes: vi.fn(async () => ({ email: 'user@example.com', name: 'User' })),
  signOut: vi.fn(async () => undefined),
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
  default: (props: {
    onAddOp: (op: unknown) => void; onEditOp: (id: string, op: unknown) => void; onRemoveOp: (id: string) => void;
    onCloseOp: (sourceOpId: string, op: unknown, qty: number) => void;
  }) => (
    <div data-testid="history-view">
      <button onClick={() => props.onAddOp({ coinId: 'bitcoin' })}>add-op</button>
      <button onClick={() => props.onEditOp('1', { coinId: 'bitcoin' })}>edit-op</button>
      <button onClick={() => props.onRemoveOp('1')}>remove-op</button>
      <button onClick={() => props.onCloseOp('1', { coinId: 'bitcoin' }, 0.5)}>close-op</button>
    </div>
  ),
}));
vi.mock('@/auth/screens/LoginScreen', () => ({ default: () => <div data-testid="auth-view" /> }));

async function renderAt(path: string) {
  const testRouter = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  render(
    <ThemeProvider>
      <LocaleProvider>
        <BalanceProvider><CurrencyProvider><PriceRefreshProvider>
          <RouterProvider router={testRouter} />
        </PriceRefreshProvider></CurrencyProvider></BalanceProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
  return testRouter;
}

describe('AppLayout', () => {
  beforeEach(async () => {
    localStorage.clear(); localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify({ BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 }));
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => false));
    const { isAuthenticated } = await import('@/auth/useAuth');
    vi.mocked(isAuthenticated).mockResolvedValue(true);
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
    expect(await screen.findByText('user@example.com')).toBeTruthy();
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

  it('shows the bootstrap error screen instead of an empty wallet when the initial fetch fails', async () => {
    const { api } = await import('@/lib/api/client');
    vi.mocked(api.getOps).mockRejectedValue(new Error('network'));
    await renderAt('/wallet');
    expect(await screen.findByRole('button', { name: /tentar novamente/i })).toBeTruthy();
    expect(screen.queryByTestId('wallet-view')).toBeNull();
  });

  it('retries the bootstrap and renders the wallet once the retry succeeds', async () => {
    const { api } = await import('@/lib/api/client');
    vi.mocked(api.getOps).mockRejectedValueOnce(new Error('network'));
    await renderAt('/wallet');
    const retryButton = await screen.findByRole('button', { name: /tentar novamente/i });

    vi.mocked(api.getOps).mockResolvedValueOnce([]);
    fireEvent.click(retryButton);

    await waitFor(() => expect(screen.getByTestId('wallet-view')).toBeTruthy());
    expect(api.getOps).toHaveBeenCalledTimes(2);
  });

  it('offers legacy migration and imports on confirm', async () => {
    const { api } = await import('@/lib/api/client');
    const storageMod = await import('@/lib/storage');
    vi.mocked(storageMod.getLegacyOps).mockReturnValue([
      { coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Buy', qty: 1, price: 10, fee: 0, total: 10, date: '2026-01-01', platformId: 'binance', platformName: 'Binance' },
    ]);
    vi.stubGlobal('confirm', vi.fn(() => true));
    await renderAt('/wallet');
    await waitFor(() => expect(api.importBackup).toHaveBeenCalledTimes(1));
    expect(storageMod.clearLegacyData).toHaveBeenCalledTimes(1);
  });

  it('redirects unauthenticated users to /login', async () => {
    const { isAuthenticated } = await import('@/auth/useAuth');
    vi.mocked(isAuthenticated).mockResolvedValue(false);
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
      { id: '1', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Buy', qty: 1, price: 10, fee: 0, total: 10, date: '2026-01-01', platformId: 'binance', platformName: 'Binance' },
    ]);
    const testRouter = await renderAt('/wallet');
    await waitFor(() => expect(api.getPrices).toHaveBeenCalledTimes(1));
    await testRouter.navigate({ to: '/profit' });
    await waitFor(() => expect(screen.getByTestId('profit-view')).toBeTruthy());
    expect(api.getPrices).toHaveBeenCalledTimes(1);
  });

  it('redirects the root URL to /wallet when authenticated', async () => {
    await renderAt('/');
    await waitFor(() => expect(screen.getByTestId('wallet-view')).toBeTruthy());
  });

  it('shows the public hero page at the root URL when unauthenticated', async () => {
    const { isAuthenticated } = await import('@/auth/useAuth');
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    await renderAt('/');
    await waitFor(() => expect(screen.getByText('aqui.')).toBeTruthy());
    expect(screen.queryByTestId('wallet-view')).toBeNull();
  });

  describe('price auto-refresh', () => {
    const oneOp = { id: '1', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Buy' as const, qty: 1, price: 10, fee: 0, total: 10, date: '2026-01-01', platformId: 'binance', platformName: 'Binance' };

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      ['30000', 30000],
      ['60000', 60000],
      ['300000', 300000],
    ])('refreshes prices automatically every %sms when that interval is configured', async (stored, ms) => {
      const { api } = await import('@/lib/api/client');
      vi.mocked(api.getOps).mockResolvedValue([oneOp]);
      localStorage.setItem('price_refresh_interval', stored);
      vi.useFakeTimers({ shouldAdvanceTime: true });

      await renderAt('/wallet');
      await waitFor(() => expect(api.getPrices).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(ms);
      await waitFor(() => expect(api.getPrices).toHaveBeenCalledTimes(2));
    });

    it('keeps retrying on the next tick after a failed automatic fetch (FR-009)', async () => {
      const { api } = await import('@/lib/api/client');
      vi.mocked(api.getOps).mockResolvedValue([oneOp]);
      localStorage.setItem('price_refresh_interval', '30000');
      vi.useFakeTimers({ shouldAdvanceTime: true });

      await renderAt('/wallet');
      await waitFor(() => expect(api.getPrices).toHaveBeenCalledTimes(1));

      vi.mocked(api.getPrices).mockRejectedValueOnce(new Error('network error'));
      await vi.advanceTimersByTimeAsync(30000);
      await waitFor(() => expect(screen.getByTestId('status-msg').textContent).toBeTruthy());
      expect(api.getPrices).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(30000);
      await waitFor(() => expect(api.getPrices).toHaveBeenCalledTimes(3));
    });

    it('reschedules cleanly when the interval changes mid-session, with no leftover fetch at the old cadence (FR-005)', async () => {
      const { api } = await import('@/lib/api/client');
      vi.mocked(api.getOps).mockResolvedValue([oneOp]);
      localStorage.setItem('price_refresh_interval', '30000');
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const testRouter = await renderAt('/wallet');
      await waitFor(() => expect(api.getPrices).toHaveBeenCalledTimes(1));

      await testRouter.navigate({ to: '/settings' });
      const select = (await screen.findByLabelText(/atualizar preços/i)) as HTMLSelectElement;
      fireEvent.change(select, { target: { value: '60000' } });

      await vi.advanceTimersByTimeAsync(30000);
      expect(api.getPrices).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(30000);
      await waitFor(() => expect(api.getPrices).toHaveBeenCalledTimes(2));
    });

    it('stops automatic refresh when switched back to Manual, without affecting the manual refresh button (FR-004)', async () => {
      const { api } = await import('@/lib/api/client');
      vi.mocked(api.getOps).mockResolvedValue([oneOp]);
      localStorage.setItem('price_refresh_interval', '30000');
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const testRouter = await renderAt('/wallet');
      await waitFor(() => expect(api.getPrices).toHaveBeenCalledTimes(1));

      await testRouter.navigate({ to: '/settings' });
      const select = (await screen.findByLabelText(/atualizar preços/i)) as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'null' } });

      await vi.advanceTimersByTimeAsync(60000);
      expect(api.getPrices).toHaveBeenCalledTimes(1);

      await testRouter.navigate({ to: '/wallet' });
      fireEvent.click(screen.getByText('fetch-prices'));
      await waitFor(() => expect(api.getPrices).toHaveBeenCalledTimes(2));
    });
  });

  describe('warm-boot skeleton loading', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('still shows the full-screen loader on a cold boot (no prior wallet:entered flag), even if the fetch is slow', async () => {
      const { api } = await import('@/lib/api/client');
      let resolveOps: (v: Op[]) => void = () => undefined;
      vi.mocked(api.getOps).mockReturnValue(new Promise(resolve => { resolveOps = resolve; }));
      await renderAt('/wallet');
      await waitFor(() => expect(screen.getByText(/preparando sua carteira/i)).toBeTruthy());
      expect(screen.queryByTestId('wallet-view')).toBeNull();
      resolveOps([]);
      await waitFor(() => expect(screen.getByTestId('wallet-view')).toBeTruthy());
    });

    it('skips the full-screen loader on a warm boot, showing the matching skeleton in the content area once the delay elapses', async () => {
      sessionStorage.setItem('wallet:entered', '1');
      const { api } = await import('@/lib/api/client');
      let resolveOps: (v: Op[]) => void = () => undefined;
      vi.mocked(api.getOps).mockReturnValue(new Promise(resolve => { resolveOps = resolve; }));
      vi.useFakeTimers({ shouldAdvanceTime: true });

      await renderAt('/wallet');
      await waitFor(() => expect(document.querySelector('.layout')).toBeTruthy());
      expect(screen.queryByText(/preparando sua carteira/i)).toBeNull();

      await vi.advanceTimersByTimeAsync(150);
      await waitFor(() => expect(document.querySelector('.tbl .sk')).toBeTruthy());
      expect(screen.queryByTestId('wallet-view')).toBeNull();

      resolveOps([]);
      await waitFor(() => expect(screen.getByTestId('wallet-view')).toBeTruthy());
    });

    it('overlays a compact warming notice on the skeleton after 2.5s on a warm boot, never swapping to the login-branded loader', async () => {
      sessionStorage.setItem('wallet:entered', '1');
      const { api } = await import('@/lib/api/client');
      vi.mocked(api.getOps).mockReturnValue(new Promise(() => undefined));
      vi.useFakeTimers({ shouldAdvanceTime: true });

      await renderAt('/wallet');
      await waitFor(() => expect(document.querySelector('.layout')).toBeTruthy());
      expect(document.querySelector('.warming-notice')).toBeNull();
      await vi.advanceTimersByTimeAsync(2500);
      await waitFor(() => expect(document.querySelector('.warming-notice')).toBeTruthy());
      expect(document.querySelector('.tbl .sk')).toBeTruthy();
      expect(document.querySelector('.layout')).toBeTruthy();
      expect(document.querySelector('.auth-loader')).toBeNull();
      expect(screen.queryByTestId('wallet-view')).toBeNull();
    });
  });

  describe('portfolio handlers', () => {
    const oneOp = { id: '1', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Buy' as const, qty: 1, price: 10, fee: 0, total: 10, date: '2026-01-01', platformId: 'binance', platformName: 'Binance' };

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

    it('closes an op via HistoryTab, appending the result, and alerts on failure', async () => {
      const { api } = await import('@/lib/api/client');
      const closingOp = { ...oneOp, id: '2', type: 'Sell' as const };
      const closure = { id: 'c1', sourceOpId: '1', closingOpId: '2', qtyClosed: 0.5, realizedPnl: 5 };
      vi.mocked(api.closeOp).mockResolvedValueOnce({ closingOp, closures: [closure] });
      await renderAt('/history');
      await waitFor(() => expect(screen.getByTestId('history-view')).toBeTruthy());
      fireEvent.click(screen.getByText('close-op'));
      await waitFor(() => expect(api.closeOp).toHaveBeenCalledWith('1', { closingOp: { coinId: 'bitcoin' }, qtyToClose: 0.5 }));
      expect(window.alert).not.toHaveBeenCalled();

      vi.mocked(api.closeOp).mockRejectedValueOnce(new Error('fail'));
      fireEvent.click(screen.getByText('close-op'));
      await waitFor(() => expect(window.alert).toHaveBeenCalledTimes(1));
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

  describe('reload() price freshness after import', () => {
    it('fetches prices for newly-imported coins immediately, with no manual refresh', async () => {
      const { api } = await import('@/lib/api/client');
      vi.mocked(api.getOps)
        .mockResolvedValueOnce([])
        .mockResolvedValue([
          { id: '1', coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', type: 'Buy', qty: 2, price: 1000, fee: 0, total: 2000, date: '2026-01-01', platformId: 'binance', platformName: 'Binance' },
        ]);
      vi.mocked(api.getPrices).mockResolvedValue({ ethereum: { price: 3000, image: 'https://img' } });

      await renderAt('/settings');
      const file = new File(
        [JSON.stringify({ version: 1, exportedAt: '', ops: [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', type: 'Buy', qty: 2, price: 1000, fee: 0, total: 2000, date: '2026-01-01', platformId: 'binance', platformName: 'Binance' }] })],
        'backup.json',
        { type: 'application/json' }
      );
      const input = (await screen.findByLabelText(/importar/i)) as HTMLInputElement;
      await fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => expect(api.importBackup).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(api.getPrices).toHaveBeenCalledWith(['ethereum']));
      expect(api.getPrices).toHaveBeenCalledTimes(1);
    });

    it('does not re-fetch prices when reload() loads an empty ops list (e.g. importing an empty backup)', async () => {
      const { api } = await import('@/lib/api/client');
      const oneOp = { id: '1', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Buy' as const, qty: 1, price: 10, fee: 0, total: 10, date: '2026-01-01', platformId: 'binance', platformName: 'Binance' };
      vi.mocked(api.getOps).mockResolvedValueOnce([oneOp]).mockResolvedValue([]);
      vi.mocked(api.getPrices).mockResolvedValue({ bitcoin: { price: 50 } });

      const testRouter = await renderAt('/wallet');
      await waitFor(() => expect(api.getPrices).toHaveBeenCalledTimes(1));

      await testRouter.navigate({ to: '/settings' });
      const file = new File([JSON.stringify({ version: 1, exportedAt: '', ops: [] })], 'empty.json', { type: 'application/json' });
      const input = (await screen.findByLabelText(/importar/i)) as HTMLInputElement;
      await fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => expect(api.importBackup).toHaveBeenCalledTimes(1));
      expect(api.getPrices).toHaveBeenCalledTimes(1);
    });
  });

});

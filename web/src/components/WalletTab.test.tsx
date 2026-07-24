import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WalletTab from './WalletTab';
import type { Asset } from '@/lib/types';
import { LocaleProvider } from '@/context/LocaleContext';
import { BalanceProvider } from '@/context/BalanceContext';
import { CurrencyProvider } from '@/context/CurrencyContext';

vi.mock('@/lib/api/client', () => ({
  api: {
    getExchangeRates: vi.fn(async () => ({ rates: { BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 }, updatedAt: '2026-01-01T00:00:00Z' })),
    getPlatformExchanges: vi.fn(async () => ({ exchanges: [{ id: 'binance', name: 'Binance', kind: 'exchange' }], updatedAt: '2026-01-01T00:00:00Z' })),
  },
}));

beforeEach(() => {
  localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify({ BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 }));
});

const baseProps = {
  ops: [],
  prices: {},
  avatarCache: {},
  statusMsg: '',
  onFetchPrices: vi.fn(),
  onExitPriceChange: vi.fn(),
  onGroupMode: vi.fn(),
};

const asset: Asset = { coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', qty: 2, avgPrice: 100, exitPrice: 0 };

function renderWithLocale(ui: React.ReactElement) {
  return render(<LocaleProvider><BalanceProvider><CurrencyProvider>{ui}</CurrencyProvider></BalanceProvider></LocaleProvider>);
}

const assetWithAvatar: Asset = { coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 1, avgPrice: 50, exitPrice: 0 };

describe('WalletTab', () => {
  it('shows the empty state when there are no assets', () => {
    renderWithLocale(<WalletTab {...baseProps} assets={[]} groupMode="asset" />);
    expect(screen.getByText(/Registre operações/)).toBeInTheDocument();
  });

  it('lists assets grouped by asset, with formatted values', () => {
    renderWithLocale(<WalletTab {...baseProps} assets={[asset]} prices={{ bitcoin: 150 }} groupMode="asset" />);
    expect(screen.getByText('Bitcoin')).toBeInTheDocument();
    // Invested (2 * 100 = 200) and current value (2 * 150 = 300) appear in
    // both the metrics cards and the position row. Match numeric content only
    // to avoid dependency on the exact currency symbol spacing (R$  vs R$ ).
    expect(screen.getAllByText(/200,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/300,00/).length).toBeGreaterThan(0);
  });

  it('calls onExitPriceChange when the exit price input changes', () => {
    const onExitPriceChange = vi.fn();
    renderWithLocale(<WalletTab {...baseProps} assets={[asset]} onExitPriceChange={onExitPriceChange} groupMode="asset" />);
    const input = screen.getByPlaceholderText('—');
    fireEvent.change(input, { target: { value: '500' } });
    expect(onExitPriceChange).toHaveBeenCalledWith('bitcoin', '500');
  });

  it('shows the exit price input labeled with the selected currency symbol', () => {
    renderWithLocale(<WalletTab {...baseProps} assets={[asset]} groupMode="asset" />);
    const input = screen.getByPlaceholderText('—');
    expect(input.previousSibling).toHaveTextContent('R$');
  });

  it('relabels the exit price prefix after switching to a different currency', () => {
    localStorage.setItem('crypto-assist:currency', 'USD');
    renderWithLocale(<WalletTab {...baseProps} assets={[asset]} groupMode="asset" />);
    const input = screen.getByPlaceholderText('—');
    expect(input.previousSibling).toHaveTextContent('US$');
  });

  it('calls onGroupMode when switching the grouping buttons', () => {
    const onGroupMode = vi.fn();
    renderWithLocale(<WalletTab {...baseProps} assets={[asset]} onGroupMode={onGroupMode} groupMode="asset" />);
    fireEvent.click(screen.getByText('Por plataforma'));
    expect(onGroupMode).toHaveBeenCalledWith('platform');
  });

  it('renders no icon inside the grouping segmented control', () => {
    renderWithLocale(<WalletTab {...baseProps} assets={[asset]} groupMode="asset" />);
    expect(document.querySelectorAll('.chart-switcher i')).toHaveLength(0);
  });

  it('groups by platform when groupMode is "platform"', () => {
    const opsForPlatform = [
      { id: 'op-1', date: '2024-01-01', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Buy' as const, qty: 1, price: 100, fee: 0, total: 100, platformId: 'binance', platformName: 'Binance' },
    ];
    renderWithLocale(<WalletTab {...baseProps} ops={opsForPlatform} assets={[asset]} groupMode="platform" />);
    expect(screen.getByText('Binance')).toBeInTheDocument();
  });

  it('renders AssetWithPlatform rows when groupMode is "both"', () => {
    const opsForBoth = [
      { id: 'op-1', date: '2024-01-01', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Buy' as const, qty: 1, price: 100, fee: 0, total: 100, platformId: 'binance', platformName: 'Binance' },
    ];
    renderWithLocale(<WalletTab {...baseProps} ops={opsForBoth} assets={[asset]} groupMode="both" />);
    expect(screen.getByText('Binance')).toBeInTheDocument();
    expect(screen.getByText('Bitcoin')).toBeInTheDocument();
  });

  it('renders a PlatformChip (logo + bold name) as the first column when grouped "by platform"', async () => {
    const opsForPlatform = [
      { id: 'op-1', date: '2024-01-01', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Buy' as const, qty: 1, price: 100, fee: 0, total: 100, platformId: 'binance', platformName: 'Binance' },
    ];
    renderWithLocale(<WalletTab {...baseProps} ops={opsForPlatform} assets={[asset]} groupMode="platform" />);
    await waitFor(() => expect(document.querySelector('.tbl tbody .plogo-md')).toBeInTheDocument());
    expect(screen.getByText('Binance')).toHaveStyle({ fontWeight: 600 });
  });

  it('renders the real logo, category badge, and right-aligned total/return in "Asset + platform" group headers', async () => {
    const opsForBoth = [
      { id: 'op-1', date: '2024-01-01', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Buy' as const, qty: 1, price: 100, fee: 0, total: 100, platformId: 'binance', platformName: 'Binance' },
    ];
    renderWithLocale(<WalletTab {...baseProps} ops={opsForBoth} assets={[asset]} prices={{ bitcoin: 150 }} groupMode="both" />);
    await waitFor(() => expect(screen.getByText('Corretora')).toBeInTheDocument());
    expect(document.querySelector('.grp-hd .plogo-md')).toBeInTheDocument();
    expect(document.querySelectorAll('.ti-building-bank')).toHaveLength(0);
    const gsum = document.querySelector('.grp-hd .gsum');
    expect(gsum).toHaveTextContent('+50.00%');
  });

  it('omits an empty platform group from "Asset + platform" (existing behavior preserved)', () => {
    renderWithLocale(<WalletTab {...baseProps} ops={[]} assets={[asset]} groupMode="both" />);
    expect(document.querySelectorAll('.grp-hd')).toHaveLength(0);
  });

  describe('US1 — metric cards', () => {
    it('colors the P/L and Return cards by sign', () => {
      renderWithLocale(<WalletTab {...baseProps} assets={[asset]} prices={{ bitcoin: 150 }} groupMode="asset" />);
      const pnlCards = document.querySelectorAll('.metric-value.pos');
      expect(pnlCards.length).toBe(2); // P/L (+100) and Return (+50%)
    });

    it('colors the P/L and Return cards negative when the position is down', () => {
      renderWithLocale(<WalletTab {...baseProps} assets={[asset]} prices={{ bitcoin: 50 }} groupMode="asset" />);
      const negCards = document.querySelectorAll('.metric-value.neg');
      expect(negCards.length).toBe(2);
    });

    it('shows a placeholder on all price-dependent cards when no asset has a known price', () => {
      renderWithLocale(<WalletTab {...baseProps} assets={[asset]} prices={{}} groupMode="asset" />);
      const dashCards = screen.getAllByText('—').filter(el => el.className.includes('metric-value'));
      expect(dashCards.length).toBe(3); // current value, P/L, return
    });

    it('masks metric card values when balances are hidden', () => {
      localStorage.setItem('crypto-assist:balance-hidden', 'true');
      renderWithLocale(<WalletTab {...baseProps} assets={[asset]} prices={{ bitcoin: 150 }} groupMode="asset" />);
      expect(document.querySelector('.metric-value')?.textContent).toBe('••••••');
      localStorage.clear(); localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify({ BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 }));
    });
  });

  describe('US2 — content header', () => {
    it('renders the view title and subtitle', () => {
      renderWithLocale(<WalletTab {...baseProps} assets={[asset]} groupMode="asset" />);
      expect(screen.getByText('Carteira')).toBeInTheDocument();
      expect(screen.getByText(/CoinGecko/)).toBeInTheDocument();
    });

    it('shows the status message text', () => {
      renderWithLocale(<WalletTab {...baseProps} assets={[asset]} statusMsg="Atualizado às 14:00" groupMode="asset" />);
      expect(screen.getByText('Atualizado às 14:00')).toBeInTheDocument();
    });

    it('calls onFetchPrices when the refresh button is clicked', () => {
      const onFetchPrices = vi.fn();
      renderWithLocale(<WalletTab {...baseProps} assets={[asset]} onFetchPrices={onFetchPrices} groupMode="asset" />);
      fireEvent.click(screen.getByRole('button', { name: /atualizar preços/i }));
      expect(onFetchPrices).toHaveBeenCalledTimes(1);
    });
  });

  describe('US3 — coin image / table restyle', () => {
    it('renders a coin image when the avatar cache has one', () => {
      renderWithLocale(
        <WalletTab {...baseProps} assets={[assetWithAvatar]} avatarCache={{ ethereum: { url: 'https://img/eth.png' } }} groupMode="asset" />
      );
      const img = document.querySelector('.coin img') as HTMLImageElement;
      expect(img).toBeTruthy();
      expect(img.src).toBe('https://img/eth.png');
    });

    it('falls back to initials when no avatar is cached', () => {
      renderWithLocale(<WalletTab {...baseProps} assets={[asset]} avatarCache={{}} groupMode="asset" />);
      expect(screen.getByText('BTC')).toBeInTheDocument();
    });
  });
});

describe('WalletTab — display currency', () => {
  const nonIdentityRates = { BRL: 5, USD: 1, EUR: 0.9, GBP: 0.8, JPY: 150 };

  it('renders USD reference values converted to the selected display currency', () => {
    localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify(nonIdentityRates));
    localStorage.setItem('crypto-assist:currency', 'BRL');
    renderWithLocale(<WalletTab {...baseProps} assets={[asset]} prices={{ bitcoin: 150 }} groupMode="asset" />);
    // invested 200 USD * 5 = 1.000,00 BRL; current 300 USD * 5 = 1.500,00 BRL
    expect(screen.getAllByText(/1\.000,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1\.500,00/).length).toBeGreaterThan(0);
  });

  it('reflects the selected currency in the subtitle instead of a hardcoded value', () => {
    localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify(nonIdentityRates));
    localStorage.setItem('crypto-assist:currency', 'JPY');
    renderWithLocale(<WalletTab {...baseProps} assets={[asset]} groupMode="asset" />);
    expect(screen.getByText(/· JPY/)).toBeInTheDocument();
    expect(screen.queryByText(/· BRL/)).not.toBeInTheDocument();
  });

  it('shows the rates warning when rates are stale and keeps values masked when hidden', () => {
    localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify(nonIdentityRates));
    localStorage.setItem('crypto-assist:currency', 'USD');
    localStorage.setItem('crypto-assist:balance-hidden', 'true');
    renderWithLocale(<WalletTab {...baseProps} assets={[asset]} prices={{ bitcoin: 150 }} groupMode="asset" />);
    // Provider starts from persisted rates (status: stale) before any fetch resolves.
    expect(screen.getByText(/Cotações desatualizadas/)).toBeInTheDocument();
    expect(screen.getAllByText('••••••').length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/200\.00|200,00/).length).toBe(0);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WalletTab from './WalletTab';
import type { Asset } from '@/lib/types';
import { LocaleProvider } from '@/context/LocaleContext';

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
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

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

  it('calls onGroupMode when switching the grouping buttons', () => {
    const onGroupMode = vi.fn();
    renderWithLocale(<WalletTab {...baseProps} assets={[asset]} onGroupMode={onGroupMode} groupMode="asset" />);
    fireEvent.click(screen.getByText('Por plataforma'));
    expect(onGroupMode).toHaveBeenCalledWith('platform');
  });

  it('groups by platform when groupMode is "platform"', () => {
    const opsForPlatform = [
      { id: 'op-1', date: '2024-01-01', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Buy' as const, qty: 1, price: 100, fee: 0, total: 100, platform: 'Binance' },
    ];
    renderWithLocale(<WalletTab {...baseProps} ops={opsForPlatform} assets={[asset]} groupMode="platform" />);
    expect(screen.getByText('Binance')).toBeInTheDocument();
  });

  it('renders AssetWithPlatform rows when groupMode is "both"', () => {
    const opsForBoth = [
      { id: 'op-1', date: '2024-01-01', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Buy' as const, qty: 1, price: 100, fee: 0, total: 100, platform: 'Binance' },
    ];
    renderWithLocale(<WalletTab {...baseProps} ops={opsForBoth} assets={[asset]} groupMode="both" />);
    expect(screen.getByText('Binance')).toBeInTheDocument();
    expect(screen.getByText('Bitcoin')).toBeInTheDocument();
  });
});

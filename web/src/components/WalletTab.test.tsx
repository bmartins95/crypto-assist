import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WalletTab from './WalletTab';
import type { Asset } from '@/lib/types';

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

describe('WalletTab', () => {
  it('shows the empty state when there are no assets', () => {
    render(<WalletTab {...baseProps} assets={[]} groupMode="asset" />);
    expect(screen.getByText(/Registre operações/)).toBeInTheDocument();
  });

  it('lists assets grouped by asset, with formatted values', () => {
    render(<WalletTab {...baseProps} assets={[asset]} prices={{ bitcoin: 150 }} groupMode="asset" />);
    expect(screen.getByText('Bitcoin')).toBeInTheDocument();
    // Invested (2 * 100) and current value (2 * 150) appear both in the
    // metrics cards and in the position row, so there are two of each.
    expect(screen.getAllByText('R$ 200,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 300,00').length).toBeGreaterThan(0);
  });

  it('calls onExitPriceChange when the exit price input changes', () => {
    const onExitPriceChange = vi.fn();
    render(<WalletTab {...baseProps} assets={[asset]} onExitPriceChange={onExitPriceChange} groupMode="asset" />);
    const input = screen.getByPlaceholderText('—');
    fireEvent.change(input, { target: { value: '500' } });
    expect(onExitPriceChange).toHaveBeenCalledWith('bitcoin', '500');
  });

  it('calls onGroupMode when switching the grouping buttons', () => {
    const onGroupMode = vi.fn();
    render(<WalletTab {...baseProps} assets={[asset]} onGroupMode={onGroupMode} groupMode="asset" />);
    fireEvent.click(screen.getByText('Por plataforma'));
    expect(onGroupMode).toHaveBeenCalledWith('platform');
  });

  it('groups by platform when groupMode is "platform"', () => {
    const opsForPlatform = [
      { date: '2024-01-01', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Compra' as const, qty: 1, price: 100, fee: 0, total: 100, platform: 'Binance' },
    ];
    render(<WalletTab {...baseProps} ops={opsForPlatform} assets={[asset]} groupMode="platform" />);
    expect(screen.getByText('Binance')).toBeInTheDocument();
  });

  it('renders AssetWithPlatform rows when groupMode is "both"', () => {
    const opsForBoth = [
      { date: '2024-01-01', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Compra' as const, qty: 1, price: 100, fee: 0, total: 100, platform: 'Binance' },
    ];
    render(<WalletTab {...baseProps} ops={opsForBoth} assets={[asset]} groupMode="both" />);
    expect(screen.getByText('Binance')).toBeInTheDocument();
    expect(screen.getByText('Bitcoin')).toBeInTheDocument();
  });
});

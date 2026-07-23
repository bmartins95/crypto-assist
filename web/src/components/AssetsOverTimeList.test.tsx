import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AssetsOverTimeList, { AssetListItem } from './AssetsOverTimeList';
import { LocaleProvider } from '@/context/LocaleContext';
import { BalanceProvider } from '@/context/BalanceContext';
import { CurrencyProvider } from '@/context/CurrencyContext';

const ASSETS: AssetListItem[] = [
  { coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: 350000, pctChange: 5, series: [0, 2, 5], color: '#f97316', allocationPct: 70 },
  { coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', price: 18000, pctChange: -12, series: [0, -6, -12], color: '#7c6cf0', allocationPct: 20 },
  { coinId: 'solana', symbol: 'SOL', name: 'Solana', price: 1200, pctChange: 0, series: [], color: '#2dd4bf', allocationPct: 10 },
];

function renderList(assets = ASSETS, onSelectAsset = vi.fn()) {
  render(
    <LocaleProvider><BalanceProvider><CurrencyProvider>
      <AssetsOverTimeList assets={assets} onSelectAsset={onSelectAsset} />
    </CurrencyProvider></BalanceProvider></LocaleProvider>
  );
  return onSelectAsset;
}

describe('AssetsOverTimeList', () => {
  it('renders one row per held asset with icon/name, price, and period % change', () => {
    renderList();
    expect(screen.getByRole('button', { name: 'Bitcoin BTC' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ethereum ETH' })).toBeInTheDocument();
    expect(screen.getByText('+5.00%')).toBeInTheDocument();
    expect(screen.getByText('-12.00%')).toBeInTheDocument();
  });

  it('renders the existing empty-state marker instead of a blank sparkline when an asset has no price history', () => {
    renderList();
    const solRow = screen.getByRole('button', { name: 'Solana SOL' });
    expect(solRow.querySelectorAll('svg')).toHaveLength(0);
    expect(solRow.textContent).toContain('—');
  });

  it('filters rows by search text matching symbol or name', () => {
    renderList();
    fireEvent.change(screen.getByPlaceholderText('Buscar ativo…'), { target: { value: 'eth' } });
    expect(screen.queryByRole('button', { name: 'Bitcoin BTC' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ethereum ETH' })).toBeInTheDocument();
  });

  it('shows an empty-state message when the search matches nothing', () => {
    renderList();
    fireEvent.change(screen.getByPlaceholderText('Buscar ativo…'), { target: { value: 'doesnotexist' } });
    expect(screen.getByText('Nenhum ativo encontrado')).toBeInTheDocument();
  });

  it('sorts by biggest movement by default', () => {
    renderList();
    const rows = screen.getAllByRole('button');
    expect(rows[0]).toHaveAccessibleName('Ethereum ETH');
    expect(rows[1]).toHaveAccessibleName('Bitcoin BTC');
  });

  it('sorts alphabetically when selected', () => {
    renderList();
    fireEvent.change(screen.getByDisplayValue('Maior variação'), { target: { value: 'alphabetical' } });
    const rows = screen.getAllByRole('button');
    expect(rows[0]).toHaveAccessibleName('Bitcoin BTC');
    expect(rows[1]).toHaveAccessibleName('Ethereum ETH');
  });

  it('sorts by allocation when selected', () => {
    renderList();
    fireEvent.change(screen.getByDisplayValue('Maior variação'), { target: { value: 'allocation' } });
    const rows = screen.getAllByRole('button');
    expect(rows[0]).toHaveAccessibleName('Bitcoin BTC');
    expect(rows[2]).toHaveAccessibleName('Solana SOL');
  });

  it('rows scroll inside a fixed-height container', () => {
    renderList();
    expect(document.querySelector('.assets-list-rows')).toBeInTheDocument();
  });

  it('calls onSelectAsset with the clicked row\'s coinId', () => {
    const onSelectAsset = renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Bitcoin BTC' }));
    expect(onSelectAsset).toHaveBeenCalledWith('bitcoin');
  });
});

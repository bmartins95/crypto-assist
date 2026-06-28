import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HistoryTab from './HistoryTab';
import type { Op } from '@/lib/types';
import { LocaleProvider } from '@/context/LocaleContext';
import { BalanceProvider } from '@/context/BalanceContext';

vi.mock('@/lib/coingecko', () => ({
  searchCoins: vi.fn(async () => []),
  fetchSinglePrice: vi.fn(async () => null),
}));

const baseProps = {
  ops: [] as Op[],
  assets: [],
  prices: {},
  onAddOp: vi.fn(),
  onEditOp: vi.fn(),
  onRemoveOp: vi.fn(),
};

const existingOp: Op = {
  id: 'op-1',
  date: '2024-01-15',
  coinId: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  type: 'Buy',
  qty: 0.5,
  price: 200000,
  fee: 5,
  total: 100005,
  platform: 'Binance',
};

const STORAGE_KEY = 'crypto-assist:locale';

function renderWithLocale(ui: React.ReactElement) {
  return render(<LocaleProvider><BalanceProvider>{ui}</BalanceProvider></LocaleProvider>);
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('HistoryTab', () => {
  it('shows the empty state when there are no operations', () => {
    renderWithLocale(<HistoryTab {...baseProps} />);
    expect(screen.getByText('Nenhuma operação registrada')).toBeInTheDocument();
  });

  it('lists existing operations', () => {
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} />);
    expect(screen.getByText('BTC')).toBeInTheDocument();
    expect(screen.getByText('Binance')).toBeInTheDocument();
    // "Compra" also appears as a <option> in the Tipo select, so scope to the pill.
    const pill = document.querySelector('.op-list-row .pill');
    expect(pill).toHaveTextContent('Compra');
  });

  it('does not submit the operation form without a selected coin', () => {
    const onAddOp = vi.fn();
    renderWithLocale(<HistoryTab {...baseProps} onAddOp={onAddOp} />);
    // The first "Registrar" button belongs to the operation form (the
    // second belongs to the trade-between-assets form).
    fireEvent.click(screen.getAllByText('Registrar')[0]);
    expect(onAddOp).not.toHaveBeenCalled();
  });

  it('calls onRemoveOp when clicking the delete button on a row', () => {
    const onRemoveOp = vi.fn();
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} onRemoveOp={onRemoveOp} />);
    fireEvent.click(screen.getByTitle('Excluir'));
    expect(onRemoveOp).toHaveBeenCalledWith('op-1');
  });

  it('loads an operation into the form for editing', () => {
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} />);
    fireEvent.click(screen.getByTitle('Editar operação'));
    expect(screen.getByText('Editar operação')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0.5')).toBeInTheDocument();
  });

  it('shows translated op type labels in es-ES locale', () => {
    localStorage.setItem(STORAGE_KEY, 'es-ES');
    const sellOp: Op = { ...existingOp, id: 'op-sell', type: 'Sell' };
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp, sellOp]} />);
    const pills = document.querySelectorAll('.op-list-row .pill');
    const texts = Array.from(pills).map(p => p.textContent);
    expect(texts).toContain('Compra');
    expect(texts).toContain('Venta');
  });
});

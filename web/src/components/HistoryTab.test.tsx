import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HistoryTab from './HistoryTab';
import type { Op, Asset } from '@/lib/types';
import { LocaleProvider } from '@/context/LocaleContext';
import { BalanceProvider } from '@/context/BalanceContext';
import { CurrencyProvider } from '@/context/CurrencyContext';

beforeEach(() => {
  localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify({ BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 }));
});
import { searchCoins } from '@/lib/coingecko';

function realFilterCoinList(list: { id: string; symbol: string; name: string }[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return list.filter(c => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
}

vi.mock('@/lib/coingecko', () => ({
  searchCoins: vi.fn(async () => []),
  fetchSinglePrice: vi.fn(async () => null),
  getCoinList: vi.fn(() => Promise.reject(new Error('coin list unavailable in tests'))),
  filterCoinList: vi.fn((list: { id: string; symbol: string; name: string }[], query: string) => realFilterCoinList(list, query)),
}));

async function selectCoin(input: HTMLElement, result: { id: string; symbol: string; name: string }) {
  vi.mocked(searchCoins).mockResolvedValueOnce([{ id: result.id, symbol: result.symbol, name: result.name, market_cap_rank: 1 }]);
  fireEvent.change(input, { target: { value: result.name.slice(0, 3) } });
  await screen.findByText(result.name);
  fireEvent.click(screen.getByText(result.name));
}

function selectFromAsset(input: HTMLElement, name: string) {
  fireEvent.change(input, { target: { value: name.slice(0, 3) } });
  fireEvent.click(screen.getByText(name));
}

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
  return render(<LocaleProvider><BalanceProvider><CurrencyProvider>{ui}</CurrencyProvider></BalanceProvider></LocaleProvider>);
}

beforeEach(() => { localStorage.clear(); localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify({ BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 })); });
afterEach(() => { localStorage.clear(); localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify({ BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 })); });

describe('HistoryTab', () => {
  it('shows the content header and register-operation button', () => {
    renderWithLocale(<HistoryTab {...baseProps} />);
    expect(screen.getByText('Histórico')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registrar operação/ })).toBeInTheDocument();
  });

  it('shows the empty state when there are no operations', () => {
    renderWithLocale(<HistoryTab {...baseProps} />);
    expect(screen.getByText('Nenhuma operação registrada')).toBeInTheDocument();
  });

  it('lists existing operations with no form fields above the table', () => {
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} />);
    expect(screen.getByText('BTC')).toBeInTheDocument();
    expect(screen.getByText('Binance')).toBeInTheDocument();
    const tag = document.querySelector('.tbl tbody .tag');
    expect(tag).toHaveTextContent('Compra');
    expect(document.querySelector('.drawer')).not.toHaveClass('open');
  });

  it('opens the drawer when clicking "Registrar operação"', () => {
    renderWithLocale(<HistoryTab {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Registrar operação/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls onRemoveOp when clicking the delete button on a row', () => {
    const onRemoveOp = vi.fn();
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} onRemoveOp={onRemoveOp} />);
    fireEvent.click(screen.getByTitle('Excluir'));
    expect(onRemoveOp).toHaveBeenCalledWith('op-1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the drawer pre-filled when clicking a row\'s edit icon', () => {
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} />);
    fireEvent.click(screen.getByTitle('Editar operação'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Editar operação').length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('0.5')).toBeInTheDocument();
  });

  it('submitting a new Buy via the drawer calls onAddOp, not onEditOp', async () => {
    const onAddOp = vi.fn();
    const onEditOp = vi.fn();
    renderWithLocale(<HistoryTab {...baseProps} onAddOp={onAddOp} onEditOp={onEditOp} />);
    fireEvent.click(screen.getByRole('button', { name: /Registrar operação/ }));
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '50' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(onAddOp).toHaveBeenCalledWith(expect.objectContaining({ type: 'Buy', coinId: 'bitcoin' }));
    expect(onEditOp).not.toHaveBeenCalled();
    await new Promise(r => setTimeout(r, 1350));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('submitting an edited operation via the drawer calls onEditOp with the original id', () => {
    const onAddOp = vi.fn();
    const onEditOp = vi.fn();
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} onAddOp={onAddOp} onEditOp={onEditOp} />);
    fireEvent.click(screen.getByTitle('Editar operação'));
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '3' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(onEditOp).toHaveBeenCalledWith('op-1', expect.objectContaining({ qty: 3 }));
    expect(onAddOp).not.toHaveBeenCalled();
  });

  it('submitting a Trade via the drawer calls onAddOp twice (sell then buy)', async () => {
    const onAddOp = vi.fn();
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderWithLocale(<HistoryTab {...baseProps} assets={assets} onAddOp={onAddOp} />);
    fireEvent.click(screen.getByRole('button', { name: /Registrar operação/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    const [fromQtyEl, toQtyEl] = screen.getAllByLabelText('Quantidade');
    fireEvent.change(fromQtyEl, { target: { value: '1' } });
    await selectCoin(toAssetEl, { id: 'solana', symbol: 'sol', name: 'Solana' });
    fireEvent.change(toQtyEl, { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/^Total/), { target: { value: '500' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    await waitFor(() => expect(onAddOp).toHaveBeenCalledTimes(2));
    expect(onAddOp).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: 'Sell', coinId: 'ethereum' }));
    expect(onAddOp).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: 'Buy', coinId: 'solana' }));
  });

  it('shows translated op type labels in es-ES locale', () => {
    localStorage.setItem(STORAGE_KEY, 'es-ES');
    const sellOp: Op = { ...existingOp, id: 'op-sell', type: 'Sell' };
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp, sellOp]} />);
    const pills = document.querySelectorAll('.tbl tbody .tag');
    const texts = Array.from(pills).map(p => p.textContent);
    expect(texts).toContain('Compra');
    expect(texts).toContain('Venta');
  });
});

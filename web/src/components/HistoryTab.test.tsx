import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HistoryTab from './HistoryTab';
import type { Op } from '@/lib/types';
import { LocaleProvider } from '@/context/LocaleContext';
import { BalanceProvider } from '@/context/BalanceContext';
import { CurrencyProvider } from '@/context/CurrencyContext';

beforeEach(() => {
  localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify({ BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 }));
});
import { api } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  api: {
    searchCoins: vi.fn(async () => []),
    getPrices: vi.fn(async () => ({})),
    getExchangeRates: vi.fn(async () => ({ rates: { BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 }, updatedAt: '2026-01-01T00:00:00Z' })),
    getPlatformExchanges: vi.fn(async () => ({ exchanges: [{ id: 'binance', name: 'Binance', kind: 'exchange' }], updatedAt: '2026-01-01T00:00:00Z' })),
  },
}));

async function selectCoin(input: HTMLElement, result: { id: string; symbol: string; name: string }) {
  vi.mocked(api.searchCoins).mockResolvedValueOnce([{ id: result.id, symbol: result.symbol, name: result.name, market_cap_rank: 1 }]);
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
  avatarCache: {},
  prices: {},
  closures: [] as import('@crypto-assist/shared').OpClosure[],
  onAddOp: vi.fn(),
  onEditOp: vi.fn(),
  onRemoveOp: vi.fn(),
  onCloseOp: vi.fn(),
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
  platformId: 'binance',
  platformName: 'Binance',
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

  it('shows a catalog-matched platform as plain text, with no logo or tag', async () => {
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} />);
    await waitFor(() => expect(screen.getByText('Binance')).toBeInTheDocument());
    expect(document.querySelector('.tbl tbody .plogo')).not.toBeInTheDocument();
    expect(screen.queryByText('Personalizada')).not.toBeInTheDocument();
  });

  it('shows a custom (non-catalog) platform as plain text too, with no tag', () => {
    const customOp: Op = { ...existingOp, id: 'op-custom', platformId: 'custom:sodex', platformName: 'Sodex' };
    renderWithLocale(<HistoryTab {...baseProps} ops={[customOp]} />);
    expect(screen.getByText('Sodex')).toBeInTheDocument();
    expect(screen.queryByText('Personalizada')).not.toBeInTheDocument();
  });

  it('shows the empty-state dash for an operation with no platform, in the expanded detail', () => {
    const noPlatformOp: Op = { ...existingOp, id: 'op-none', platformId: undefined, platformName: undefined };
    renderWithLocale(<HistoryTab {...baseProps} ops={[noPlatformOp]} />);
    const platformCell = document.querySelectorAll('.history-detail-grid > div')[2];
    expect(platformCell).toHaveTextContent('—');
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
    expect(screen.getByRole('dialog')).toBeInTheDocument();
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
    const ethOp: Op = {
      id: 'eth-1', date: '2024-01-01', coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum',
      type: 'Buy', qty: 2, price: 100, fee: 0, total: 200,
      platformId: 'custom:kraken', platformName: 'Kraken',
    };
    renderWithLocale(<HistoryTab {...baseProps} ops={[ethOp]} onAddOp={onAddOp} />);
    fireEvent.click(screen.getByRole('button', { name: /Registrar operação/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    const originInput = screen.getByLabelText('Plataforma de origem');
    fireEvent.focus(originInput);
    fireEvent.change(originInput, { target: { value: 'Kraken' } });
    fireEvent.click(screen.getByText('Kraken', { selector: '.n' }));
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    const [fromQtyEl, toQtyEl] = screen.getAllByLabelText('Quantidade');
    fireEvent.change(fromQtyEl, { target: { value: '1' } });
    await selectCoin(toAssetEl, { id: 'solana', symbol: 'sol', name: 'Solana' });
    fireEvent.change(toQtyEl, { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/^Total/), { target: { value: '500' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    await waitFor(() => expect(onAddOp).toHaveBeenCalledTimes(2));
    expect(onAddOp).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: 'Sell', coinId: 'ethereum', platformId: 'custom:kraken', platformName: 'Kraken' }));
    expect(onAddOp).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: 'Buy', coinId: 'solana', platformId: 'custom:kraken', platformName: 'Kraken' }));
    const g1 = onAddOp.mock.calls[0][0].tradeGroupId;
    expect(g1).toBeTruthy();
    expect(onAddOp.mock.calls[1][0].tradeGroupId).toBe(g1);
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

  it('reflects the selected currency in the subtitle instead of a hardcoded value', () => {
    localStorage.setItem('crypto-assist:currency', 'GBP');
    renderWithLocale(<HistoryTab {...baseProps} />);
    expect(screen.getByText(/· GBP/)).toBeInTheDocument();
    expect(screen.queryByText(/· BRL/)).not.toBeInTheDocument();
  });

  it('shows an "open" status with no P/L figure for an operation with no closures', () => {
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} />);
    expect(screen.getByText('Aberta')).toBeInTheDocument();
    const pnlCell = document.querySelectorAll('.history-row td')[4];
    expect(pnlCell).toHaveTextContent('—');
  });

  it('shows a "partial" status and a realized P/L figure for a partially-closed operation', () => {
    const closures = [{ id: 'c1', sourceOpId: 'op-1', closingOpId: 'op-2', qtyClosed: 0.2, realizedPnl: 10 }];
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} closures={closures} />);
    expect(screen.getByText('Parcial')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*10,00/)).toBeInTheDocument();
  });

  it('shows a "closed" status for a fully-closed operation and hides its close action', () => {
    const closures = [{ id: 'c1', sourceOpId: 'op-1', closingOpId: 'op-2', qtyClosed: 0.5, realizedPnl: 25 }];
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} closures={closures} />);
    expect(screen.getByText('Fechada')).toBeInTheDocument();
    expect(screen.queryByTitle('Fechar operação')).not.toBeInTheDocument();
  });

  it('shows the close action for an open row, opening the drawer pre-filled and restricted', () => {
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} />);
    fireEvent.click(screen.getByTitle('Fechar operação'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Venda' })).toHaveClass('active');
    expect(screen.queryByRole('button', { name: 'Compra' })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('0.5')).toBeInTheDocument();
  });

  it('closes a Buy via Trade with a different output coin: one received op via onCloseOp, no extra onAddOp', async () => {
    const onCloseOp = vi.fn();
    const onAddOp = vi.fn();
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} onCloseOp={onCloseOp} onAddOp={onAddOp} />);
    fireEvent.click(screen.getByTitle('Fechar operação'));
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    // The "sell" side is fixed to the row being closed (a static display, not a
    // labeled field), so only the "receive" side's asset/quantity fields exist.
    await selectCoin(screen.getByLabelText('Ativo'), { id: 'solana', symbol: 'sol', name: 'Solana' });
    fireEvent.change(screen.getAllByLabelText('Quantidade')[1], { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/^Total/), { target: { value: '500' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    // The received Solana IS the close (qtyToClose is the BTC amount) — no separate BTC Sell op.
    await waitFor(() => expect(onCloseOp).toHaveBeenCalledWith(
      'op-1', expect.objectContaining({ type: 'Buy', coinId: 'solana', qty: 5 }), 0.5,
    ));
    expect(onAddOp).not.toHaveBeenCalled();
  });

  it('calls onCloseOp with the source op id when submitting a close', async () => {
    const onCloseOp = vi.fn();
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} onCloseOp={onCloseOp} />);
    fireEvent.click(screen.getByTitle('Fechar operação'));
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '250000' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    await waitFor(() => expect(onCloseOp).toHaveBeenCalledWith('op-1', expect.objectContaining({ type: 'Sell', qty: 0.5 }), 0.5));
  });

  it('shows a success toast after a close completes', async () => {
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} onCloseOp={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Fechar operação'));
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '250000' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    await waitFor(() => expect(screen.getByText('Operação fechada com sucesso')).toBeInTheDocument());
  });

  it('shows a leverage badge next to the type chip when the operation has one', () => {
    const leveraged: Op = { ...existingOp, leverage: 3 };
    renderWithLocale(<HistoryTab {...baseProps} ops={[leveraged]} />);
    expect(document.querySelector('.tbl .lev-badge')).toHaveTextContent('3x');
  });

  it('shows no leverage badge for a plain (unleveraged) operation', () => {
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} />);
    expect(document.querySelector('.lev-badge')).not.toBeInTheDocument();
  });

  it('groups operations by day with a date-section header per distinct day', () => {
    const day2: Op = { ...existingOp, id: 'op-2', date: '2024-01-16' };
    const day2b: Op = { ...existingOp, id: 'op-3', date: '2024-01-16' };
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp, day2, day2b]} />);
    const headers = document.querySelectorAll('.history-group-header');
    expect(headers).toHaveLength(2);
    const rows = document.querySelectorAll('.history-row');
    expect(rows).toHaveLength(3);
  });

  it('collapses row detail by default and expands it on click, showing price/fee/platform', () => {
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} />);
    const detail = document.querySelector('.history-detail');
    expect(detail).not.toHaveClass('expanded');
    fireEvent.click(document.querySelector('.history-row')!);
    expect(detail).toHaveClass('expanded');
    const [priceCell, feeCell, platformCell] = document.querySelectorAll('.history-detail-grid > div');
    expect(priceCell).toHaveTextContent('R$');
    expect(feeCell).toHaveTextContent('R$');
    expect(platformCell).toHaveTextContent('Binance');
    fireEvent.click(document.querySelector('.history-row')!);
    expect(detail).not.toHaveClass('expanded');
  });

  it('does not toggle row expansion when clicking a row action (close/edit/delete)', () => {
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} />);
    const detail = document.querySelector('.history-detail');
    fireEvent.click(screen.getByTitle('Editar operação'));
    expect(detail).not.toHaveClass('expanded');
  });

  it('shows no per-row date column in the main row (the day-group header already shows it)', () => {
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} />);
    const headerCells = document.querySelectorAll('.tbl thead th');
    const headerTexts = Array.from(headerCells).map(c => c.textContent);
    expect(headerTexts).not.toContain('Data');
  });
});

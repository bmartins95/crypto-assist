import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HistoryTab from './HistoryTab';
import type { Op } from '@/lib/types';
import { LocaleProvider } from '@/context/LocaleContext';
import { ToastProvider } from '@/context/ToastContext';
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
  onRemoveOp: vi.fn(async () => {}),
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

// A trade (leveraged) position — status, close action, and leverage badges only apply
// to these under item 28's wallet/trade split; existingOp above is a plain wallet op.
const tradeOp: Op = {
  ...existingOp,
  id: 'trade-1',
  kind: 'trade',
  side: 'long',
  leverage: 3,
};

const STORAGE_KEY = 'crypto-assist:locale';

function renderWithLocale(ui: React.ReactElement) {
  return render(<LocaleProvider><ToastProvider><BalanceProvider><CurrencyProvider>{ui}</CurrencyProvider></BalanceProvider></ToastProvider></LocaleProvider>);
}

beforeEach(() => { localStorage.clear(); localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify({ BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 })); });
afterEach(() => { localStorage.clear(); localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify({ BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 })); });

describe('HistoryTab', () => {
  it('shows the content header and both register-operation buttons', () => {
    renderWithLocale(<HistoryTab {...baseProps} />);
    expect(screen.getByText('Histórico')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Movimentar carteira/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Novo trade/ })).toBeInTheDocument();
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

  it('opens the drawer in wallet mode when clicking "Movimentar carteira"', () => {
    renderWithLocale(<HistoryTab {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Movimentar carteira/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Troca' })).toBeInTheDocument();
  });

  it('opens the drawer in trade mode when clicking "Novo trade"', () => {
    renderWithLocale(<HistoryTab {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Novo trade/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Compra · Long')).toBeInTheDocument();
  });

  it('calls onRemoveOp when clicking the delete button on a row', () => {
    const onRemoveOp = vi.fn(async () => {});
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
    fireEvent.click(screen.getByRole('button', { name: /Movimentar carteira/ }));
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '50' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(onAddOp).toHaveBeenCalledWith(expect.objectContaining({ type: 'Buy', coinId: 'bitcoin' }));
    expect(onEditOp).not.toHaveBeenCalled();
    await waitFor(() => expect(document.querySelector('.btn-submit .spinner')).not.toBeInTheDocument());
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
    fireEvent.click(screen.getByRole('button', { name: /Movimentar carteira/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    const originInput = screen.getByLabelText('Plataforma de origem');
    fireEvent.focus(originInput);
    fireEvent.change(originInput, { target: { value: 'Kraken' } });
    fireEvent.click(screen.getByText('Kraken', { selector: '.n' }));
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    const [fromQtyEl] = screen.getAllByLabelText('Quantidade');
    fireEvent.change(fromQtyEl, { target: { value: '1' } });
    await selectCoin(toAssetEl, { id: 'solana', symbol: 'sol', name: 'Solana' });
    const [fromPriceEl, toPriceEl] = screen.getAllByLabelText('Preço unit.');
    fireEvent.change(fromPriceEl, { target: { value: '500' } });
    fireEvent.change(toPriceEl, { target: { value: '100' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    await waitFor(() => expect(onAddOp).toHaveBeenCalledTimes(2));
    expect(onAddOp).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: 'Sell', coinId: 'ethereum', platformId: 'custom:kraken', platformName: 'Kraken' }));
    expect(onAddOp).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: 'Buy', coinId: 'solana', platformId: 'custom:kraken', platformName: 'Kraken' }));
    const g1 = onAddOp.mock.calls[0][0].tradeGroupId;
    expect(g1).toBeTruthy();
    expect(onAddOp.mock.calls[1][0].tradeGroupId).toBe(g1);
  });

  it('never attempts the buy leg of a swap when the sell leg is rejected — no orphaned single-leg swap', async () => {
    // Reproduces a real bug: onAddOp used to swallow its own failure (AppLayout showed
    // an alert but never rethrew), so this function kept going and created the buy leg
    // even though the sell leg (e.g. insufficient balance) had just failed — leaving a
    // tradeGroupId with only one leg in the database.
    const onAddOp = vi.fn().mockRejectedValueOnce(new Error('insufficient balance'));
    const ethOp: Op = {
      id: 'eth-1', date: '2024-01-01', coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum',
      type: 'Buy', qty: 2, price: 100, fee: 0, total: 200,
      platformId: 'custom:kraken', platformName: 'Kraken',
    };
    renderWithLocale(<HistoryTab {...baseProps} ops={[ethOp]} onAddOp={onAddOp} />);
    fireEvent.click(screen.getByRole('button', { name: /Movimentar carteira/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    const originInput = screen.getByLabelText('Plataforma de origem');
    fireEvent.focus(originInput);
    fireEvent.change(originInput, { target: { value: 'Kraken' } });
    fireEvent.click(screen.getByText('Kraken', { selector: '.n' }));
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    const [fromQtyEl] = screen.getAllByLabelText('Quantidade');
    fireEvent.change(fromQtyEl, { target: { value: '1' } });
    await selectCoin(toAssetEl, { id: 'solana', symbol: 'sol', name: 'Solana' });
    const [fromPriceEl, toPriceEl] = screen.getAllByLabelText('Preço unit.');
    fireEvent.change(fromPriceEl, { target: { value: '500' } });
    fireEvent.change(toPriceEl, { target: { value: '100' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    await waitFor(() => expect(onAddOp).toHaveBeenCalledTimes(1));
    expect(onAddOp).toHaveBeenCalledWith(expect.objectContaining({ type: 'Sell', coinId: 'ethereum' }));
    // Give any (incorrect) second call a chance to fire before asserting it didn't.
    await new Promise(r => setTimeout(r, 50));
    expect(onAddOp).toHaveBeenCalledTimes(1);
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

  it('shows no status and no close action for a wallet operation', () => {
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} />);
    expect(screen.queryByText('Aberta')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Fechar operação')).not.toBeInTheDocument();
    const statusCell = document.querySelectorAll('.history-row td')[5];
    expect(statusCell).toHaveTextContent('—');
  });

  it('shows an "open" status with no P/L figure for a trade with no closures', () => {
    renderWithLocale(<HistoryTab {...baseProps} ops={[tradeOp]} />);
    expect(screen.getByText('Aberta')).toBeInTheDocument();
    const pnlCell = document.querySelectorAll('.history-row td')[4];
    expect(pnlCell).toHaveTextContent('—');
  });

  it('shows a "partial" status and a realized P/L figure for a partially-closed trade', () => {
    const closures = [{ id: 'c1', sourceOpId: 'trade-1', closingOpId: 'op-2', qtyClosed: 0.2, realizedPnl: 10 }];
    renderWithLocale(<HistoryTab {...baseProps} ops={[tradeOp]} closures={closures} />);
    expect(screen.getByText('Parcial')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*10,00/)).toBeInTheDocument();
  });

  it('shows a "closed" status for a fully-closed trade and hides its close action', () => {
    const closures = [{ id: 'c1', sourceOpId: 'trade-1', closingOpId: 'op-2', qtyClosed: 0.5, realizedPnl: 25 }];
    renderWithLocale(<HistoryTab {...baseProps} ops={[tradeOp]} closures={closures} />);
    expect(screen.getByText('Fechada')).toBeInTheDocument();
    expect(screen.queryByTitle('Fechar operação')).not.toBeInTheDocument();
  });

  it('shows the close action for an open trade row, opening the drawer locked to the resolving type', () => {
    renderWithLocale(<HistoryTab {...baseProps} ops={[tradeOp]} />);
    fireEvent.click(screen.getByTitle('Fechar operação'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Venda' })).toHaveClass('active');
    expect(screen.queryByRole('button', { name: 'Compra' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Troca' })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('0.5')).toBeInTheDocument();
  });

  it('calls onCloseOp with the source op id when submitting a trade close', async () => {
    const onCloseOp = vi.fn();
    renderWithLocale(<HistoryTab {...baseProps} ops={[tradeOp]} onCloseOp={onCloseOp} />);
    fireEvent.click(screen.getByTitle('Fechar operação'));
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '250000' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    await waitFor(() => expect(onCloseOp).toHaveBeenCalledWith('trade-1', expect.objectContaining({ type: 'Sell', qty: 0.5 }), 0.5));
  });

  it('shows a success toast after a close completes', async () => {
    renderWithLocale(<HistoryTab {...baseProps} ops={[tradeOp]} onCloseOp={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Fechar operação'));
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '250000' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    await waitFor(() => expect(screen.getByText('Operação fechada com sucesso')).toBeInTheDocument());
  });

  it('shows a success toast after adding a new operation', async () => {
    renderWithLocale(<HistoryTab {...baseProps} onAddOp={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Movimentar carteira/ }));
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '50' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    await waitFor(() => expect(screen.getByText('Operação registrada com sucesso')).toBeInTheDocument());
  });

  it('shows a success toast after editing an operation', async () => {
    renderWithLocale(<HistoryTab {...baseProps} ops={[existingOp]} onEditOp={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Editar operação'));
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '3' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    await waitFor(() => expect(screen.getByText('Operação salva com sucesso')).toBeInTheDocument());
  });

  it('shows a leverage badge and a Long pill for a leveraged long trade', () => {
    renderWithLocale(<HistoryTab {...baseProps} ops={[tradeOp]} />);
    expect(document.querySelector('.tbl .lev-badge')).toHaveTextContent('3x');
    expect(document.querySelector('.tbl .tag.long')).toHaveTextContent('Long');
  });

  it('shows a Short pill for a short trade', () => {
    const shortOp: Op = { ...tradeOp, id: 'trade-2', side: 'short' };
    renderWithLocale(<HistoryTab {...baseProps} ops={[shortOp]} />);
    expect(document.querySelector('.tbl .tag.short')).toHaveTextContent('Short');
    expect(document.querySelector('.tbl .tag.long')).not.toBeInTheDocument();
  });

  it('shows no leverage badge for a wallet (unleveraged) operation', () => {
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

  describe('wallet edit/delete recompute safety (User Story 5)', () => {
    const oldBuy: Op = { ...existingOp, id: 'buy-1', date: '2024-01-01', qty: 1 };
    const laterSell: Op = { ...existingOp, id: 'sell-1', date: '2024-01-10', type: 'Sell', qty: 0.3 };

    it('shows a confirmation dialog before applying an edit that affects a later sell', () => {
      const onEditOp = vi.fn();
      renderWithLocale(<HistoryTab {...baseProps} ops={[oldBuy, laterSell]} onEditOp={onEditOp} />);
      fireEvent.click(screen.getAllByTitle('Editar operação')[0]);
      fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '999' } });
      fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(onEditOp).not.toHaveBeenCalled();
    });

    it('applies the edit once the confirmation dialog is accepted', () => {
      const onEditOp = vi.fn();
      renderWithLocale(<HistoryTab {...baseProps} ops={[oldBuy, laterSell]} onEditOp={onEditOp} />);
      fireEvent.click(screen.getAllByTitle('Editar operação')[0]);
      fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '999' } });
      fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
      fireEvent.click(screen.getByRole('button', { name: 'Continuar mesmo assim' }));
      expect(onEditOp).toHaveBeenCalledWith('buy-1', expect.objectContaining({ price: 999 }));
    });

    it('discards the edit when the confirmation dialog is cancelled', () => {
      const onEditOp = vi.fn();
      renderWithLocale(<HistoryTab {...baseProps} ops={[oldBuy, laterSell]} onEditOp={onEditOp} />);
      fireEvent.click(screen.getAllByTitle('Editar operação')[0]);
      fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '999' } });
      fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
      fireEvent.click(screen.getByRole('alertdialog').querySelector('.confirm-dialog-actions button')!);
      expect(onEditOp).not.toHaveBeenCalled();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('shows a confirmation dialog before deleting a buy that a later sell partly depends on, once a buffer buy remains', () => {
      // Deleting buy-1 alone doesn't go negative (buy-2 still covers sell-1's 0.3), but it
      // does change which lot the sell draws from — an "affected", not "blocked", case.
      const bufferBuy: Op = { ...existingOp, id: 'buy-2', date: '2024-01-05', qty: 5, price: 100 };
      const onRemoveOp = vi.fn(async () => {});
      renderWithLocale(<HistoryTab {...baseProps} ops={[oldBuy, bufferBuy, laterSell]} onRemoveOp={onRemoveOp} />);
      fireEvent.click(screen.getAllByTitle('Excluir')[0]);
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(onRemoveOp).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Continuar mesmo assim' }));
      expect(onRemoveOp).toHaveBeenCalledWith('buy-1');
    });

    it('blocks (no dialog) a delete that would leave a negative balance', () => {
      const onRemoveOp = vi.fn(async () => {});
      renderWithLocale(<HistoryTab {...baseProps} ops={[oldBuy, laterSell]} onRemoveOp={onRemoveOp} />);
      fireEvent.click(screen.getAllByTitle('Excluir')[0]);
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(onRemoveOp).not.toHaveBeenCalled();
      expect(screen.getByText('Esta alteração deixaria um saldo negativo para este ativo/plataforma.')).toBeInTheDocument();
    });

    it('blocks (no dialog) an edit that would leave a negative balance, showing an error toast', () => {
      const onEditOp = vi.fn();
      renderWithLocale(<HistoryTab {...baseProps} ops={[oldBuy, laterSell]} onEditOp={onEditOp} />);
      fireEvent.click(screen.getAllByTitle('Editar operação')[0]);
      fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '0.1' } });
      fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(onEditOp).not.toHaveBeenCalled();
      expect(screen.getByText('Esta alteração deixaria um saldo negativo para este ativo/plataforma.')).toBeInTheDocument();
    });

    it('applies an edit with no dialog when no later operation is affected', () => {
      const onEditOp = vi.fn();
      renderWithLocale(<HistoryTab {...baseProps} ops={[oldBuy]} onEditOp={onEditOp} />);
      fireEvent.click(screen.getByTitle('Editar operação'));
      fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '999' } });
      fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(onEditOp).toHaveBeenCalledWith('buy-1', expect.objectContaining({ price: 999 }));
    });

    it('skips the wallet-impact check entirely for a trade op (edit/delete proceed with no dialog)', () => {
      const onEditOp = vi.fn();
      const onRemoveOp = vi.fn(async () => {});
      renderWithLocale(<HistoryTab {...baseProps} ops={[tradeOp]} onEditOp={onEditOp} onRemoveOp={onRemoveOp} />);
      fireEvent.click(screen.getByTitle('Editar operação'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      fireEvent.click(document.querySelector('.drawer-foot .btn')!);
      fireEvent.click(screen.getByTitle('Excluir'));
      expect(onRemoveOp).toHaveBeenCalledWith('trade-1');
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  describe('swap rows (collapsed wallet pairs)', () => {
    const swapSell: Op = { ...existingOp, id: 'swap-sell', type: 'Sell', symbol: 'BTC', qty: 1, tradeGroupId: 'grp-1' };
    const swapBuy: Op = { ...existingOp, id: 'swap-buy', type: 'Buy', symbol: 'SOL', qty: 20, total: 2000, tradeGroupId: 'grp-1' };

    it('renders a swap pair as a single collapsed row with both assets/quantities and no P/L or status', () => {
      renderWithLocale(<HistoryTab {...baseProps} ops={[swapSell, swapBuy]} />);
      expect(screen.getByText('BTC→SOL')).toBeInTheDocument();
      expect(document.querySelector('.history-row .tag.swap')).toHaveTextContent('Troca');
      const cells = document.querySelectorAll('.history-row td');
      expect(cells[4]).toHaveTextContent('—');
      expect(cells[5]).toHaveTextContent('—');
      expect(document.querySelectorAll('.history-row')).toHaveLength(1);
    });

    it('deleting a collapsed swap row removes the sell leg (which cascades the whole group)', () => {
      const onRemoveOp = vi.fn(async () => {});
      renderWithLocale(<HistoryTab {...baseProps} ops={[swapSell, swapBuy]} onRemoveOp={onRemoveOp} />);
      fireEvent.click(screen.getByTitle('Excluir'));
      expect(onRemoveOp).toHaveBeenCalledWith('swap-sell');
    });

    it('expands the swap row detail on click, showing the sell leg\'s price/fee/platform', () => {
      renderWithLocale(<HistoryTab {...baseProps} ops={[swapSell, swapBuy]} />);
      const detail = document.querySelector('.history-detail');
      expect(detail).not.toHaveClass('expanded');
      fireEvent.click(document.querySelector('.history-row')!);
      expect(detail).toHaveClass('expanded');
    });
  });
});

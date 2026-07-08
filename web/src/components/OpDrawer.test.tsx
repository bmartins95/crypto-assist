import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OpDrawer from './OpDrawer';
import type { Op, Asset } from '@/lib/types';
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
  },
}));

// api.getPrices([coinId]) resolves { [coinId]: { price, image } }; this keys the
// response off whichever id was actually requested, mirroring the old
// fetchSinglePrice(coinId) helper's "next call resolves to this price" semantics.
function mockGetPricesOnce(price: number) {
  vi.mocked(api.getPrices).mockImplementationOnce(async (ids: string[]) => ({ [ids[0]]: { price, image: null } }));
}

function mockGetPricesRejectOnce(error: Error) {
  vi.mocked(api.getPrices).mockRejectedValueOnce(error);
}

function renderDrawer(ui: React.ReactElement) {
  return render(<LocaleProvider><BalanceProvider><CurrencyProvider>{ui}</CurrencyProvider></BalanceProvider></LocaleProvider>);
}

const editingOp: Op = {
  id: 'op-9',
  date: '2024-02-01',
  coinId: 'ethereum',
  symbol: 'ETH',
  name: 'Ethereum',
  type: 'Sell',
  qty: 2,
  price: 100,
  fee: 1,
  total: 199,
  platform: 'Kraken',
};

async function selectCoin(input: HTMLElement, result: { id: string; symbol: string; name: string }) {
  vi.mocked(api.searchCoins).mockResolvedValueOnce([{ id: result.id, symbol: result.symbol, name: result.name, market_cap_rank: 1 }]);
  fireEvent.change(input, { target: { value: result.name.slice(0, 3) } });
  await screen.findByText(result.name, {}, { timeout: 2000 });
  fireEvent.click(screen.getByText(result.name));
}

const waitForClose = () => new Promise(r => setTimeout(r, 1350));

beforeEach(() => { localStorage.clear(); localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify({ BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 })); document.body.style.overflow = ''; });
afterEach(() => {
  localStorage.clear(); localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify({ BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 }));
  document.body.style.overflow = '';
});

function selectFromAsset(input: HTMLElement, name: string) {
  fireEvent.change(input, { target: { value: name.slice(0, 3) } });
  fireEvent.click(screen.getByText(name));
}

describe('OpDrawer', () => {
  it('is hidden from the accessibility tree when closed (stays mounted for the slide animation)', () => {
    renderDrawer(<OpDrawer open={false} onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('.drawer')).not.toHaveClass('open');
  });

  it('opens in Buy mode by default with focus on the first field', async () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(document.querySelector('.drawer')).toHaveClass('open');
    expect(screen.getByRole('button', { name: 'Compra' })).toHaveClass('active');
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('drawer-date')));
  });

  it('exposes dialog accessibility attributes', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'drawer-title');
  });

  it('blocks submission and shows a validation message when required fields are missing', () => {
    const onSubmit = vi.fn();
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={onSubmit} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Preencha todos os campos obrigatórios.')).toBeInTheDocument();
  });

  it('submits a valid Buy with an auto-calculated total, then closes after the loading/done animation', async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={onSubmit} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2024-03-10' } });
    fireEvent.change(screen.getByLabelText('Plataforma'), { target: { value: 'Binance' } });
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Taxa'), { target: { value: '5' } });
    expect((screen.getByLabelText('Total') as HTMLInputElement).value).toBe('205.00');
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'Buy', coinId: 'bitcoin', qty: 2, price: 100, fee: 5, total: 205,
      date: '2024-03-10', platform: 'Binance',
    }));
    await waitForClose();
    expect(onClose).toHaveBeenCalled();
  });

  it('switches to Sell and submits with type Sell', async () => {
    const onSubmit = vi.fn();
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={onSubmit} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Venda' }));
    await selectCoin(screen.getByLabelText('Moeda vendida'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '100' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: 'Sell', qty: 1, price: 100 }));
  });

  it('returns to idle without closing when onSubmit rejects', async () => {
    const onSubmit = vi.fn(() => Promise.reject(new Error('network error')));
    const onClose = vi.fn();
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={onSubmit} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '100' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    await waitFor(() => expect(document.querySelector('.drawer-foot .btn-submit')).not.toBeDisabled());
    expect(document.querySelector('.btn-submit.done')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('returns to idle without closing when onSubmitTrade rejects', async () => {
    const onSubmitTrade = vi.fn(() => Promise.reject(new Error('network error')));
    const onClose = vi.fn();
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={vi.fn()} onSubmitTrade={onSubmitTrade} assets={assets} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    const [fromQtyEl, toQtyEl] = screen.getAllByLabelText('Quantidade');
    fireEvent.change(fromQtyEl, { target: { value: '1' } });
    await selectCoin(toAssetEl, { id: 'solana', symbol: 'sol', name: 'Solana' });
    fireEvent.change(toQtyEl, { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/^Total/), { target: { value: '500' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    await waitFor(() => expect(document.querySelector('.drawer-foot .btn-submit')).not.toBeDisabled());
    expect(document.querySelector('.btn-submit.done')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a loading spinner then a checkmark while saving, disabling Cancel and the type selector', async () => {
    let resolveSubmit: () => void = () => {};
    const onSubmit = vi.fn(() => new Promise<void>(resolve => { resolveSubmit = resolve; }));
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={onSubmit} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '100' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(document.querySelector('.btn-submit .spinner')).toBeInTheDocument();
    expect(document.querySelector('.drawer-foot .btn')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Compra' })).toBeDisabled();
    resolveSubmit();
    await waitFor(() => expect(document.querySelector('.btn-submit.done')).toBeInTheDocument());
  });

  it('swaps in the two-block Trade fieldset when switching type', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    expect(document.querySelector('.trade-block.out')).toBeInTheDocument();
    expect(document.querySelector('.trade-block.in')).toBeInTheDocument();
    expect(document.getElementById('drawer-coin')).not.toBeInTheDocument();
  });

  it('submits a valid Trade as one Sell and one Buy sharing the same date, then closes', async () => {
    const onSubmitTrade = vi.fn();
    const onClose = vi.fn();
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={vi.fn()} onSubmitTrade={onSubmitTrade} assets={assets} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2024-03-10' } });
    fireEvent.change(screen.getByLabelText('Plataforma'), { target: { value: 'Kraken' } });
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    const [fromQtyEl, toQtyEl] = screen.getAllByLabelText('Quantidade');
    fireEvent.change(fromQtyEl, { target: { value: '1' } });
    await selectCoin(toAssetEl, { id: 'solana', symbol: 'sol', name: 'Solana' });
    fireEvent.change(toQtyEl, { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Taxa'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/^Total/), { target: { value: '500' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(onSubmitTrade).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Sell', coinId: 'ethereum', qty: 1, total: 500, date: '2024-03-10', platform: 'Kraken' }),
      expect.objectContaining({ type: 'Buy', coinId: 'solana', qty: 5, fee: 2, total: 502, date: '2024-03-10', platform: 'Kraken' }),
    );
    await waitForClose();
    expect(onClose).toHaveBeenCalled();
  });

  it('blocks Trade submission when source and destination assets are the same', async () => {
    const onSubmitTrade = vi.fn();
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={onSubmitTrade} assets={assets} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    const [fromQtyEl, toQtyEl] = screen.getAllByLabelText('Quantidade');
    fireEvent.change(fromQtyEl, { target: { value: '1' } });
    await selectCoin(toAssetEl, { id: 'ethereum', symbol: 'eth', name: 'Ethereum' });
    fireEvent.change(toQtyEl, { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/^Total/), { target: { value: '100' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(onSubmitTrade).not.toHaveBeenCalled();
    expect(screen.getByText('A moeda de origem e de destino não podem ser a mesma.')).toBeInTheDocument();
  });

  it('blocks Trade submission and shows the validation message when required fields are missing', () => {
    const onSubmitTrade = vi.fn();
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={onSubmitTrade} assets={assets} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(onSubmitTrade).not.toHaveBeenCalled();
    expect(screen.getByText('Preencha todos os campos obrigatórios.')).toBeInTheDocument();
  });

  it('auto-fills the trade total and destination quantity from live prices', async () => {
    const prices = { ethereum: 100, solana: 20 };
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={assets} prices={prices} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    fireEvent.change(screen.getAllByLabelText('Quantidade')[0], { target: { value: '2' } });
    expect((screen.getByLabelText(/^Total/) as HTMLInputElement).value).toBe('200.00');
    await selectCoin(toAssetEl, { id: 'solana', symbol: 'sol', name: 'Solana' });
    expect((screen.getAllByLabelText('Quantidade')[1] as HTMLInputElement).value).toBe('10');
  });

  it('fetches the destination price when not already cached, then syncs the trade total', async () => {
    mockGetPricesOnce(20);
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={assets} prices={{ ethereum: 100 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    fireEvent.change(screen.getAllByLabelText('Quantidade')[0], { target: { value: '2' } });
    await selectCoin(toAssetEl, { id: 'solana', symbol: 'sol', name: 'Solana' });
    await waitFor(() => expect((screen.getAllByLabelText('Quantidade')[1] as HTMLInputElement).value).toBe('10'));
  });

  it('leaves the trade total unsynced when the destination price fetch fails', async () => {
    mockGetPricesRejectOnce(new Error('network error'));
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={assets} prices={{ ethereum: 100 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    fireEvent.change(screen.getAllByLabelText('Quantidade')[0], { target: { value: '2' } });
    await selectCoin(toAssetEl, { id: 'solana', symbol: 'sol', name: 'Solana' });
    await new Promise(r => setTimeout(r, 50));
    expect((screen.getAllByLabelText('Quantidade')[1] as HTMLInputElement).value).toBe('');
  });

  it('leaves the unit price unset when the Buy/Sell price fetch fails', async () => {
    mockGetPricesRejectOnce(new Error('network error'));
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    await new Promise(r => setTimeout(r, 50));
    expect((screen.getByLabelText('Preço unit.') as HTMLInputElement).value).toBe('');
    expect(document.querySelector('.badge')).not.toBeInTheDocument();
  });

  it('discards Trade-only fields but keeps platform when switching away from Trade', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Plataforma'), { target: { value: 'Kraken' } });
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    fireEvent.change(screen.getAllByLabelText('Quantidade')[0], { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Compra' }));
    expect((screen.getByLabelText('Plataforma') as HTMLInputElement).value).toBe('Kraken');
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    expect((screen.getAllByLabelText('Quantidade')[0] as HTMLInputElement).value).toBe('');
  });

  it('uses the same dropdown styling as the other coin fields and only shows owned assets for "Você vende"', () => {
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={assets} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    const [fromAssetEl] = screen.getAllByLabelText('Ativo');
    fireEvent.focus(fromAssetEl);
    expect(fromAssetEl.closest('.search-wrap')).toBeInTheDocument();
    expect(document.querySelector('.trade-block.out .search-dropdown')).toBeInTheDocument();
    expect(screen.getByText('Ethereum')).toBeInTheDocument();
    fireEvent.change(fromAssetEl, { target: { value: 'bitcoin' } });
    expect(screen.queryByText('Bitcoin')).not.toBeInTheDocument();
  });

  it('closes the "Você vende" dropdown and clears its selection when clicking outside', () => {
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={assets} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    const [fromAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    expect((fromAssetEl as HTMLInputElement).value).toBe('Ethereum (ETH)');
    fireEvent.focus(fromAssetEl);
    fireEvent.mouseDown(document.body);
    expect(document.querySelector('.trade-block.out .search-dropdown')).not.toBeInTheDocument();
    expect((fromAssetEl as HTMLInputElement).value).toBe('');
  });

  it('clears and reopens the "Você vende" field when refocused after a selection', () => {
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={assets} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    const [fromAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    fireEvent.focus(fromAssetEl);
    expect((fromAssetEl as HTMLInputElement).value).toBe('');
    expect(document.querySelector('.trade-block.out .search-dropdown')).toBeInTheDocument();
  });

  it('pre-fills every field when opened with editingOp and disables the Trade option', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} editingOp={editingOp} assets={[]} prices={{}} />);
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Kraken')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Venda' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Trade' })).toBeDisabled();
  });

  it('submits updated fields via onSubmit when editing, not onSubmitTrade, then closes', async () => {
    const onSubmit = vi.fn();
    const onSubmitTrade = vi.fn();
    const onClose = vi.fn();
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={onSubmit} onSubmitTrade={onSubmitTrade} editingOp={editingOp} assets={[]} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '3' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ qty: 3, type: 'Sell', coinId: 'ethereum' }));
    expect(onSubmitTrade).not.toHaveBeenCalled();
    await waitForClose();
    expect(onClose).toHaveBeenCalled();
  });

  it('leaves the operation untouched when closing an edit session without submitting', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={onSubmit} onSubmitTrade={vi.fn()} editingOp={editingOp} assets={[]} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '999' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn')!);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape with no submission', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={onSubmit} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('closes on backdrop click with no submission', () => {
    const onClose = vi.fn();
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    fireEvent.click(document.querySelector('.drawer-backdrop')!);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Cancel, discarding in-progress field values, with no submission', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={onSubmit} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '5' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn')!);
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not close on Escape or backdrop click while saving', async () => {
    let resolveSubmit: () => void = () => {};
    const onSubmit = vi.fn(() => new Promise<void>(resolve => { resolveSubmit = resolve; }));
    const onClose = vi.fn();
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={onSubmit} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '100' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(document.querySelector('.drawer-backdrop')!);
    expect(onClose).not.toHaveBeenCalled();
    resolveSubmit();
    await waitFor(() => expect(document.querySelector('.btn-submit.done')).toBeInTheDocument());
  });

  it('shows a spinner badge while fetching the price, then an "auto" badge once it resolves', async () => {
    let resolvePrice: (v: { bitcoin: { price: number; image: null } }) => void = () => {};
    vi.mocked(api.getPrices).mockReturnValueOnce(new Promise(resolve => { resolvePrice = resolve; }));
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    await waitFor(() => expect(document.querySelector('.badge.fetching .mini-spin')).toBeInTheDocument());
    resolvePrice({ bitcoin: { price: 50000, image: null } });
    await waitFor(() => expect((screen.getByLabelText('Preço unit.') as HTMLInputElement).value).toBe('50000.00'));
    expect(document.querySelector('.badge')).toHaveClass('auto');
  });

  it('switches the price badge to "manual" when the auto-filled price is edited by hand', async () => {
    mockGetPricesOnce(50000);
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    await waitFor(() => expect(document.querySelector('.badge')).toHaveClass('auto'));
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '51000' } });
    expect(document.querySelector('.badge')).toHaveClass('manual');
  });

  it('does not overwrite the price with a stale response after switching to a different coin', async () => {
    let resolveFirst: (v: { bitcoin: { price: number; image: null } }) => void = () => {};
    vi.mocked(api.getPrices)
      .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
      .mockImplementationOnce(async (ids: string[]) => ({ [ids[0]]: { price: 2000, image: null } }));
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'ethereum', symbol: 'eth', name: 'Ethereum' });
    await waitFor(() => expect((screen.getByLabelText('Preço unit.') as HTMLInputElement).value).toBe('2000.00'));
    resolveFirst({ bitcoin: { price: 50000, image: null } });
    await new Promise(r => setTimeout(r, 50));
    expect((screen.getByLabelText('Preço unit.') as HTMLInputElement).value).toBe('2000.00');
  });

  it('shows the user\'s own holdings as instant suggestions when the coin field is focused and empty', () => {
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={assets} prices={{}} />);
    vi.mocked(api.searchCoins).mockClear();
    fireEvent.focus(screen.getByLabelText('Moeda comprada'));
    expect(screen.getByText('Ethereum')).toBeInTheDocument();
    expect(api.searchCoins).not.toHaveBeenCalled();
  });

  it('searches via the backend once at least two characters are typed', async () => {
    vi.mocked(api.searchCoins).mockResolvedValueOnce([{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', market_cap_rank: 1 }]);
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Moeda comprada'), { target: { value: 'bit' } });
    await screen.findByText('Bitcoin');
    expect(api.searchCoins).toHaveBeenCalledWith('bit');
  });

  it('closes the dropdown and clears the unit price when clicking outside the coin field', async () => {
    mockGetPricesOnce(50000);
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={assets} prices={{}} />);
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    await waitFor(() => expect((screen.getByLabelText('Preço unit.') as HTMLInputElement).value).not.toBe(''));
    fireEvent.focus(screen.getByLabelText('Moeda comprada'));
    expect(document.querySelector('.search-dropdown')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(document.querySelector('.search-dropdown')).not.toBeInTheDocument();
    expect((screen.getByLabelText('Moeda comprada') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Preço unit.') as HTMLInputElement).value).toBe('');
  });

  it('clicking a result inside the dropdown does not trigger the outside-click clear', async () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    expect((screen.getByLabelText('Moeda comprada') as HTMLInputElement).value).toBe('Bitcoin (BTC)');
  });

  it('clears the confirmed selection and price, and reopens suggestions, when the coin field is refocused', async () => {
    mockGetPricesOnce(50000);
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={assets} prices={{}} />);
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    await waitFor(() => expect((screen.getByLabelText('Preço unit.') as HTMLInputElement).value).not.toBe(''));
    fireEvent.focus(screen.getByLabelText('Moeda comprada'));
    expect((screen.getByLabelText('Moeda comprada') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Preço unit.') as HTMLInputElement).value).toBe('');
    expect(document.querySelector('.badge')).not.toBeInTheDocument();
    expect(screen.getByText('Ethereum')).toBeInTheDocument();
  });

  it('traps Tab within the drawer, wrapping at both ends', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    const dialog = screen.getByRole('dialog');
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('input, select, button, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(el => !el.hasAttribute('disabled'));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('locks body scroll while open and restores the prior value after closing', () => {
    document.body.style.overflow = 'auto';
    const { rerender } = renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<LocaleProvider><BalanceProvider><CurrencyProvider><OpDrawer open={false} onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} /></CurrencyProvider></BalanceProvider></LocaleProvider>);
    expect(document.body.style.overflow).toBe('auto');
  });

  it('restores focus to the element that triggered the drawer after it closes', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { rerender } = renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    rerender(<LocaleProvider><BalanceProvider><CurrencyProvider><OpDrawer open={false} onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} /></CurrencyProvider></BalanceProvider></LocaleProvider>);
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});

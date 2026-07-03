import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OpDrawer from './OpDrawer';
import type { Op, Asset } from '@/lib/types';
import { LocaleProvider } from '@/context/LocaleContext';
import { BalanceProvider } from '@/context/BalanceContext';
import { searchCoins } from '@/lib/coingecko';

vi.mock('@/lib/coingecko', () => ({
  searchCoins: vi.fn(async () => []),
  fetchSinglePrice: vi.fn(async () => null),
}));

function renderDrawer(ui: React.ReactElement) {
  return render(<LocaleProvider><BalanceProvider>{ui}</BalanceProvider></LocaleProvider>);
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
  vi.mocked(searchCoins).mockResolvedValueOnce([{ id: result.id, symbol: result.symbol, name: result.name, market_cap_rank: 1 }]);
  fireEvent.change(input, { target: { value: result.name.slice(0, 3) } });
  await screen.findByText(result.name, {}, { timeout: 2000 });
  fireEvent.click(screen.getByText(result.name));
}

beforeEach(() => { localStorage.clear(); document.body.style.overflow = ''; });
afterEach(() => { localStorage.clear(); document.body.style.overflow = ''; });

describe('OpDrawer', () => {
  it('does not render when closed', () => {
    renderDrawer(<OpDrawer open={false} onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens in Buy mode by default with focus on the first field', async () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
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
    fireEvent.click(document.querySelector('.drawer-foot .btn-accent')!);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Preencha todos os campos obrigatórios.')).toBeInTheDocument();
  });

  it('submits a valid Buy with an auto-calculated total and closes', async () => {
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
    fireEvent.click(document.querySelector('.drawer-foot .btn-accent')!);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'Buy', coinId: 'bitcoin', qty: 2, price: 100, fee: 5, total: 205,
      date: '2024-03-10', platform: 'Binance',
    }));
    expect(onClose).toHaveBeenCalled();
  });

  it('switches to Sell and submits with type Sell', async () => {
    const onSubmit = vi.fn();
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={onSubmit} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Venda' }));
    await selectCoin(screen.getByLabelText('Moeda vendida'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '100' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-accent')!);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: 'Sell', qty: 1, price: 100 }));
  });

  it('swaps in the two-block Trade fieldset when switching type', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    expect(document.querySelector('.trade-block.out')).toBeInTheDocument();
    expect(document.querySelector('.trade-block.in')).toBeInTheDocument();
    expect(document.getElementById('drawer-coin')).not.toBeInTheDocument();
  });

  it('submits a valid Trade as one Sell and one Buy sharing the same date', async () => {
    const onSubmitTrade = vi.fn();
    const onClose = vi.fn();
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={vi.fn()} onSubmitTrade={onSubmitTrade} assets={assets} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2024-03-10' } });
    fireEvent.change(screen.getByLabelText('Plataforma'), { target: { value: 'Kraken' } });
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    fireEvent.change(fromAssetEl, { target: { value: 'ethereum' } });
    const [fromQtyEl, toQtyEl] = screen.getAllByLabelText('Quantidade');
    fireEvent.change(fromQtyEl, { target: { value: '1' } });
    await selectCoin(toAssetEl, { id: 'solana', symbol: 'sol', name: 'Solana' });
    fireEvent.change(toQtyEl, { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Taxa'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/^Total/), { target: { value: '500' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-accent')!);
    expect(onSubmitTrade).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Sell', coinId: 'ethereum', qty: 1, total: 500, date: '2024-03-10', platform: 'Kraken' }),
      expect.objectContaining({ type: 'Buy', coinId: 'solana', qty: 5, fee: 2, total: 502, date: '2024-03-10', platform: 'Kraken' }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('blocks Trade submission when source and destination assets are the same', async () => {
    const onSubmitTrade = vi.fn();
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={onSubmitTrade} assets={assets} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    fireEvent.change(fromAssetEl, { target: { value: 'ethereum' } });
    const [fromQtyEl, toQtyEl] = screen.getAllByLabelText('Quantidade');
    fireEvent.change(fromQtyEl, { target: { value: '1' } });
    await selectCoin(toAssetEl, { id: 'ethereum', symbol: 'eth', name: 'Ethereum' });
    fireEvent.change(toQtyEl, { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/^Total/), { target: { value: '100' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-accent')!);
    expect(onSubmitTrade).not.toHaveBeenCalled();
    expect(screen.getByText('A moeda de origem e de destino não podem ser a mesma.')).toBeInTheDocument();
  });

  it('blocks Trade submission and shows the validation message when required fields are missing', () => {
    const onSubmitTrade = vi.fn();
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={onSubmitTrade} assets={assets} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    fireEvent.click(document.querySelector('.drawer-foot .btn-accent')!);
    expect(onSubmitTrade).not.toHaveBeenCalled();
    expect(screen.getByText('Preencha todos os campos obrigatórios.')).toBeInTheDocument();
  });

  it('auto-fills the trade total and destination quantity from live prices', async () => {
    const prices = { ethereum: 100, solana: 20 };
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={assets} prices={prices} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    fireEvent.change(fromAssetEl, { target: { value: 'ethereum' } });
    fireEvent.change(screen.getAllByLabelText('Quantidade')[0], { target: { value: '2' } });
    expect((screen.getByLabelText(/^Total/) as HTMLInputElement).value).toBe('200.00');
    await selectCoin(toAssetEl, { id: 'solana', symbol: 'sol', name: 'Solana' });
    expect((screen.getAllByLabelText('Quantidade')[1] as HTMLInputElement).value).toBe('10');
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

  it('pre-fills every field when opened with editingOp and disables the Trade option', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} editingOp={editingOp} assets={[]} prices={{}} />);
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Kraken')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Venda' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Trade' })).toBeDisabled();
  });

  it('submits updated fields via onSubmit when editing, not onSubmitTrade', () => {
    const onSubmit = vi.fn();
    const onSubmitTrade = vi.fn();
    const onClose = vi.fn();
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={onSubmit} onSubmitTrade={onSubmitTrade} editingOp={editingOp} assets={[]} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '3' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-accent')!);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ qty: 3, type: 'Sell', coinId: 'ethereum' }));
    expect(onSubmitTrade).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('leaves the operation untouched when closing an edit session without submitting', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={onSubmit} onSubmitTrade={vi.fn()} editingOp={editingOp} assets={[]} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '999' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn:not(.btn-accent)')!);
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
    fireEvent.click(document.querySelector('.drawer-foot .btn:not(.btn-accent)')!);
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
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
    rerender(<LocaleProvider><BalanceProvider><OpDrawer open={false} onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} /></BalanceProvider></LocaleProvider>);
    expect(document.body.style.overflow).toBe('auto');
  });

  it('restores focus to the element that triggered the drawer after it closes', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { rerender } = renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} />);
    rerender(<LocaleProvider><BalanceProvider><OpDrawer open={false} onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} prices={{}} /></BalanceProvider></LocaleProvider>);
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});

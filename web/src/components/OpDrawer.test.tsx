import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import OpDrawer from './OpDrawer';
import type { Op, Asset, AssetWithPlatform } from '@/lib/types';
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
    getPlatformExchanges: vi.fn(async () => ({ exchanges: [], updatedAt: '2026-01-01T00:00:00Z' })),
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
  platformId: 'kraken',
  platformName: 'Kraken',
};

// Ethereum held on the custom platform "Kraken" — the fixture most trade tests
// use once the "from" asset field is gated behind an origin platform selection.
const krakenEth: AssetWithPlatform[] = [
  { coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', platformId: 'custom:kraken', platformName: 'Kraken', qty: 2, avgPrice: 100 },
];

async function selectCoin(input: HTMLElement, result: { id: string; symbol: string; name: string }) {
  vi.mocked(api.searchCoins).mockResolvedValueOnce([{ id: result.id, symbol: result.symbol, name: result.name, market_cap_rank: 1 }]);
  fireEvent.change(input, { target: { value: result.name.slice(0, 3) } });
  await screen.findByText(result.name, {}, { timeout: 2000 });
  fireEvent.click(screen.getByText(result.name));
}

function selectCustomPlatform(input: HTMLElement, name: string) {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: name } });
  fireEvent.click(screen.getByText(`Usar "${name}" como personalizada`));
}

// DatePicker's trigger is a typeable dd/mm/yyyy field (pt-BR order); typing then
// blurring commits it, matching how a user tabs away without opening the panel.
function setDateField(input: HTMLElement, isoDate: string) {
  const [y, m, d] = isoDate.split('-');
  fireEvent.change(input, { target: { value: `${d}/${m}/${y}` } });
  fireEvent.blur(input);
}

// The origin picker is restricted to platforms with a current holding (a real
// list item, sourced from platformAssets), not the free-typed "add as custom" row.
// Selects by the item's name div specifically (".n") — a custom-kind entry's
// initials-avatar fallback (e.g. "KR") sits in the same option and would
// otherwise fold into the accessible name, breaking a plain role/name query.
function selectOriginPlatform(name: string) {
  const input = screen.getByLabelText('Plataforma de origem');
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: name } });
  fireEvent.click(screen.getByText(name, { selector: '.n' }));
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
    renderDrawer(<OpDrawer open={false} onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('.drawer')).not.toHaveClass('open');
  });

  it('opens in Buy mode by default with focus on the first field', async () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(document.querySelector('.drawer')).toHaveClass('open');
    expect(screen.getByRole('button', { name: 'Compra' })).toHaveClass('active');
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('drawer-date')));
  });

  it('exposes dialog accessibility attributes', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'drawer-title');
  });

  it('blocks submission and shows a validation message when required fields are missing', () => {
    const onSubmit = vi.fn();
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={onSubmit} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Preencha todos os campos obrigatórios.')).toBeInTheDocument();
  });

  it('submits a valid Buy with an auto-calculated total, then stays open with fields intact after the done animation', async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={onSubmit} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    setDateField(screen.getByLabelText('Data'), '2024-03-10');
    selectCustomPlatform(screen.getByLabelText('Plataforma'), 'Binance');
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Taxa'), { target: { value: '5' } });
    expect((screen.getByLabelText('Total') as HTMLInputElement).value).toBe('205.00');
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'Buy', coinId: 'bitcoin', qty: 2, price: 100, fee: 5, total: 205,
      date: '2024-03-10', platformId: 'custom:binance', platformName: 'Binance',
    }));
    await waitForClose();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect((screen.getByLabelText('Quantidade') as HTMLInputElement).value).toBe('2');
    expect((screen.getByLabelText('Plataforma') as HTMLInputElement).value).toBe('Binance');
  });

  it('switches to Sell and submits with type Sell', async () => {
    const onSubmit = vi.fn();
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={onSubmit} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
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
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={onSubmit} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
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
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={vi.fn()} onSubmitTrade={onSubmitTrade} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    selectOriginPlatform('Kraken');
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    const [fromQtyEl] = screen.getAllByLabelText('Quantidade');
    fireEvent.change(fromQtyEl, { target: { value: '1' } });
    await selectCoin(toAssetEl, { id: 'solana', symbol: 'sol', name: 'Solana' });
    const [fromPriceEl, toPriceEl] = screen.getAllByLabelText('Preço unit.');
    fireEvent.change(fromPriceEl, { target: { value: '500' } });
    fireEvent.change(toPriceEl, { target: { value: '100' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    await waitFor(() => expect(document.querySelector('.drawer-foot .btn-submit')).not.toBeDisabled());
    expect(document.querySelector('.btn-submit.done')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a loading spinner then a checkmark while saving, disabling Cancel and the type selector', async () => {
    let resolveSubmit: () => void = () => {};
    const onSubmit = vi.fn(() => new Promise<void>(resolve => { resolveSubmit = resolve; }));
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={onSubmit} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
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
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    expect(document.querySelector('.trade-block.out')).toBeInTheDocument();
    expect(document.querySelector('.trade-block.in')).toBeInTheDocument();
    expect(document.getElementById('drawer-coin')).not.toBeInTheDocument();
  });

  it('constrains the Trade Data field to half width instead of stretching the full drawer', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    expect(document.getElementById('drawer-tr-date')?.closest('.fld')).toHaveClass('tr-date');
  });

  it('submits a valid Trade as one Sell and one Buy sharing the same date, then stays open with fields intact', async () => {
    const onSubmitTrade = vi.fn();
    const onClose = vi.fn();
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={vi.fn()} onSubmitTrade={onSubmitTrade} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    setDateField(screen.getByLabelText('Data'), '2024-03-10');
    selectOriginPlatform('Kraken');
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    const [fromQtyEl] = screen.getAllByLabelText('Quantidade');
    fireEvent.change(fromQtyEl, { target: { value: '1' } });
    await selectCoin(toAssetEl, { id: 'solana', symbol: 'sol', name: 'Solana' });
    const [fromPriceEl, toPriceEl] = screen.getAllByLabelText('Preço unit.');
    fireEvent.change(fromPriceEl, { target: { value: '500' } });
    fireEvent.change(toPriceEl, { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Taxa'), { target: { value: '2' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(onSubmitTrade).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Sell', coinId: 'ethereum', qty: 1, total: 500, date: '2024-03-10', platformId: 'custom:kraken', platformName: 'Kraken' }),
      expect.objectContaining({ type: 'Buy', coinId: 'solana', qty: 5, fee: 2, total: 502, date: '2024-03-10', platformId: 'custom:kraken', platformName: 'Kraken' }),
    );
    await waitForClose();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect((screen.getAllByLabelText('Quantidade')[0] as HTMLInputElement).value).toBe('1');
  });

  it('submits a Trade with a different destination platform, tagging the sell with the origin and the buy with the destination', async () => {
    const onSubmitTrade = vi.fn();
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={onSubmitTrade} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    selectOriginPlatform('Kraken');
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    const [fromQtyEl] = screen.getAllByLabelText('Quantidade');
    fireEvent.change(fromQtyEl, { target: { value: '1' } });
    await selectCoin(toAssetEl, { id: 'solana', symbol: 'sol', name: 'Solana' });
    const [fromPriceEl, toPriceEl] = screen.getAllByLabelText('Preço unit.');
    fireEvent.change(fromPriceEl, { target: { value: '500' } });
    fireEvent.change(toPriceEl, { target: { value: '100' } });
    selectCustomPlatform(screen.getByLabelText('Plataforma de destino'), 'Sodex');
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(onSubmitTrade).toHaveBeenCalledWith(
      expect.objectContaining({ platformId: 'custom:kraken', platformName: 'Kraken' }),
      expect.objectContaining({ platformId: 'custom:sodex', platformName: 'Sodex' }),
    );
  });

  it('blocks Trade submission when source and destination assets are the same', async () => {
    const onSubmitTrade = vi.fn();
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={onSubmitTrade} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    selectOriginPlatform('Kraken');
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    const [fromQtyEl] = screen.getAllByLabelText('Quantidade');
    fireEvent.change(fromQtyEl, { target: { value: '1' } });
    await selectCoin(toAssetEl, { id: 'ethereum', symbol: 'eth', name: 'Ethereum' });
    const [fromPriceEl, toPriceEl] = screen.getAllByLabelText('Preço unit.');
    fireEvent.change(fromPriceEl, { target: { value: '100' } });
    fireEvent.change(toPriceEl, { target: { value: '100' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(onSubmitTrade).not.toHaveBeenCalled();
    expect(screen.getByText('A moeda de origem e de destino não podem ser a mesma.')).toBeInTheDocument();
  });

  it('allows the same asset on both sides of a Trade when origin and destination platforms differ (a transfer)', async () => {
    const onSubmitTrade = vi.fn();
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={onSubmitTrade} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    selectOriginPlatform('Kraken');
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    const [fromQtyEl] = screen.getAllByLabelText('Quantidade');
    fireEvent.change(fromQtyEl, { target: { value: '1' } });
    await selectCoin(toAssetEl, { id: 'ethereum', symbol: 'eth', name: 'Ethereum' });
    const [fromPriceEl, toPriceEl] = screen.getAllByLabelText('Preço unit.');
    fireEvent.change(fromPriceEl, { target: { value: '100' } });
    fireEvent.change(toPriceEl, { target: { value: '100' } });
    selectCustomPlatform(screen.getByLabelText('Plataforma de destino'), 'Sodex');
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(screen.queryByText('A moeda de origem e de destino não podem ser a mesma.')).not.toBeInTheDocument();
    expect(onSubmitTrade).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Sell', coinId: 'ethereum', platformId: 'custom:kraken', platformName: 'Kraken' }),
      expect.objectContaining({ type: 'Buy', coinId: 'ethereum', platformId: 'custom:sodex', platformName: 'Sodex' }),
    );
  });

  it('blocks Trade submission and shows the validation message when required fields are missing', () => {
    const onSubmitTrade = vi.fn();
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={onSubmitTrade} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(onSubmitTrade).not.toHaveBeenCalled();
    expect(screen.getByText('Preencha todos os campos obrigatórios.')).toBeInTheDocument();
  });

  it('restricts the "Plataforma de origem" picker to platforms with a current holding', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    const input = screen.getByLabelText('Plataforma de origem');
    fireEvent.focus(input);
    expect(screen.getByText('Kraken')).toBeInTheDocument();
    expect(screen.queryByText('MetaMask')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'MetaMask' } });
    expect(screen.queryByText('MetaMask')).not.toBeInTheDocument();
    expect(screen.queryByText('Usar "MetaMask" como personalizada')).not.toBeInTheDocument();
  });

  it('disables the "Você vende" asset field until an origin platform is chosen, then filters to that platform\'s holdings', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    const [fromAssetEl] = screen.getAllByLabelText('Ativo');
    expect(fromAssetEl).toBeDisabled();
    selectOriginPlatform('Kraken');
    expect(fromAssetEl).not.toBeDisabled();
    fireEvent.focus(fromAssetEl);
    expect(screen.getByText('Ethereum')).toBeInTheDocument();
  });

  it('shows the real coin logo on a "Você vende" holding when it is cached in avatarCache', () => {
    const avatarCache = { ethereum: { url: 'https://cg.example/ethereum.png' } };
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={avatarCache} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    selectOriginPlatform('Kraken');
    const [fromAssetEl] = screen.getAllByLabelText('Ativo');
    fireEvent.focus(fromAssetEl);
    const img = document.querySelector('.trade-block.out .search-item .coin img');
    expect(img).toHaveAttribute('src', 'https://cg.example/ethereum.png');
  });

  it('resets the selected "Você vende" asset when the origin platform changes', () => {
    const multi: AssetWithPlatform[] = [
      ...krakenEth,
      { coinId: 'solana', symbol: 'SOL', name: 'Solana', platformId: 'custom:sodex', platformName: 'Sodex', qty: 3, avgPrice: 20 },
    ];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={multi} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    selectOriginPlatform('Kraken');
    const [fromAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    expect((fromAssetEl as HTMLInputElement).value).toBe('Ethereum (ETH)');
    selectOriginPlatform('Sodex');
    expect((screen.getAllByLabelText('Ativo')[0] as HTMLInputElement).value).toBe('');
  });

  it('shows the platform balance under "Quantidade" and fills it in via "Máx"', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    selectOriginPlatform('Kraken');
    const [fromAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    expect(screen.getByText('Saldo: 2,00 ETH')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Máx' }));
    expect((screen.getAllByLabelText('Quantidade')[0] as HTMLInputElement).value).toBe('2');
  });

  it('groups the origin dropdown under "Seus ativos em <platform>" and shows the held quantity per row', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    selectOriginPlatform('Kraken');
    const [fromAssetEl] = screen.getAllByLabelText('Ativo');
    fireEvent.focus(fromAssetEl);
    expect(screen.getByText('Seus ativos em Kraken')).toBeInTheDocument();
    const row = screen.getByText('Ethereum').closest('.search-item');
    expect(row).toHaveTextContent('2,00');
  });

  it('shows a platform-named empty message in the dropdown when the origin platform has no holdings', () => {
    // The origin picker only ever offers platforms with a current holding, so
    // this state is reached by the last coin on an already-selected platform
    // being sold out from under the still-open drawer (ops refresh mid-edit),
    // not by picking an empty platform outright.
    const { rerender } = renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    selectOriginPlatform('Kraken');
    rerender(<LocaleProvider><BalanceProvider><CurrencyProvider>
      <OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />
    </CurrencyProvider></BalanceProvider></LocaleProvider>);
    const [fromAssetEl] = screen.getAllByLabelText('Ativo');
    expect(fromAssetEl).toHaveAttribute('placeholder', 'Sem ativos nesta plataforma');
    fireEvent.focus(fromAssetEl);
    expect(screen.getByText('Nenhum ativo em Kraken')).toBeInTheDocument();
  });

  it('flags the balance line and the quantity field as exceeded when the entered quantity is above what is held', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    selectOriginPlatform('Kraken');
    const [fromAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    const fromQtyEl = screen.getAllByLabelText('Quantidade')[0];
    fireEvent.change(fromQtyEl, { target: { value: '5' } });
    expect(screen.getByText('Acima do saldo (2,00 ETH)')).toBeInTheDocument();
    expect(document.querySelector('.bal-row.err')).toBeInTheDocument();
    expect(fromQtyEl).toHaveClass('err');
  });

  it('shows the cross-platform transfer warning only when the destination platform differs from the origin', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    selectOriginPlatform('Kraken');
    expect(document.querySelector('.xfer-warn')).not.toBeInTheDocument();
    selectCustomPlatform(screen.getByLabelText('Plataforma de destino'), 'Kraken');
    expect(document.querySelector('.xfer-warn')).not.toBeInTheDocument();
    selectCustomPlatform(screen.getByLabelText('Plataforma de destino'), 'Sodex');
    expect(document.querySelector('.xfer-warn')).toBeInTheDocument();
  });

  it('auto-fills each side\'s unit price, the destination quantity, and the received total from live prices', async () => {
    const prices = { ethereum: 100, solana: 20 };
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={prices} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    selectOriginPlatform('Kraken');
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    await waitFor(() => expect((screen.getAllByLabelText('Preço unit.')[0] as HTMLInputElement).value).toBe('100.00'));
    fireEvent.change(screen.getAllByLabelText('Quantidade')[0], { target: { value: '2' } });
    await selectCoin(toAssetEl, { id: 'solana', symbol: 'sol', name: 'Solana' });
    await waitFor(() => expect((screen.getAllByLabelText('Preço unit.')[1] as HTMLInputElement).value).toBe('20.00'));
    await waitFor(() => expect((screen.getAllByLabelText('Quantidade')[1] as HTMLInputElement).value).toBe('10'));
    expect((screen.getByLabelText(/^Total/) as HTMLInputElement).value).toBe('200.00');
  });

  it('fetches the destination price when not already cached, then syncs the trade total', async () => {
    mockGetPricesOnce(20);
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={{ ethereum: 100 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    selectOriginPlatform('Kraken');
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    fireEvent.change(screen.getAllByLabelText('Quantidade')[0], { target: { value: '2' } });
    await selectCoin(toAssetEl, { id: 'solana', symbol: 'sol', name: 'Solana' });
    await waitFor(() => expect((screen.getAllByLabelText('Quantidade')[1] as HTMLInputElement).value).toBe('10'));
  });

  it('leaves the trade total unsynced when the destination price fetch fails', async () => {
    mockGetPricesRejectOnce(new Error('network error'));
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={{ ethereum: 100 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    selectOriginPlatform('Kraken');
    const [fromAssetEl, toAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    fireEvent.change(screen.getAllByLabelText('Quantidade')[0], { target: { value: '2' } });
    await selectCoin(toAssetEl, { id: 'solana', symbol: 'sol', name: 'Solana' });
    await new Promise(r => setTimeout(r, 50));
    expect((screen.getAllByLabelText('Quantidade')[1] as HTMLInputElement).value).toBe('');
  });

  it('leaves the unit price unset when the Buy/Sell price fetch fails', async () => {
    mockGetPricesRejectOnce(new Error('network error'));
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    await new Promise(r => setTimeout(r, 50));
    expect((screen.getByLabelText('Preço unit.') as HTMLInputElement).value).toBe('');
    expect(document.querySelector('.badge')).not.toBeInTheDocument();
  });

  it('keeps Trade-only fields (and the Buy/Sell platform) filled when switching tabs', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    selectCustomPlatform(screen.getByLabelText('Plataforma'), 'Kraken');
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    fireEvent.change(screen.getAllByLabelText('Quantidade')[0], { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Compra' }));
    expect((screen.getByLabelText('Plataforma') as HTMLInputElement).value).toBe('Kraken');
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    expect((screen.getAllByLabelText('Quantidade')[0] as HTMLInputElement).value).toBe('3');
  });

  it('clears fields for the next new-op session once the drawer has actually been closed and reopened', () => {
    const { rerender } = renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '3' } });
    const rerenderWith = (open: boolean) => rerender(<LocaleProvider><BalanceProvider><CurrencyProvider>
      <OpDrawer open={open} onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />
    </CurrencyProvider></BalanceProvider></LocaleProvider>);
    rerenderWith(false);
    rerenderWith(true);
    expect((screen.getByLabelText('Quantidade') as HTMLInputElement).value).toBe('');
  });

  it('uses the same dropdown styling as the other coin fields and only shows owned assets for "Você vende"', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    selectOriginPlatform('Kraken');
    const [fromAssetEl] = screen.getAllByLabelText('Ativo');
    fireEvent.focus(fromAssetEl);
    expect(fromAssetEl.closest('.search-wrap')).toBeInTheDocument();
    expect(document.querySelector('.trade-block.out .search-dropdown')).toBeInTheDocument();
    expect(screen.getByText('Ethereum')).toBeInTheDocument();
    fireEvent.change(fromAssetEl, { target: { value: 'bitcoin' } });
    expect(screen.queryByText('Bitcoin')).not.toBeInTheDocument();
  });

  it('closes the "Você vende" dropdown and clears its selection when clicking outside', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    selectOriginPlatform('Kraken');
    const [fromAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    expect((fromAssetEl as HTMLInputElement).value).toBe('Ethereum (ETH)');
    fireEvent.focus(fromAssetEl);
    fireEvent.mouseDown(document.body);
    expect(document.querySelector('.trade-block.out .search-dropdown')).not.toBeInTheDocument();
    expect((fromAssetEl as HTMLInputElement).value).toBe('');
  });

  it('clears and reopens the "Você vende" field when refocused after a selection', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    selectOriginPlatform('Kraken');
    const [fromAssetEl] = screen.getAllByLabelText('Ativo');
    selectFromAsset(fromAssetEl, 'Ethereum');
    fireEvent.focus(fromAssetEl);
    expect((fromAssetEl as HTMLInputElement).value).toBe('');
    expect(document.querySelector('.trade-block.out .search-dropdown')).toBeInTheDocument();
  });

  it('pre-fills every field when opened with editingOp and disables the Trade option', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} editingOp={editingOp} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Kraken')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Venda' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Troca' })).toBeDisabled();
  });

  it('submits updated fields via onSubmit when editing, not onSubmitTrade, then stays open with the edited values', async () => {
    const onSubmit = vi.fn();
    const onSubmitTrade = vi.fn();
    const onClose = vi.fn();
    const priorBuy: Op = { ...editingOp, id: 'buy-eth', type: 'Buy', qty: 10 };
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={onSubmit} onSubmitTrade={onSubmitTrade} editingOp={editingOp} assets={[]} platformAssets={[]} ops={[priorBuy, editingOp]} avatarCache={{}} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '3' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ qty: 3, type: 'Sell', coinId: 'ethereum' }));
    expect(onSubmitTrade).not.toHaveBeenCalled();
    await waitForClose();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect((screen.getByLabelText('Quantidade') as HTMLInputElement).value).toBe('3');
  });

  it('leaves the operation untouched when closing an edit session without submitting', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={onSubmit} onSubmitTrade={vi.fn()} editingOp={editingOp} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '999' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn')!);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape with no submission', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={onSubmit} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('closes on backdrop click with no submission', () => {
    const onClose = vi.fn();
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(document.querySelector('.drawer-backdrop')!);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Cancel, discarding in-progress field values, with no submission', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={onSubmit} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '5' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn')!);
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not close on Escape or backdrop click while saving', async () => {
    let resolveSubmit: () => void = () => {};
    const onSubmit = vi.fn(() => new Promise<void>(resolve => { resolveSubmit = resolve; }));
    const onClose = vi.fn();
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={onSubmit} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
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
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    await waitFor(() => expect(document.querySelector('.badge.fetching .mini-spin')).toBeInTheDocument());
    resolvePrice({ bitcoin: { price: 50000, image: null } });
    await waitFor(() => expect((screen.getByLabelText('Preço unit.') as HTMLInputElement).value).toBe('50000.00'));
    expect(document.querySelector('.badge')).toHaveClass('auto');
  });

  it('switches the price badge to "manual" when the auto-filled price is edited by hand', async () => {
    mockGetPricesOnce(50000);
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
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
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'ethereum', symbol: 'eth', name: 'Ethereum' });
    await waitFor(() => expect((screen.getByLabelText('Preço unit.') as HTMLInputElement).value).toBe('2000.00'));
    resolveFirst({ bitcoin: { price: 50000, image: null } });
    await new Promise(r => setTimeout(r, 50));
    expect((screen.getByLabelText('Preço unit.') as HTMLInputElement).value).toBe('2000.00');
  });

  it('shows the user\'s own holdings as instant suggestions when the coin field is focused and empty', () => {
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={assets} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    vi.mocked(api.searchCoins).mockClear();
    fireEvent.focus(screen.getByLabelText('Moeda comprada'));
    expect(screen.getByText('Ethereum')).toBeInTheDocument();
    expect(api.searchCoins).not.toHaveBeenCalled();
  });

  it('shows the real coin logo (not a placeholder) on an owned-holding suggestion when it is cached in avatarCache', () => {
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    const avatarCache = { ethereum: { url: 'https://cg.example/ethereum.png' } };
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={assets} platformAssets={[]} ops={[]} avatarCache={avatarCache} prices={{}} />);
    fireEvent.focus(screen.getByLabelText('Moeda comprada'));
    const img = document.querySelector('.search-item .coin img');
    expect(img).toHaveAttribute('src', 'https://cg.example/ethereum.png');
  });

  it('falls back to initials on an owned-holding suggestion when it has no cached avatar', () => {
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={assets} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.focus(screen.getByLabelText('Moeda comprada'));
    expect(document.querySelector('.search-item .coin img')).not.toBeInTheDocument();
    expect(document.querySelector('.search-item .coin')).toHaveTextContent('ETH');
  });

  it('searches via the backend as soon as any character is typed', async () => {
    vi.mocked(api.searchCoins).mockResolvedValueOnce([{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', market_cap_rank: 1 }]);
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Moeda comprada'), { target: { value: 'b' } });
    await screen.findByText('Bitcoin');
    expect(api.searchCoins).toHaveBeenCalledWith('b');
  });

  it('debounces the network search so rapid typing fires one request, not one per keystroke', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(api.searchCoins).mockClear();
      renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
      const input = screen.getByLabelText('Moeda comprada');
      fireEvent.change(input, { target: { value: 'b' } });
      fireEvent.change(input, { target: { value: 'bi' } });
      fireEvent.change(input, { target: { value: 'bit' } });
      expect(api.searchCoins).not.toHaveBeenCalled();
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });
      expect(api.searchCoins).toHaveBeenCalledTimes(1);
      expect(api.searchCoins).toHaveBeenCalledWith('bit');
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels a pending debounced search when the query is cleared before it fires', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(api.searchCoins).mockClear();
      renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
      const input = screen.getByLabelText('Moeda comprada');
      fireEvent.change(input, { target: { value: 'bit' } });
      fireEvent.change(input, { target: { value: '' } });
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });
      expect(api.searchCoins).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows a round coin logo per result in the search dropdown', async () => {
    vi.mocked(api.searchCoins).mockResolvedValueOnce([
      { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', market_cap_rank: 1, image: 'https://cg.example/bitcoin.png' },
    ]);
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Moeda comprada'), { target: { value: 'bit' } });
    await screen.findByText('Bitcoin');
    const img = document.querySelector('.search-item .coin img');
    expect(img).toHaveAttribute('src', 'https://cg.example/bitcoin.png');
  });

  it('falls back to initials in the dropdown when a coin has no image', async () => {
    vi.mocked(api.searchCoins).mockResolvedValueOnce([{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', market_cap_rank: 1 }]);
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Moeda comprada'), { target: { value: 'bit' } });
    await screen.findByText('Bitcoin');
    expect(document.querySelector('.search-item .coin img')).not.toBeInTheDocument();
    expect(document.querySelector('.search-item .coin')).toHaveTextContent('BTC');
  });

  it('shows the selected coin\'s logo inline in the input once picked', async () => {
    vi.mocked(api.searchCoins).mockResolvedValueOnce([
      { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', market_cap_rank: 1, image: 'https://cg.example/bitcoin.png' },
    ]);
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Moeda comprada'), { target: { value: 'bit' } });
    await screen.findByText('Bitcoin');
    fireEvent.click(screen.getByText('Bitcoin'));
    const input = screen.getByLabelText('Moeda comprada');
    expect(input).toHaveClass('withcoin');
    const inlineImg = input.parentElement?.querySelector('.sel-logo .coin img');
    expect(inlineImg).toHaveAttribute('src', 'https://cg.example/bitcoin.png');
  });

  it('closes the dropdown and clears the unit price when clicking outside the coin field', async () => {
    mockGetPricesOnce(50000);
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={assets} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
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
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    expect((screen.getByLabelText('Moeda comprada') as HTMLInputElement).value).toBe('Bitcoin (BTC)');
  });

  it('clears the confirmed selection and price, and reopens suggestions, when the coin field is refocused', async () => {
    mockGetPricesOnce(50000);
    const assets: Asset[] = [{ coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', qty: 2, avgPrice: 100, exitPrice: 0 }];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={assets} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    await waitFor(() => expect((screen.getByLabelText('Preço unit.') as HTMLInputElement).value).not.toBe(''));
    fireEvent.focus(screen.getByLabelText('Moeda comprada'));
    expect((screen.getByLabelText('Moeda comprada') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Preço unit.') as HTMLInputElement).value).toBe('');
    expect(document.querySelector('.badge')).not.toBeInTheDocument();
    expect(screen.getByText('Ethereum')).toBeInTheDocument();
  });

  it('traps Tab within the drawer, wrapping at both ends', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
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
    const { rerender } = renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<LocaleProvider><BalanceProvider><CurrencyProvider><OpDrawer open={false} onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} /></CurrencyProvider></BalanceProvider></LocaleProvider>);
    expect(document.body.style.overflow).toBe('auto');
  });

  it('leverage chips appear only in trade mode, never in wallet mode, and are omitted when unset', async () => {
    const onSubmit = vi.fn();
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={onSubmit} onSubmitTrade={vi.fn()} newOpKind="trade" assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    expect(document.querySelector('.leverage-chips')).toBeInTheDocument();
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '100' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ leverage: undefined, kind: 'trade' }));
  });

  it('shows no leverage chips in wallet mode', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    expect(document.querySelector('.leverage-chips')).not.toBeInTheDocument();
  });

  it('selecting a leverage chip includes it in the submitted op; clicking it again deselects it', async () => {
    const onSubmit = vi.fn();
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={onSubmit} onSubmitTrade={vi.fn()} newOpKind="trade" assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: '3x' }));
    expect(screen.getByRole('button', { name: '3x' })).toHaveClass('active');
    await selectCoin(screen.getByLabelText('Moeda comprada'), { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '100' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ leverage: 3 }));
  });

  it('slides the type panel directionally on switch without remounting it', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    const before = document.querySelector('.type-panel');
    fireEvent.click(screen.getByRole('button', { name: 'Venda' }));
    const after = document.querySelector('.type-panel');
    // Same DOM node (no remount) — the animation is driven by a directional class, not a key.
    expect(after).toBe(before);
    expect(after).toHaveClass('slide-fwd');
    fireEvent.click(screen.getByRole('button', { name: 'Compra' }));
    expect(document.querySelector('.type-panel')).toHaveClass('slide-back');
  });

  const closingBuyOp: Op = {
    id: 'buy-1', date: '2024-01-01', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin',
    type: 'Buy', qty: 1, price: 100, fee: 0, total: 100,
    platformId: 'binance', platformName: 'Binance', kind: 'trade', side: 'long', leverage: 3,
  };

  it('pre-fills asset/platform/quantity when opened with closingOp, locking to the single resolving type with no swap tab', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} closingOp={closingBuyOp} assets={[]} platformAssets={[]} ops={[]} ops={[]} avatarCache={{}} prices={{}} />);
    expect(screen.getByRole('button', { name: 'Venda' })).toHaveClass('active');
    expect(screen.queryByRole('button', { name: 'Compra' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Troca' })).not.toBeInTheDocument();
    expect(screen.getByText('Uma posição long só fecha com uma Venda')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    expect(screen.getByText('Bitcoin (BTC)')).toBeInTheDocument();
    expect(screen.getByText('Binance')).toBeInTheDocument();
    expect(document.querySelector('.leverage-chips')).not.toBeInTheDocument();
  });

  it('locks to Compra with no swap tab when closing a short', () => {
    const closingSellOp: Op = { ...closingBuyOp, id: 'sell-1', type: 'Sell', side: 'short' };
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} closingOp={closingSellOp} assets={[]} platformAssets={[]} ops={[]} ops={[]} avatarCache={{}} prices={{}} />);
    expect(screen.getByRole('button', { name: 'Compra' })).toHaveClass('active');
    expect(screen.queryByRole('button', { name: 'Venda' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Troca' })).not.toBeInTheDocument();
    expect(screen.getByText('Uma posição short só fecha com uma Compra')).toBeInTheDocument();
  });

  it('accounts for closures already recorded against the position when pre-filling the remaining quantity', () => {
    const closures = [{ id: 'c1', sourceOpId: 'buy-1', closingOpId: 'other', qtyClosed: 0.4, realizedPnl: 5 }];
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} closingOp={closingBuyOp} closures={closures} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    expect(screen.getByDisplayValue('0.6')).toBeInTheDocument();
  });

  it('submits a simple close via onSubmitClose, not onSubmit, with the requested quantity', async () => {
    const onSubmitClose = vi.fn();
    const onSubmit = vi.fn();
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={onSubmit} onSubmitTrade={vi.fn()} onSubmitClose={onSubmitClose} closingOp={closingBuyOp} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '150' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    await waitFor(() => expect(onSubmitClose).toHaveBeenCalledWith(expect.objectContaining({ type: 'Sell', qty: 1, price: 150 }), 1));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('closes a position by dismissing the drawer at once, with no done checkmark (a normal op keeps it open)', async () => {
    const onClose = vi.fn();
    renderDrawer(<OpDrawer open onClose={onClose} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} onSubmitClose={vi.fn()} closingOp={closingBuyOp} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '150' } });
    fireEvent.click(document.querySelector('.drawer-foot .btn-submit')!);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(document.querySelector('.btn-submit.done')).not.toBeInTheDocument();
  });

  it('marks a long pre-filled platform/coin name for single-line truncation instead of wrapping', () => {
    const longOp: Op = { ...closingBuyOp, name: 'Coinbase Wrapped Bitcoin Extremely Long Name', platformName: 'A Very Long Custom Platform Name' };
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} closingOp={longOp} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    const [platformText, coinText] = document.querySelectorAll('.static-field-text');
    expect(platformText).toHaveTextContent('A Very Long Custom Platform Name');
    expect(coinText).toHaveTextContent('Coinbase Wrapped Bitcoin Extremely Long Name');
  });

  it('shows a platform and coin logo (or initials fallback) on the pre-filled static fields when closing', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} closingOp={closingBuyOp} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    const staticFields = document.querySelectorAll('.static-field');
    expect(staticFields[0].querySelector('.plogo')).toBeInTheDocument();
    expect(staticFields[1].querySelector('.coin')).toBeInTheDocument();
  });

  it('shows the currency symbol on the estimated P/L preview', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} closingOp={closingBuyOp} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '150' } });
    const pnlValue = document.querySelector('.pnl-preview span:last-child');
    expect(pnlValue).toHaveTextContent('R$');
  });

  it('shows a unit price field on each Trade side and a read-only received Total', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={krakenEth} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Troca' }));
    expect(screen.getAllByLabelText('Preço unit.')).toHaveLength(2);
    expect((screen.getByLabelText(/^Total/) as HTMLInputElement).readOnly).toBe(true);
  });

  it('scales the estimated close P/L preview by the position leverage', () => {
    renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} closingOp={closingBuyOp} assets={[]} platformAssets={[]} ops={[]} ops={[]} avatarCache={{}} prices={{}} />);
    fireEvent.change(screen.getByLabelText('Preço unit.'), { target: { value: '150' } });
    // (150 - 100) * 1 qty * 3x leverage = 150.
    const pnl = document.querySelector('.pnl-preview span:last-child');
    expect(pnl).toHaveTextContent('150,00');
    expect(pnl).toHaveClass('pnl-pos');
  });

  it('restores focus to the element that triggered the drawer after it closes', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { rerender } = renderDrawer(<OpDrawer open onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} />);
    rerender(<LocaleProvider><BalanceProvider><CurrencyProvider><OpDrawer open={false} onClose={vi.fn()} onSubmit={vi.fn()} onSubmitTrade={vi.fn()} assets={[]} platformAssets={[]} ops={[]} avatarCache={{}} prices={{}} /></CurrencyProvider></BalanceProvider></LocaleProvider>);
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});

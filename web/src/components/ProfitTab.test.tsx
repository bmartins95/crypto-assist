import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ProfitTab from './ProfitTab';
import type { Op } from '@/lib/types';
import { LocaleProvider } from '@/context/LocaleContext';
import { BalanceProvider } from '@/context/BalanceContext';
import { CurrencyProvider } from '@/context/CurrencyContext';
import { api } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  api: {
    getPriceHistory: vi.fn(async () => ({})),
    getExchangeRates: vi.fn(async () => ({ rates: { BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 }, updatedAt: '2026-01-01T00:00:00Z' })),
  },
}));

beforeEach(() => {
  localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify({ BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 }));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  localStorage.removeItem('profit_timeframe');
  localStorage.removeItem('profit_compare_asset');
});

// jsdom has no real canvas backend; chart.js itself isn't what we're
// testing here, so replace it with a stub constructor that records the
// config (and lets tests invoke its callbacks directly) instead of
// rendering to a canvas.
const chartMock = vi.hoisted(() => ({ configs: [] as unknown[], destroyCalls: 0 }));
vi.mock('chart.js/auto', () => ({
  default: class {
    constructor(_ctx: unknown, config: unknown) { chartMock.configs.push(config); }
    destroy() { chartMock.destroyCalls += 1; }
  },
}));
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

interface TooltipExternalArg {
  chart: { canvas: HTMLCanvasElement };
  tooltip: { opacity: number; dataPoints?: { dataIndex: number; datasetIndex: number }[]; caretX: number; caretY: number };
}

interface ChartConfig {
  data: { labels: string[]; datasets: { data: number[]; label?: string; yAxisID?: string; pointRadius?: number }[] };
  options: {
    plugins: {
      tooltip: {
        callbacks?: { label: (c: { raw: number; dataset: { label: string } }) => string };
        external?: (context: TooltipExternalArg) => void;
      };
      legend: { display: boolean; position?: string; labels?: { boxWidth: number } };
    };
    scales: { y: { ticks: { callback: (v: number) => string } }; y1?: { ticks: { callback: (v: number) => string; color: string } } };
  };
}

function triggerTooltip(config: ChartConfig, dataIndex: number, datasetIndex = 0): void {
  act(() => {
    config.options.plugins.tooltip.external?.({
      chart: { canvas: document.createElement('canvas') },
      tooltip: { opacity: 1, dataPoints: [{ dataIndex, datasetIndex }], caretX: 10, caretY: 20 },
    });
  });
}

function hideTooltip(config: ChartConfig): void {
  act(() => {
    config.options.plugins.tooltip.external?.({
      chart: { canvas: document.createElement('canvas') },
      tooltip: { opacity: 0, caretX: 0, caretY: 0 },
    });
  });
}

function lastChartConfig(): ChartConfig {
  return chartMock.configs[chartMock.configs.length - 1] as ChartConfig;
}

function op(overrides: Partial<Op>): Op {
  return {
    id: 'op-1', date: '2024-01-01', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin',
    type: 'Buy', qty: 1, price: 100, fee: 0, total: 100,
    ...overrides,
  };
}

function renderWithLocale(ui: React.ReactElement) {
  return render(<LocaleProvider><BalanceProvider><CurrencyProvider>{ui}</CurrencyProvider></BalanceProvider></LocaleProvider>);
}

function renderProfitTab(ops: Op[], prices: Record<string, number> = {}, activeChart: 'by-asset' | 'over-time' | 'value' = 'by-asset') {
  return renderWithLocale(
    <ProfitTab ops={ops} prices={prices} activeChart={activeChart} onChartSwitch={vi.fn()} statusMsg="" onFetchPrices={vi.fn()} />
  );
}

describe('ProfitTab', () => {
  it('attributes realized P/L to the closed portion of a partially-sold position', () => {
    const ops = [
      op({ type: 'Buy', qty: 1, price: 100 }),
      op({ id: 'op-2', date: '2024-01-02', type: 'Sell', qty: 0.5, price: 150 }),
    ];
    renderProfitTab(ops);
    // realized = 0.5 * (150 - 100) = +25 (closed-lot accounting, not the old sells-minus-buys cash flow)
    const posMetric = document.querySelector('.metric-value.pos');
    expect(posMetric?.textContent).toMatch(/25,00/);
  });

  it('shows unrealized P/L reflecting only the open position value', () => {
    const ops = [op({ type: 'Buy', qty: 1, price: 100 })];
    renderProfitTab(ops, { bitcoin: 150 });
    const unrealizedCard = screen.getByText('Não realizado').closest('.metric');
    expect(unrealizedCard?.querySelector('.metric-value')?.textContent).toMatch(/50,00/);
  });

  it('shows a placeholder on best/worst asset cards when there are no open positions', () => {
    const ops = [
      op({ type: 'Buy', qty: 1, price: 100 }),
      op({ id: 'op-2', date: '2024-01-02', type: 'Sell', qty: 1, price: 150 }),
    ];
    renderProfitTab(ops);
    const bestCard = screen.getByText('Melhor ativo').closest('.metric');
    const worstCard = screen.getByText('Pior ativo').closest('.metric');
    expect(bestCard?.querySelector('.metric-value')?.textContent).toBe('—');
    expect(worstCard?.querySelector('.metric-value')?.textContent).toBe('—');
  });

  it('excludes a fully-closed asset from best/worst ranking even with the highest realized return', () => {
    const ops = [
      op({ coinId: 'litecoin', symbol: 'LTC', name: 'Litecoin', type: 'Buy', qty: 1, price: 100 }),
      op({ id: 'op-2', coinId: 'bitcoin', type: 'Buy', qty: 1, price: 100 }),
      op({ id: 'op-3', date: '2024-01-02', coinId: 'bitcoin', type: 'Sell', qty: 1, price: 200 }),
    ];
    renderProfitTab(ops, { litecoin: 150 });
    const bestCard = screen.getByText('Melhor ativo').closest('.metric');
    expect(bestCard?.querySelector('.metric-value')?.textContent).toBe('LTC');
  });

  it('picks the highest and lowest unrealized return among two or more open positions', () => {
    const ops = [
      op({ coinId: 'litecoin', symbol: 'LTC', name: 'Litecoin', type: 'Buy', qty: 1, price: 100 }),
      op({ id: 'op-2', type: 'Buy', qty: 1, price: 100 }),
    ];
    renderProfitTab(ops, { litecoin: 150, bitcoin: 80 });
    const bestCard = screen.getByText('Melhor ativo').closest('.metric');
    const worstCard = screen.getByText('Pior ativo').closest('.metric');
    expect(bestCard?.querySelector('.metric-value')?.textContent).toBe('LTC');
    expect(worstCard?.querySelector('.metric-value')?.textContent).toBe('BTC');
  });

  it('colors best/worst and the unrealized total negative when every open position is down', () => {
    const ops = [
      op({ coinId: 'litecoin', symbol: 'LTC', name: 'Litecoin', type: 'Buy', qty: 1, price: 100 }),
      op({ id: 'op-2', type: 'Buy', qty: 1, price: 100 }),
    ];
    renderProfitTab(ops, { litecoin: 80, bitcoin: 50 });
    const bestCard = screen.getByText('Melhor ativo').closest('.metric');
    const unrealizedCard = screen.getByText('Não realizado').closest('.metric');
    expect(bestCard?.querySelector('.metric-value')?.textContent).toBe('LTC');
    expect(bestCard?.querySelector('.metric-sub')?.className).toContain('neg');
    expect(unrealizedCard?.querySelector('.metric-value')?.className).toContain('neg');
  });

  it('switches the active chart when clicking a chart button', () => {
    const onChartSwitch = vi.fn();
    renderWithLocale(<ProfitTab ops={[op({})]} prices={{}} activeChart="by-asset" onChartSwitch={onChartSwitch} statusMsg="" onFetchPrices={vi.fn()} />);
    fireEvent.click(screen.getByText('Lucro no tempo'));
    expect(onChartSwitch).toHaveBeenCalledWith('over-time');
  });

  it('renders no icon inside the chart-mode segmented control', () => {
    renderProfitTab([op({})]);
    expect(document.querySelectorAll('.chart-switcher i')).toHaveLength(0);
  });

  it('renders a label icon on each of the four metric cards', () => {
    renderProfitTab([op({})]);
    expect(document.querySelectorAll('.metric-label i')).toHaveLength(4);
  });

  it('shows an uppercase chart panel title matching the active chart mode', () => {
    renderProfitTab([op({})], {}, 'over-time');
    const title = document.querySelector('.chart-area .sec-title');
    expect(title?.textContent).toBe('Lucro no tempo');
  });

  it('plots realized and unrealized P/L for every asset, including fully-closed ones, and reconciles with the metric cards', () => {
    const ops = [
      op({ type: 'Buy', qty: 1, price: 100 }),
      op({ id: 'op-2', date: '2024-01-02', type: 'Sell', qty: 1, price: 50 }),
      op({ id: 'op-3', coinId: 'litecoin', symbol: 'LTC', name: 'Litecoin', type: 'Buy', qty: 1, price: 100 }),
    ];
    renderProfitTab(ops, { litecoin: 120 });
    const config = lastChartConfig();
    expect(config.data.labels).toEqual(expect.arrayContaining(['BTC', 'LTC']));
    const sumChart = config.data.datasets[0].data.reduce((s, v) => s + v, 0);
    // BTC realized -50, LTC unrealized +20 → total -30, matching realized(-50) + unrealized(+20) shown in the metric cards
    expect(sumChart).toBeCloseTo(-30, 2);
    // the by-asset branch always sets callbacks (only over-time/value use the external tooltip)
    expect(config.options.plugins.tooltip.callbacks!.label({ raw: 30, dataset: { label: '' } })).toContain('30');
    expect(config.options.scales.y.ticks.callback(30)).toContain('30');
  });

  it('renders a P/L-over-time line chart when the "over-time" mode is active', () => {
    const ops = [op({ type: 'Buy', qty: 1, price: 100 })];
    renderProfitTab(ops, { bitcoin: 150 }, 'over-time');
    const config = lastChartConfig();
    expect(config.data.datasets[0].data.length).toBeGreaterThan(0);
    expect(config.options.scales.y.ticks.callback(50)).toContain('50');
  });

  it('renders an invested-vs-current-value line chart when the "value" mode is active', () => {
    const ops = [op({ type: 'Buy', qty: 1, price: 100 })];
    renderProfitTab(ops, { bitcoin: 150 }, 'value');
    const config = lastChartConfig();
    expect(config.data.datasets).toHaveLength(2);
    expect(config.options.scales.y.ticks.callback(150)).toContain('150');
  });

  it('fetches historical prices for the selected timeframe range and prices the chart from them, not the live current price', async () => {
    localStorage.setItem('profit_timeframe', 'all');
    vi.setSystemTime(new Date('2024-01-02T00:00:00Z'));
    vi.mocked(api.getPriceHistory).mockResolvedValueOnce({ bitcoin: { '2024-01-01': 100, '2024-01-02': 120 } });
    const ops = [op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 })];
    renderProfitTab(ops, { bitcoin: 999999 }, 'over-time');

    await waitFor(() => expect(api.getPriceHistory).toHaveBeenCalledWith(['bitcoin'], '2024-01-01', '2024-01-02'));
    await waitFor(() => {
      const config = lastChartConfig();
      expect(config.data.datasets[0].data).toEqual([0, 20]);
    });
  });

  it('shows a visible error message when fetching historical prices fails', async () => {
    vi.mocked(api.getPriceHistory).mockRejectedValueOnce(new Error('network down'));
    const ops = [op({ type: 'Buy', qty: 1, price: 100 })];
    renderProfitTab(ops, {}, 'over-time');
    await waitFor(() => expect(screen.getByText('Ocorreu um erro. Tente novamente.')).toBeInTheDocument());
  });

  it('shows the timeframe selector only for the two time-based chart modes', () => {
    renderProfitTab([op({})], {}, 'by-asset');
    expect(document.querySelector('.tf')).not.toBeInTheDocument();
  });

  it('shows the timeframe selector for the over-time and value chart modes', () => {
    renderProfitTab([op({})], {}, 'over-time');
    expect(document.querySelector('.tf')).toBeInTheDocument();
  });

  it('defaults to the 1m timeframe when nothing is persisted', () => {
    renderProfitTab([op({})], {}, 'over-time');
    expect(screen.getByText('1M')).toHaveAttribute('aria-pressed', 'true');
  });

  it('reads a persisted timeframe from localStorage on mount', () => {
    localStorage.setItem('profit_timeframe', '1y');
    renderProfitTab([op({})], {}, 'over-time');
    expect(screen.getByText('1A')).toHaveAttribute('aria-pressed', 'true');
  });

  it('narrows the fetched range when a timeframe option is selected and persists the choice', async () => {
    vi.setSystemTime(new Date('2024-02-01T00:00:00Z'));
    const ops = [op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 })];
    renderProfitTab(ops, { bitcoin: 100 }, 'over-time');
    await waitFor(() => expect(api.getPriceHistory).toHaveBeenCalled());
    vi.mocked(api.getPriceHistory).mockClear();

    fireEvent.click(screen.getByText('1D'));
    await waitFor(() => expect(api.getPriceHistory).toHaveBeenCalledWith(['bitcoin'], '2024-01-31', '2024-02-01'));
    expect(localStorage.getItem('profit_timeframe')).toBe('1d');
  });

  it('shows the empty-timeframe message when the selected window yields fewer than 2 points', async () => {
    localStorage.setItem('profit_timeframe', 'all');
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    const ops = [op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 })];
    renderProfitTab(ops, { bitcoin: 150 }, 'over-time');
    await waitFor(() => expect(api.getPriceHistory).toHaveBeenCalled());
    expect(screen.getByText('Sem dados no período')).toBeInTheDocument();
  });

  it('destroys the previous chart instance before creating a new one on re-render', () => {
    const { rerender } = renderProfitTab([op({ type: 'Buy', qty: 1, price: 100 })], { bitcoin: 150 }, 'by-asset');
    const destroysBefore = chartMock.destroyCalls;
    rerender(
      <LocaleProvider><BalanceProvider><CurrencyProvider>
        <ProfitTab ops={[op({ type: 'Buy', qty: 1, price: 100 })]} prices={{ bitcoin: 150 }} activeChart="over-time" onChartSwitch={vi.fn()} statusMsg="" onFetchPrices={vi.fn()} />
      </CurrencyProvider></BalanceProvider></LocaleProvider>
    );
    expect(chartMock.destroyCalls).toBeGreaterThan(destroysBefore);
  });

  it('only lists open positions in the allocation panel', () => {
    const ops = [
      op({ type: 'Buy', qty: 1, price: 100 }),
      op({ id: 'op-2', date: '2024-01-02', type: 'Sell', qty: 1, price: 50 }),
      op({ id: 'op-3', coinId: 'litecoin', symbol: 'LTC', name: 'Litecoin', type: 'Buy', qty: 1, price: 100 }),
    ];
    renderProfitTab(ops, { litecoin: 120 });
    const distSection = document.querySelector('.dist-section');
    expect(distSection?.textContent).toContain('Litecoin');
    expect(distSection?.textContent).not.toContain('Bitcoin');
  });

  it('shows the empty distribution message when there is no investment', () => {
    renderProfitTab([]);
    expect(screen.getAllByText('Registre operações e atualize os preços').length).toBeGreaterThan(0);
  });

  it('reflects the selected currency in the subtitle instead of a hardcoded value', () => {
    localStorage.setItem('crypto-assist:currency', 'EUR');
    renderProfitTab([]);
    expect(screen.getByText(/· EUR/)).toBeInTheDocument();
    expect(screen.queryByText(/· BRL/)).not.toBeInTheDocument();
  });
});

function multiAssetOps(): Op[] {
  return [
    op({ id: 'b1', date: '2024-01-01', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Buy', qty: 1, price: 100 }),
    op({ id: 'e1', date: '2024-01-01', coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', type: 'Buy', qty: 1, price: 50 }),
  ];
}

describe('Per-asset compare overlay (US1)', () => {
  beforeEach(() => {
    localStorage.setItem('profit_timeframe', 'all');
    vi.setSystemTime(new Date('2024-01-02T00:00:00Z'));
  });

  it('does not show the compare control (or an overlay) on the Portfolio-value chart', async () => {
    vi.mocked(api.getPriceHistory).mockResolvedValueOnce({
      bitcoin: { '2024-01-01': 100, '2024-01-02': 110 },
      ethereum: { '2024-01-01': 50, '2024-01-02': 55 },
    });
    renderProfitTab(multiAssetOps(), { bitcoin: 110, ethereum: 55 }, 'value');
    await waitFor(() => expect(lastChartConfig().data.datasets[0].data.length).toBeGreaterThan(0));
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(lastChartConfig().data.datasets).toHaveLength(2);
  });

  it('shows a "Compare with" control with Nenhum plus one option per held asset', async () => {
    vi.mocked(api.getPriceHistory).mockResolvedValueOnce({
      bitcoin: { '2024-01-01': 100, '2024-01-02': 110 },
      ethereum: { '2024-01-01': 50, '2024-01-02': 55 },
    });
    renderProfitTab(multiAssetOps(), { bitcoin: 110, ethereum: 55 }, 'over-time');
    await waitFor(() => expect(screen.getByRole('radio', { name: 'BTC' })).toBeInTheDocument());
    expect(screen.getByRole('radio', { name: 'Nenhum' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'ETH' })).toBeInTheDocument();
  });

  it('selecting an asset adds a dashed overlay dataset on an independent right-hand axis', async () => {
    vi.mocked(api.getPriceHistory).mockResolvedValueOnce({
      bitcoin: { '2024-01-01': 100, '2024-01-02': 110 },
      ethereum: { '2024-01-01': 50, '2024-01-02': 55 },
    });
    renderProfitTab(multiAssetOps(), { bitcoin: 110, ethereum: 55 }, 'over-time');
    await waitFor(() => expect(screen.getByRole('radio', { name: 'BTC' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('radio', { name: 'BTC' }));
    await waitFor(() => {
      const config = lastChartConfig();
      expect(config.data.datasets).toHaveLength(2);
      expect(config.data.datasets[1].yAxisID).toBe('y1');
      expect(config.options.scales.y1).toBeDefined();
      // Plots the asset's absolute price (not a normalized %) — the independent y1 axis is
      // what solves the scale problem, not normalization — and renders visible point markers
      // so the user has something to aim for when hovering, not just an invisible line.
      expect(config.data.datasets[1].data).toEqual([100, 110]);
      expect(config.data.datasets[1].pointRadius).toBe(3);
      expect(config.options.scales.y1?.ticks.callback(110)).toContain('110,00');
    });
  });

  it('gives the overlay legend the same compact styling as the portfolio-value chart legend', async () => {
    vi.mocked(api.getPriceHistory).mockResolvedValueOnce({
      bitcoin: { '2024-01-01': 100, '2024-01-02': 110 },
      ethereum: { '2024-01-01': 50, '2024-01-02': 55 },
    });
    renderProfitTab(multiAssetOps(), { bitcoin: 110, ethereum: 55 }, 'over-time');
    await waitFor(() => expect(screen.getByRole('radio', { name: 'BTC' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('radio', { name: 'BTC' }));
    await waitFor(() => {
      const config = lastChartConfig();
      expect(config.options.plugins.legend.position).toBe('top');
      expect(config.options.plugins.legend.labels?.boxWidth).toBe(12);
    });
  });

  it('shows an asset-specific tooltip (value, average price, acquisitions) when hovering the compare overlay line', async () => {
    vi.mocked(api.getPriceHistory).mockResolvedValueOnce({
      bitcoin: { '2024-01-01': 100, '2024-01-02': 110 },
      ethereum: { '2024-01-01': 50, '2024-01-02': 55 },
    });
    renderProfitTab(multiAssetOps(), { bitcoin: 110, ethereum: 55 }, 'over-time');
    await waitFor(() => expect(screen.getByRole('radio', { name: 'BTC' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('radio', { name: 'BTC' }));
    await waitFor(() => expect(lastChartConfig().data.datasets).toHaveLength(2));

    triggerTooltip(lastChartConfig(), 1, 1);
    const el = document.querySelector('.chart-tooltip');
    expect(el?.innerHTML).toContain('110,00');
    expect(el?.innerHTML).toContain('Preço médio');
    expect(el?.innerHTML).toContain('100,00');
    expect(el?.innerHTML).toContain('Aquisições');
    expect(el?.innerHTML).toMatch(/BTC.*100,00/);
  });

  it('does not rebuild (re-animate) the chart on hover — only on load or data change', async () => {
    vi.mocked(api.getPriceHistory).mockResolvedValueOnce({ bitcoin: { '2024-01-01': 100, '2024-01-02': 150 } });
    const ops = [op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 })];
    renderProfitTab(ops, { bitcoin: 150 }, 'over-time');
    await waitFor(() => expect(lastChartConfig().data.datasets[0].data[1]).toBe(50));

    const destroysBefore = chartMock.destroyCalls;
    triggerTooltip(lastChartConfig(), 0);
    triggerTooltip(lastChartConfig(), 1);
    expect(chartMock.destroyCalls).toBe(destroysBefore);
  });

  it('replaces the overlay (never accumulates) when a different asset is selected', async () => {
    vi.mocked(api.getPriceHistory).mockResolvedValueOnce({
      bitcoin: { '2024-01-01': 100, '2024-01-02': 110 },
      ethereum: { '2024-01-01': 50, '2024-01-02': 55 },
    });
    renderProfitTab(multiAssetOps(), { bitcoin: 110, ethereum: 55 }, 'over-time');
    await waitFor(() => expect(screen.getByRole('radio', { name: 'BTC' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('radio', { name: 'BTC' }));
    await waitFor(() => expect(lastChartConfig().data.datasets).toHaveLength(2));
    fireEvent.click(screen.getByRole('radio', { name: 'ETH' }));
    await waitFor(() => {
      const config = lastChartConfig();
      expect(config.data.datasets).toHaveLength(2);
      expect(config.data.datasets[1].label).toContain('ETH');
    });
  });

  it('clears the overlay when "Nenhum" is selected', async () => {
    vi.mocked(api.getPriceHistory).mockResolvedValueOnce({
      bitcoin: { '2024-01-01': 100, '2024-01-02': 110 },
      ethereum: { '2024-01-01': 50, '2024-01-02': 55 },
    });
    renderProfitTab(multiAssetOps(), { bitcoin: 110, ethereum: 55 }, 'over-time');
    await waitFor(() => expect(screen.getByRole('radio', { name: 'BTC' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('radio', { name: 'BTC' }));
    await waitFor(() => expect(lastChartConfig().data.datasets).toHaveLength(2));
    fireEvent.click(screen.getByRole('radio', { name: 'Nenhum' }));
    await waitFor(() => expect(lastChartConfig().data.datasets).toHaveLength(1));
  });

  it('does not add a broken overlay when the compared asset has no price history for the period', async () => {
    vi.mocked(api.getPriceHistory).mockResolvedValueOnce({ bitcoin: { '2024-01-01': 100, '2024-01-02': 110 } });
    renderProfitTab(multiAssetOps(), { bitcoin: 110, ethereum: 55 }, 'over-time');
    await waitFor(() => expect(screen.getByRole('radio', { name: 'ETH' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('radio', { name: 'ETH' }));
    await waitFor(() => expect(lastChartConfig().data.datasets).toHaveLength(1));
  });

  it('persists the compare selection and restores it on remount', async () => {
    vi.mocked(api.getPriceHistory).mockResolvedValue({
      bitcoin: { '2024-01-01': 100, '2024-01-02': 110 },
      ethereum: { '2024-01-01': 50, '2024-01-02': 55 },
    });
    const { unmount } = renderProfitTab(multiAssetOps(), { bitcoin: 110, ethereum: 55 }, 'over-time');
    await waitFor(() => expect(screen.getByRole('radio', { name: 'BTC' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('radio', { name: 'BTC' }));
    await waitFor(() => expect(localStorage.getItem('profit_compare_asset')).toBe('bitcoin'));
    unmount();

    renderProfitTab(multiAssetOps(), { bitcoin: 110, ethereum: 55 }, 'over-time');
    await waitFor(() => expect(screen.getByRole('radio', { name: 'BTC' })).toHaveAttribute('aria-checked', 'true'));
  });

  it('falls back to "Nenhum" when the persisted comparison asset is no longer held', async () => {
    localStorage.setItem('profit_compare_asset', 'dogecoin');
    vi.mocked(api.getPriceHistory).mockResolvedValueOnce({ bitcoin: { '2024-01-01': 100, '2024-01-02': 110 } });
    renderProfitTab([op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 })], { bitcoin: 110 }, 'over-time');
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Nenhum' })).toHaveAttribute('aria-checked', 'true'));
  });
});

describe('Assets over time list + detail chart (US2 wiring)', () => {
  it('mounts the asset list below the chart and opens the detail chart on row click', async () => {
    localStorage.setItem('profit_timeframe', 'all');
    vi.setSystemTime(new Date('2024-01-02T00:00:00Z'));
    vi.mocked(api.getPriceHistory).mockResolvedValueOnce({ bitcoin: { '2024-01-01': 100, '2024-01-02': 110 } });
    renderProfitTab([op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 })], { bitcoin: 110 }, 'over-time');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Bitcoin BTC' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Bitcoin BTC' }));
    expect(screen.getByRole('dialog', { name: 'Bitcoin BTC' })).toBeInTheDocument();
  });

  it('does not show the assets list on the "by-asset" chart mode', () => {
    renderProfitTab([op({ type: 'Buy', qty: 1, price: 100 })], { bitcoin: 110 }, 'by-asset');
    expect(document.querySelector('.assets-list')).not.toBeInTheDocument();
  });

  it('does not rebuild (re-animate) the main Profit chart when opening the asset detail view', async () => {
    localStorage.setItem('profit_timeframe', 'all');
    vi.setSystemTime(new Date('2024-01-02T00:00:00Z'));
    vi.mocked(api.getPriceHistory).mockResolvedValueOnce({ bitcoin: { '2024-01-01': 100, '2024-01-02': 110 } });
    renderProfitTab([op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 })], { bitcoin: 110 }, 'over-time');
    // Wait for the real historical-price data to land (not just the row appearing, which can
    // render off the pre-load default) so the destroy count below isn't polluted by that
    // legitimate, data-driven rebuild racing with the click.
    await waitFor(() => expect(lastChartConfig().data.datasets[0].data[1]).toBe(10));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Bitcoin BTC' })).toBeInTheDocument());

    const destroysBefore = chartMock.destroyCalls;
    fireEvent.click(screen.getByRole('button', { name: 'Bitcoin BTC' }));
    expect(screen.getByRole('dialog', { name: 'Bitcoin BTC' })).toBeInTheDocument();
    expect(chartMock.destroyCalls).toBe(destroysBefore);
  });
});

describe('Enriched profit tooltip (US3)', () => {
  beforeEach(() => {
    localStorage.setItem('profit_timeframe', 'all');
    vi.setSystemTime(new Date('2024-01-02T00:00:00Z'));
  });

  it('shows date/weekday, cumulative profit, day delta, and the realized/unrealized/ops breakdown — with no per-asset text', async () => {
    vi.mocked(api.getPriceHistory).mockResolvedValueOnce({ bitcoin: { '2024-01-01': 100, '2024-01-02': 150 } });
    const ops = [op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 })];
    renderProfitTab(ops, { bitcoin: 150 }, 'over-time');
    await waitFor(() => expect(lastChartConfig().data.datasets[0].data[1]).toBe(50));

    triggerTooltip(lastChartConfig(), 1);
    const el = document.querySelector('.chart-tooltip');
    expect(el?.innerHTML).toContain('Realizado');
    expect(el?.innerHTML).toContain('Não realizado');
    expect(el?.innerHTML).toContain('Operações no dia');
    expect(el?.innerHTML).toContain('50,00');
    expect(el?.innerHTML).not.toContain('BTC');
  });

  it('hides the tooltip when the pointer leaves the chart', async () => {
    vi.mocked(api.getPriceHistory).mockResolvedValueOnce({ bitcoin: { '2024-01-01': 100, '2024-01-02': 150 } });
    const ops = [op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 })];
    renderProfitTab(ops, { bitcoin: 150 }, 'over-time');
    await waitFor(() => expect(lastChartConfig().data.datasets[0].data[1]).toBe(50));

    triggerTooltip(lastChartConfig(), 1);
    const el = document.querySelector('.chart-tooltip') as HTMLElement;
    expect(el.style.opacity).toBe('1');
    hideTooltip(lastChartConfig());
    expect(el.style.opacity).toBe('0');
  });

  it('hovering a day highlights that day\'s per-asset contribution in the compare control and asset list', async () => {
    vi.mocked(api.getPriceHistory).mockResolvedValueOnce({
      bitcoin: { '2024-01-01': 100, '2024-01-02': 110 },
      ethereum: { '2024-01-01': 50, '2024-01-02': 60 },
    });
    renderProfitTab(multiAssetOps(), { bitcoin: 110, ethereum: 60 }, 'over-time');
    await waitFor(() => expect(lastChartConfig().data.datasets[0].data[1]).toBe(20));

    triggerTooltip(lastChartConfig(), 1);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'BTC' }).className).toContain('compare-control-highlighted'));
    expect(screen.getByRole('button', { name: 'Bitcoin BTC' }).className).toContain('assets-list-row--highlighted');
  });

  it('shows each asset\'s price for the hovered day in the asset list, not the live price', async () => {
    vi.mocked(api.getPriceHistory).mockResolvedValueOnce({
      bitcoin: { '2024-01-01': 100, '2024-01-02': 110 },
      ethereum: { '2024-01-01': 50, '2024-01-02': 60 },
    });
    renderProfitTab(multiAssetOps(), { bitcoin: 999999, ethereum: 999999 }, 'over-time');
    await waitFor(() => expect(lastChartConfig().data.datasets[0].data[1]).toBe(20));
    expect(screen.getByRole('button', { name: 'Bitcoin BTC' }).textContent).toMatch(/999\.999,00/);

    triggerTooltip(lastChartConfig(), 1);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Bitcoin BTC' }).textContent).toMatch(/110,00/);
      expect(screen.getByRole('button', { name: 'Ethereum ETH' }).textContent).toMatch(/60,00/);
    });
  });
});

describe('Enriched portfolio-value tooltip (US4)', () => {
  it('shows current value, invested, unrealized result, and day variation', async () => {
    localStorage.setItem('profit_timeframe', 'all');
    vi.setSystemTime(new Date('2024-01-02T00:00:00Z'));
    vi.mocked(api.getPriceHistory).mockResolvedValueOnce({ bitcoin: { '2024-01-01': 100, '2024-01-02': 150 } });
    const ops = [op({ date: '2024-01-01', type: 'Buy', qty: 1, price: 100 })];
    renderProfitTab(ops, { bitcoin: 150 }, 'value');
    await waitFor(() => expect(lastChartConfig().data.datasets[0].data[1]).toBe(150));

    triggerTooltip(lastChartConfig(), 1);
    const el = document.querySelector('.chart-tooltip');
    expect(el?.innerHTML).toContain('Valor atual');
    expect(el?.innerHTML).toContain('Investido');
    expect(el?.innerHTML).toContain('Resultado não realizado');
    expect(el?.innerHTML).toContain('Variação no dia');
  });
});

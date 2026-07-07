import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProfitTab from './ProfitTab';
import type { Op } from '@/lib/types';
import { LocaleProvider } from '@/context/LocaleContext';
import { BalanceProvider } from '@/context/BalanceContext';
import { CurrencyProvider } from '@/context/CurrencyContext';

beforeEach(() => {
  localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify({ BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 }));
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

interface ChartConfig {
  data: { labels: string[]; datasets: { data: number[]; label?: string }[] };
  options: {
    plugins: { tooltip: { callbacks: { label: (c: { raw: number; dataset: { label: string } }) => string } } };
    scales: { y: { ticks: { callback: (v: number) => string } } };
  };
}

function lastChartConfig(): ChartConfig {
  return chartMock.configs[chartMock.configs.length - 1] as ChartConfig;
}

function op(overrides: Partial<Op>): Op {
  return {
    id: 'op-1', date: '2024-01-01', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin',
    type: 'Buy', qty: 1, price: 100, fee: 0, total: 100, platform: '',
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
    expect(config.options.plugins.tooltip.callbacks.label({ raw: 30, dataset: { label: '' } })).toContain('30');
    expect(config.options.scales.y.ticks.callback(30)).toContain('30');
  });

  it('renders a P/L-over-time line chart when the "over-time" mode is active', () => {
    const ops = [op({ type: 'Buy', qty: 1, price: 100 })];
    renderProfitTab(ops, { bitcoin: 150 }, 'over-time');
    const config = lastChartConfig();
    expect(config.data.datasets[0].data.length).toBeGreaterThan(0);
    expect(config.options.plugins.tooltip.callbacks.label({ raw: 50, dataset: { label: '' } })).toContain('50');
    expect(config.options.scales.y.ticks.callback(50)).toContain('50');
  });

  it('renders an invested-vs-current-value line chart when the "value" mode is active', () => {
    const ops = [op({ type: 'Buy', qty: 1, price: 100 })];
    renderProfitTab(ops, { bitcoin: 150 }, 'value');
    const config = lastChartConfig();
    expect(config.data.datasets).toHaveLength(2);
    expect(config.options.plugins.tooltip.callbacks.label({ raw: 150, dataset: { label: 'X' } })).toContain('150');
    expect(config.options.scales.y.ticks.callback(150)).toContain('150');
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

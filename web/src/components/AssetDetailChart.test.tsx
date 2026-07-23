import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AssetDetailChart, { AssetDetailData } from './AssetDetailChart';
import { LocaleProvider } from '@/context/LocaleContext';

const chartMock = vi.hoisted(() => ({ configs: [] as unknown[], destroyCalls: 0 }));
vi.mock('chart.js/auto', () => ({
  default: class {
    constructor(_ctx: unknown, config: unknown) { chartMock.configs.push(config); }
    destroy() { chartMock.destroyCalls += 1; }
  },
}));
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

interface DetailChartConfig {
  data: { datasets: { data: number[]; pointRadius?: number; pointHoverRadius?: number }[] };
  options: {
    plugins: { tooltip: { callbacks: { label: (c: { raw: number }) => string } } };
    scales: { y: { ticks: { callback: (v: number) => string } } };
  };
}

function lastConfig(): DetailChartConfig {
  return chartMock.configs[chartMock.configs.length - 1] as DetailChartConfig;
}

const ASSET: AssetDetailData = {
  coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: 350000, absChange: 12.5,
  priceSeries: [100, 105, 112.5],
  color: '#f97316',
};

function renderModal(asset = ASSET, dates = ['2024-01-01', '2024-01-02', '2024-01-03'], onClose = vi.fn()) {
  return render(
    <LocaleProvider>
      <AssetDetailChart asset={asset} dates={dates} fmtMoney={v => `R$${v}`} onClose={onClose} />
    </LocaleProvider>
  );
}

describe('AssetDetailChart', () => {
  it('opens showing the clicked asset\'s absolute-price series for the active timeframe', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: 'Bitcoin BTC' })).toBeInTheDocument();
    const config = lastConfig();
    expect(config.data.datasets[0].data).toEqual(ASSET.priceSeries);
    expect(config.options.plugins.tooltip.callbacks.label({ raw: 112.5 })).toContain('R$112.5');
    expect(config.options.scales.y.ticks.callback(112.5)).toContain('R$112.5');
  });

  it('shows visible point markers on the line, not just on hover', () => {
    renderModal();
    const config = lastConfig();
    expect(config.data.datasets[0].pointRadius).toBeGreaterThan(0);
  });

  it('shows the cached coin logo image next to the asset name when available', () => {
    renderModal({ ...ASSET, image: 'https://assets.coingecko.com/btc.png' });
    const logo = document.querySelector('.asset-detail-identity img');
    expect(logo).toHaveAttribute('src', 'https://assets.coingecko.com/btc.png');
  });

  it('falls back to the ticker initials when no logo is cached', () => {
    renderModal();
    expect(document.querySelector('.asset-detail-identity img')).not.toBeInTheDocument();
    expect(document.querySelector('.asset-detail-identity')?.textContent).toContain('BTC');
  });

  it('closes when the close button is clicked', () => {
    const onClose = vi.fn();
    renderModal(ASSET, undefined, onClose);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the backdrop is clicked', () => {
    const onClose = vi.fn();
    renderModal(ASSET, undefined, onClose);
    fireEvent.click(screen.getByRole('dialog').parentElement as Element);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    renderModal(ASSET, undefined, onClose);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an empty state instead of a chart when the asset has fewer than 2 data points', () => {
    renderModal({ ...ASSET, priceSeries: [] });
    expect(screen.getByText('Sem dados no período')).toBeInTheDocument();
  });

  it('does not rebuild (re-animate) the chart when re-rendered with an equal-content but new object/array reference', () => {
    const { rerender } = renderModal();
    const destroysBefore = chartMock.destroyCalls;
    rerender(
      <LocaleProvider>
        <AssetDetailChart
          asset={{ ...ASSET, priceSeries: [...ASSET.priceSeries] }}
          dates={['2024-01-01', '2024-01-02', '2024-01-03']}
          fmtMoney={v => `R$${v}`}
          onClose={vi.fn()}
        />
      </LocaleProvider>
    );
    expect(chartMock.destroyCalls).toBe(destroysBefore);
  });

  it('rebuilds the chart when the underlying price data actually changes', () => {
    const { rerender } = renderModal();
    const destroysBefore = chartMock.destroyCalls;
    rerender(
      <LocaleProvider>
        <AssetDetailChart
          asset={{ ...ASSET, priceSeries: [100, 105, 999] }}
          dates={['2024-01-01', '2024-01-02', '2024-01-03']}
          fmtMoney={v => `R$${v}`}
          onClose={vi.fn()}
        />
      </LocaleProvider>
    );
    expect(chartMock.destroyCalls).toBeGreaterThan(destroysBefore);
  });
});

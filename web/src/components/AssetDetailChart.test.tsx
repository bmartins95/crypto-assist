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
  data: { datasets: { data: number[] }[] };
  options: {
    plugins: { tooltip: { callbacks: { label: (c: { raw: number }) => string } } };
    scales: { y: { ticks: { callback: (v: number) => string } } };
  };
}

function lastConfig(): DetailChartConfig {
  return chartMock.configs[chartMock.configs.length - 1] as DetailChartConfig;
}

const ASSET: AssetDetailData = {
  coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: 350000, pctChange: 12.5,
  series: [0, 5, 12.5],
  color: '#f97316',
};

function renderModal(asset = ASSET, dates = ['2024-01-01', '2024-01-02', '2024-01-03'], onClose = vi.fn()) {
  render(
    <LocaleProvider>
      <AssetDetailChart asset={asset} dates={dates} fmtMoney={v => `R$${v}`} onClose={onClose} />
    </LocaleProvider>
  );
  return onClose;
}

describe('AssetDetailChart', () => {
  it('opens showing the clicked asset\'s series for the active timeframe', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: 'Bitcoin BTC' })).toBeInTheDocument();
    const config = lastConfig();
    expect(config.data.datasets[0].data).toEqual(ASSET.series);
    expect(config.options.plugins.tooltip.callbacks.label({ raw: 12.5 })).toContain('12.5');
    expect(config.options.scales.y.ticks.callback(12.5)).toContain('12.5');
  });

  it('closes when the close button is clicked', () => {
    const onClose = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the backdrop is clicked', () => {
    const onClose = renderModal();
    fireEvent.click(screen.getByRole('dialog').parentElement as Element);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const onClose = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an empty state instead of a chart when the asset has fewer than 2 data points', () => {
    renderModal({ ...ASSET, series: [] });
    expect(screen.getByText('Sem dados no período')).toBeInTheDocument();
  });
});

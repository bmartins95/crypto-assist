import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProfitTab from './ProfitTab';
import type { Asset, Op } from '@/lib/types';

// jsdom has no real canvas backend; chart.js itself isn't what we're
// testing here, so replace it with a no-op constructor and stub
// getContext to avoid noisy "not implemented" console errors.
vi.mock('chart.js/auto', () => ({
  default: class {
    destroy() {}
  },
}));
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

const asset: Asset = { coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', qty: 1, avgPrice: 100, exitPrice: 0 };

const ops: Op[] = [
  { date: '2024-01-01', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Compra', qty: 1, price: 100, fee: 0, total: 100, platform: '' },
  { date: '2024-01-02', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'Venda', qty: 0.5, price: 150, fee: 0, total: 75, platform: '' },
];

describe('ProfitTab', () => {
  it('computes realized profit from sells minus buys', () => {
    render(<ProfitTab assets={[asset]} ops={ops} prices={{}} activeChart="by-asset" onChartSwitch={vi.fn()} />);
    // realized = 75 (sell total) - 100 (buy total) = -25
    expect(screen.getByText('R$ -25,00')).toBeInTheDocument();
  });

  it('switches the active chart when clicking a chart button', () => {
    const onChartSwitch = vi.fn();
    render(<ProfitTab assets={[asset]} ops={ops} prices={{}} activeChart="by-asset" onChartSwitch={onChartSwitch} />);
    fireEvent.click(screen.getByText('Lucro no tempo'));
    expect(onChartSwitch).toHaveBeenCalledWith('over-time');
  });

  it('shows the empty distribution message when there is no investment', () => {
    render(<ProfitTab assets={[]} ops={[]} prices={{}} activeChart="by-asset" onChartSwitch={vi.fn()} />);
    expect(screen.getByText('Registre operações e atualize os preços')).toBeInTheDocument();
  });
});

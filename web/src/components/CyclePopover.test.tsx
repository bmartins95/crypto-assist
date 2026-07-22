import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CyclePopover from './CyclePopover';
import type { Cycle, Op } from '@/lib/types';
import { LocaleProvider } from '@/context/LocaleContext';
import { CurrencyProvider } from '@/context/CurrencyContext';

function renderWithProviders(ui: React.ReactElement) {
  return render(<LocaleProvider><CurrencyProvider>{ui}</CurrencyProvider></LocaleProvider>);
}

function tradeOp(overrides: Partial<Op>): Op {
  return {
    id: 'entry', date: '2024-01-01', coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin',
    type: 'Buy', qty: 1, price: 100, fee: 0, total: 100,
    platformId: 'binance', platformName: 'Binance', currency: 'BRL', kind: 'trade', side: 'long',
    ...overrides,
  };
}

const partialCycle: Cycle = {
  cycleLabel: 'BTC-1',
  entries: [tradeOp({ id: 'entry', qty: 2 })],
  exits: [tradeOp({ id: 'exit1', type: 'Sell', qty: 1, price: 150 })],
  qtyEntry: 2,
  qtyClosed: 1,
  qtyRemaining: 1,
  realizedPnl: 50,
  status: 'partial',
};

const closedCycle: Cycle = { ...partialCycle, qtyRemaining: 0, status: 'closed', realizedPnl: 100 };

beforeEach(() => {
  localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify({ BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 }));
});

describe('CyclePopover', () => {
  it('renders the tag with the cycle label, no popover by default', () => {
    renderWithProviders(<CyclePopover cycle={partialCycle} coinSymbol="BTC" />);
    expect(screen.getByText('BTC-1')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the popover on hover and shows entry, exit, remaining, and realized P/L for a partial cycle', () => {
    renderWithProviders(<CyclePopover cycle={partialCycle} coinSymbol="BTC" />);
    fireEvent.mouseEnter(document.querySelector('.cycle-wrap')!);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Parcial')).toBeInTheDocument();
    expect(screen.getByText('Entrada')).toBeInTheDocument();
    expect(screen.getByText('Saída')).toBeInTheDocument();
    expect(screen.getByText('Restante em aberto')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*50,00/)).toBeInTheDocument();
  });

  it('closes the popover on mouse leave', () => {
    renderWithProviders(<CyclePopover cycle={partialCycle} coinSymbol="BTC" />);
    const wrap = document.querySelector('.cycle-wrap')!;
    fireEvent.mouseEnter(wrap);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.mouseLeave(wrap);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows "Encerrado" and no remaining-open row for a closed cycle', () => {
    renderWithProviders(<CyclePopover cycle={closedCycle} coinSymbol="BTC" />);
    fireEvent.mouseEnter(document.querySelector('.cycle-wrap')!);
    expect(screen.getByText('Encerrado')).toBeInTheDocument();
    expect(screen.queryByText('Restante em aberto')).not.toBeInTheDocument();
  });

  it('toggles open/closed on click, for touch devices', () => {
    renderWithProviders(<CyclePopover cycle={partialCycle} coinSymbol="BTC" />);
    const wrap = document.querySelector('.cycle-wrap')!;
    fireEvent.click(wrap);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(wrap);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on keyboard focus and closes on blur', () => {
    renderWithProviders(<CyclePopover cycle={partialCycle} coinSymbol="BTC" />);
    fireEvent.focus(screen.getByRole('button'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.blur(screen.getByRole('button'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    renderWithProviders(<CyclePopover cycle={partialCycle} coinSymbol="BTC" />);
    fireEvent.mouseEnter(document.querySelector('.cycle-wrap')!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('has an accessible label naming the cycle', () => {
    renderWithProviders(<CyclePopover cycle={partialCycle} coinSymbol="BTC" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Ver ciclo BTC-1');
  });
});

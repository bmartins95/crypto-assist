import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HistorySkeleton from './HistorySkeleton';
import { LocaleProvider } from '@/context/LocaleContext';
import { CurrencyProvider } from '@/context/CurrencyContext';

function renderSkeleton() {
  return render(<LocaleProvider><CurrencyProvider><HistorySkeleton /></CurrencyProvider></LocaleProvider>);
}

describe('HistorySkeleton', () => {
  it('renders the same 7 header columns as the real HistoryTab table', () => {
    // Reproduces a real bug: this skeleton was left over from before the
    // day-grouping/wallet-vs-trade refactor (items 26/28) — it still showed the
    // old 9-column layout (date, asset, type, qty, price, total, fee, platform)
    // with no pnl/status columns, while the real table has asset/type/qty/
    // total/pnl/status/actions with date-group header rows instead of a date
    // column. Loading and loaded states looked like two different tables.
    renderSkeleton();
    const headers = document.querySelectorAll('thead th');
    expect(headers).toHaveLength(7);
    expect(screen.getByText('Moeda')).toBeInTheDocument();
    expect(screen.getByText('Tipo')).toBeInTheDocument();
    expect(screen.getByText('Qtd.')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Lucro/Prejuízo')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders date-group header rows, matching HistoryTab grouping ops by date', () => {
    renderSkeleton();
    expect(document.querySelectorAll('.history-group-header').length).toBeGreaterThan(0);
  });

  it('shows both header actions (move wallet and new trade), matching HistoryTab', () => {
    renderSkeleton();
    expect(screen.getByText('Movimentar carteira')).toBeInTheDocument();
    expect(screen.getByText('Novo trade')).toBeInTheDocument();
  });
});

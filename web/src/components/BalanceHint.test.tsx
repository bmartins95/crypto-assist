import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BalanceHint from './BalanceHint';
import { LocaleProvider } from '@/context/LocaleContext';

function renderHint(ui: React.ReactElement) {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

describe('BalanceHint', () => {
  it('renders the available quantity and symbol', () => {
    renderHint(<BalanceHint qty={2} symbol="ETH" onMax={vi.fn()} />);
    expect(screen.getByText('Disponível: 2,00 ETH')).toBeInTheDocument();
  });

  it('has no error styling when not over balance', () => {
    renderHint(<BalanceHint qty={2} symbol="ETH" onMax={vi.fn()} />);
    expect(document.querySelector('.bal-row.err')).not.toBeInTheDocument();
  });

  it('applies error styling when over balance, without changing the message', () => {
    renderHint(<BalanceHint qty={2} symbol="ETH" over onMax={vi.fn()} />);
    expect(document.querySelector('.bal-row.err')).toBeInTheDocument();
    expect(screen.getByText('Disponível: 2,00 ETH')).toBeInTheDocument();
  });

  it('calls onMax when the Max button is clicked', () => {
    const onMax = vi.fn();
    renderHint(<BalanceHint qty={2} symbol="ETH" onMax={onMax} />);
    fireEvent.click(screen.getByRole('button', { name: 'Máx' }));
    expect(onMax).toHaveBeenCalledTimes(1);
  });

  it('uses a custom label template instead of the default balance copy', () => {
    renderHint(<BalanceHint qty={2} symbol="ETH" onMax={vi.fn()} label="Restante para fechar: {qty} {symbol}" />);
    expect(screen.getByText('Restante para fechar: 2,00 ETH')).toBeInTheDocument();
    expect(screen.queryByText(/Disponível/)).not.toBeInTheDocument();
  });
});

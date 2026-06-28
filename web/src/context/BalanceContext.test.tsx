import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BalanceProvider, useBalance } from './BalanceContext';

function BalanceConsumer() {
  const { hidden, toggleHidden } = useBalance();
  return (
    <div>
      <span data-testid="hidden">{String(hidden)}</span>
      <button onClick={toggleHidden}>toggle</button>
    </div>
  );
}

describe('BalanceContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to false when localStorage is empty', () => {
    render(<BalanceProvider><BalanceConsumer /></BalanceProvider>);
    expect(screen.getByTestId('hidden').textContent).toBe('false');
  });

  it('toggleHidden flips the value to true', () => {
    render(<BalanceProvider><BalanceConsumer /></BalanceProvider>);
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('hidden').textContent).toBe('true');
  });

  it('toggleHidden persists value to localStorage', () => {
    render(<BalanceProvider><BalanceConsumer /></BalanceProvider>);
    fireEvent.click(screen.getByText('toggle'));
    expect(localStorage.getItem('crypto-assist:balance-hidden')).toBe('true');
  });

  it('loads stored "true" string as hidden=true on mount', () => {
    localStorage.setItem('crypto-assist:balance-hidden', 'true');
    render(<BalanceProvider><BalanceConsumer /></BalanceProvider>);
    expect(screen.getByTestId('hidden').textContent).toBe('true');
  });

  it('toggling twice returns to false', () => {
    render(<BalanceProvider><BalanceConsumer /></BalanceProvider>);
    fireEvent.click(screen.getByText('toggle'));
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('hidden').textContent).toBe('false');
    expect(localStorage.getItem('crypto-assist:balance-hidden')).toBe('false');
  });

  it('throws when useBalance is called outside BalanceProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<BalanceConsumer />)).toThrow('useBalance must be used within BalanceProvider');
    spy.mockRestore();
  });
});

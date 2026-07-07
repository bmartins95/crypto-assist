import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PriceRefreshProvider, usePriceRefresh } from './PriceRefreshContext';

function PriceRefreshConsumer() {
  const { interval, setInterval } = usePriceRefresh();
  return (
    <div>
      <span data-testid="interval">{String(interval)}</span>
      <button onClick={() => setInterval(30000)}>set-30s</button>
      <button onClick={() => setInterval(null)}>set-manual</button>
    </div>
  );
}

describe('PriceRefreshContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to null (Manual) when localStorage is empty', () => {
    render(<PriceRefreshProvider><PriceRefreshConsumer /></PriceRefreshProvider>);
    expect(screen.getByTestId('interval').textContent).toBe('null');
  });

  it('setInterval updates state and persists to localStorage', () => {
    render(<PriceRefreshProvider><PriceRefreshConsumer /></PriceRefreshProvider>);
    fireEvent.click(screen.getByText('set-30s'));
    expect(screen.getByTestId('interval').textContent).toBe('30000');
    expect(localStorage.getItem('price_refresh_interval')).toBe('30000');
  });

  it('setInterval(null) clears the stored value', () => {
    render(<PriceRefreshProvider><PriceRefreshConsumer /></PriceRefreshProvider>);
    fireEvent.click(screen.getByText('set-30s'));
    fireEvent.click(screen.getByText('set-manual'));
    expect(screen.getByTestId('interval').textContent).toBe('null');
    expect(localStorage.getItem('price_refresh_interval')).toBeNull();
  });

  it('loads a stored valid interval on mount', () => {
    localStorage.setItem('price_refresh_interval', '60000');
    render(<PriceRefreshProvider><PriceRefreshConsumer /></PriceRefreshProvider>);
    expect(screen.getByTestId('interval').textContent).toBe('60000');
  });

  it('falls back to null when the stored value is corrupt or invalid', () => {
    localStorage.setItem('price_refresh_interval', 'not-a-number');
    render(<PriceRefreshProvider><PriceRefreshConsumer /></PriceRefreshProvider>);
    expect(screen.getByTestId('interval').textContent).toBe('null');
  });

  it('falls back to null when the stored value is not one of the four allowed intervals', () => {
    localStorage.setItem('price_refresh_interval', '1000');
    render(<PriceRefreshProvider><PriceRefreshConsumer /></PriceRefreshProvider>);
    expect(screen.getByTestId('interval').textContent).toBe('null');
  });

  it('throws when usePriceRefresh is called outside PriceRefreshProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<PriceRefreshConsumer />)).toThrow('usePriceRefresh must be used within PriceRefreshProvider');
    spy.mockRestore();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/context/LocaleContext';
import { CurrencyProvider, useCurrency } from '@/context/CurrencyContext';

const RATES = { BRL: 5, USD: 1, EUR: 0.9, GBP: 0.8, JPY: 150 };

vi.mock('@/lib/api/client', () => ({
  api: { getExchangeRates: vi.fn() },
}));

function Probe() {
  const { currency, setCurrency, rates, ratesStatus, fmtMoney, fmtFromCurrency } = useCurrency();
  return (
    <div>
      <span data-testid="currency">{currency}</span>
      <span data-testid="status">{ratesStatus}</span>
      <span data-testid="brl-rate">{rates ? rates.BRL : 'none'}</span>
      <span data-testid="money">{fmtMoney(10)}</span>
      <span data-testid="from-brl">{fmtFromCurrency(50, 'BRL')}</span>
      <button onClick={() => setCurrency('USD')}>to-usd</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <LocaleProvider>
      <CurrencyProvider><Probe /></CurrencyProvider>
    </LocaleProvider>
  );
}

describe('CurrencyContext', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.clearAllMocks();
    const { api } = await import('@/lib/api/client');
    vi.mocked(api.getExchangeRates).mockResolvedValue({ rates: RATES, updatedAt: '2026-01-01T00:00:00Z' });
  });

  it('defaults to BRL and becomes fresh after a successful fetch', async () => {
    renderProbe();
    expect(screen.getByTestId('currency').textContent).toBe('BRL');
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('fresh'));
    expect(screen.getByTestId('brl-rate').textContent).toBe('5');
    expect(localStorage.getItem('crypto-assist:exchange-rates')).toBe(JSON.stringify(RATES));
  });

  it('converts USD values into the display currency via fmtMoney', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('fresh'));
    expect(screen.getByTestId('money').textContent).toContain('50');
    expect(screen.getByTestId('money').textContent).toContain('R$');
  });

  it('converts from an op currency through USD via fmtFromCurrency', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('fresh'));
    // 50 BRL -> 10 USD -> 50 BRL displayed.
    expect(screen.getByTestId('from-brl').textContent).toContain('50');
  });

  it('persists the selected currency', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('fresh'));
    fireEvent.click(screen.getByText('to-usd'));
    expect(screen.getByTestId('currency').textContent).toBe('USD');
    expect(localStorage.getItem('crypto-assist:currency')).toBe('USD');
    expect(screen.getByTestId('money').textContent).toContain('10');
  });

  it('falls back to persisted rates with stale status when the fetch fails', async () => {
    localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify(RATES));
    const { api } = await import('@/lib/api/client');
    vi.mocked(api.getExchangeRates).mockRejectedValue(new Error('down'));
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('stale'));
    expect(screen.getByTestId('brl-rate').textContent).toBe('5');
  });

  it('reports unavailable and renders a dash when there are no rates at all', async () => {
    const { api } = await import('@/lib/api/client');
    vi.mocked(api.getExchangeRates).mockRejectedValue(new Error('down'));
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unavailable'));
    expect(screen.getByTestId('money').textContent).toBe('—');
    expect(screen.getByTestId('from-brl').textContent).toBe('—');
  });

  it('ignores a corrupt persisted rates entry', async () => {
    localStorage.setItem('crypto-assist:exchange-rates', 'not-json');
    const { api } = await import('@/lib/api/client');
    vi.mocked(api.getExchangeRates).mockRejectedValue(new Error('down'));
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unavailable'));
  });
});

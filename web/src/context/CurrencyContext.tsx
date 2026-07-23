import { createContext, useContext, useEffect, useState } from 'react';
import type { Currency, ExchangeRates } from '@crypto-assist/shared';
import { fmt, fmtCompact } from '@crypto-assist/shared';
import { api } from '@/lib/api/client';
import { useLocale } from '@/context/LocaleContext';

const CURRENCY_KEY = 'crypto-assist:currency';
const RATES_KEY = 'crypto-assist:exchange-rates';
const DEFAULT_CURRENCY: Currency = 'BRL';

export const CURRENCIES: Currency[] = ['BRL', 'USD', 'EUR', 'GBP', 'JPY'];

export type RatesStatus = 'fresh' | 'stale' | 'unavailable';

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rates: ExchangeRates | null;
  ratesStatus: RatesStatus;
  fmtMoney: (usdValue: number) => string;
  fmtMoneyCompact: (usdValue: number) => string;
  fmtFromCurrency: (value: number, from: Currency) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function readStoredRates(): ExchangeRates | null {
  const raw = localStorage.getItem(RATES_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && CURRENCIES.every(c => typeof (parsed as Record<string, unknown>)[c] === 'number')) {
      // Every currency key was just verified to be a number.
      return parsed as ExchangeRates;
    }
    return null;
  } catch {
    // A corrupt cache entry is equivalent to no cache; the fetch below replaces it.
    return null;
  }
}

export function CurrencyProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const { locale } = useLocale();
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const stored = localStorage.getItem(CURRENCY_KEY);
    return stored && (CURRENCIES as string[]).includes(stored) ? (stored as Currency) : DEFAULT_CURRENCY;
  });
  const [rates, setRates] = useState<ExchangeRates | null>(() => readStoredRates());
  const [ratesStatus, setRatesStatus] = useState<RatesStatus>(() => (readStoredRates() ? 'stale' : 'unavailable'));

  useEffect(() => {
    let cancelled = false;
    api.getExchangeRates()
      .then(payload => {
        if (cancelled) return;
        localStorage.setItem(RATES_KEY, JSON.stringify(payload.rates));
        setRates(payload.rates);
        setRatesStatus('fresh');
      })
      .catch(() => {
        // Persisted last-good rates keep the app rendering; status drives the visible warning.
        if (!cancelled) setRatesStatus(readStoredRates() ? 'stale' : 'unavailable');
      });
    return () => { cancelled = true; };
  }, []);

  function setCurrency(c: Currency): void {
    localStorage.setItem(CURRENCY_KEY, c);
    setCurrencyState(c);
  }

  function fmtMoney(usdValue: number): string {
    if (!rates) return '—';
    return fmt(usdValue * rates[currency], locale, currency);
  }

  function fmtMoneyCompact(usdValue: number): string {
    if (!rates) return '—';
    return fmtCompact(usdValue * rates[currency], locale, currency);
  }

  function fmtFromCurrency(value: number, from: Currency): string {
    if (!rates || !(rates[from] > 0)) return '—';
    return fmtMoney(value / rates[from]);
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, ratesStatus, fmtMoney, fmtMoneyCompact, fmtFromCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}

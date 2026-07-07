import { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { Currency, ExchangeRates } from '@crypto-assist/shared';
import { fmt } from '@crypto-assist/shared';
import { api } from '@/lib/api/client';
import { useLocale } from '@/context/LocaleContext';
import { useAuth } from '@/lib/auth';

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
  fmtFromCurrency: (value: number, from: Currency) => string;
  toDisplay: (usdValue: number) => number;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function parseRates(raw: string | null): ExchangeRates | null {
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
  const { session } = useAuth();
  const [currency, setCurrencyState] = useState<Currency>(DEFAULT_CURRENCY);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [ratesStatus, setRatesStatus] = useState<RatesStatus>('unavailable');

  useEffect(() => {
    SecureStore.getItemAsync(CURRENCY_KEY).then(stored => {
      if (stored && (CURRENCIES as string[]).includes(stored)) {
        // Membership in CURRENCIES was just checked.
        setCurrencyState(stored as Currency);
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const persisted = parseRates(await SecureStore.getItemAsync(RATES_KEY));
      if (cancelled) return;
      if (persisted) {
        setRates(persisted);
        setRatesStatus('stale');
      }
      if (!session) return;
      try {
        const payload = await api.getExchangeRates();
        if (cancelled) return;
        SecureStore.setItemAsync(RATES_KEY, JSON.stringify(payload.rates));
        setRates(payload.rates);
        setRatesStatus('fresh');
      } catch {
        // Persisted last-good rates keep screens rendering; status drives the warning.
        if (!cancelled) setRatesStatus(persisted ? 'stale' : 'unavailable');
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  function setCurrency(c: Currency): void {
    SecureStore.setItemAsync(CURRENCY_KEY, c);
    setCurrencyState(c);
  }

  function toDisplay(usdValue: number): number {
    return usdValue * (rates ? rates[currency] : 0);
  }

  function fmtMoney(usdValue: number): string {
    if (!rates) return '—';
    return fmt(toDisplay(usdValue), locale, currency);
  }

  function fmtFromCurrency(value: number, from: Currency): string {
    if (!rates || !(rates[from] > 0)) return '—';
    return fmtMoney(value / rates[from]);
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, ratesStatus, fmtMoney, fmtFromCurrency, toDisplay }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}

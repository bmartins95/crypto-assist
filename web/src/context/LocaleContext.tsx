import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Locale, UIText } from '@crypto-assist/shared';
import { getLocale, LOCALES } from '@crypto-assist/shared';

const RTL_LOCALES = new Set<Locale>(['ar-SA']);
const STORAGE_KEY = 'crypto-assist:locale';
const DEFAULT_LOCALE: Locale = 'pt-BR';

interface LocaleContextValue {
  locale: Locale;
  t: UIText;
  setLocale: (l: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && stored in LOCALES ? (stored as Locale) : DEFAULT_LOCALE;
  });

  const t = useMemo(() => getLocale(locale), [locale]);

  useEffect(() => {
    document.documentElement.dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [locale]);

  function setLocale(l: Locale) {
    localStorage.setItem(STORAGE_KEY, l);
    setLocaleState(l);
  }

  return (
    <LocaleContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Locale, UIText } from '@crypto-assist/shared';
import { getLocale, LOCALES } from '@crypto-assist/shared';

const RTL_LOCALES = new Set<Locale>(['ar-SA']);
const STORAGE_KEY = 'crypto-assist:locale';
const DEFAULT_LOCALE: Locale = 'pt-BR';

// Falls back to the language-only subtag (e.g. 'en' from 'en-GB') when the browser's
// exact region tag isn't one of the 10 we ship — every supported language maps to the
// one locale variant we actually have, so a British or Australian visitor still gets
// English instead of dropping straight to the pt-BR default.
const LANGUAGE_ONLY_FALLBACK: Record<string, Locale> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ar: 'ar-SA',
  hi: 'hi-IN',
  ru: 'ru-RU',
};

function detectBrowserLocale(): Locale | null {
  if (typeof navigator === 'undefined') return null;
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const raw of candidates) {
    const exact = (Object.keys(LOCALES) as Locale[]).find(l => l.toLowerCase() === raw?.toLowerCase());
    if (exact) return exact;
  }
  for (const raw of candidates) {
    const fallback = LANGUAGE_ONLY_FALLBACK[raw?.split('-')[0].toLowerCase() ?? ''];
    if (fallback) return fallback;
  }
  return null;
}

interface LocaleContextValue {
  locale: Locale;
  t: UIText;
  setLocale: (l: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in LOCALES) return stored as Locale;
    return detectBrowserLocale() ?? DEFAULT_LOCALE;
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

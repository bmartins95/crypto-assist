import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { Locale, UIText } from '@crypto-assist/shared';
import { getLocale } from '@crypto-assist/shared';

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
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then(stored => {
      if (stored) setLocaleState(stored as Locale);
    });
  }, []);

  const t = useMemo(() => getLocale(locale), [locale]);

  function setLocale(l: Locale) {
    SecureStore.setItemAsync(STORAGE_KEY, l);
    const wasRTL = RTL_LOCALES.has(locale);
    const willBeRTL = RTL_LOCALES.has(l);
    setLocaleState(l);
    if (wasRTL !== willBeRTL) {
      I18nManager.forceRTL(willBeRTL);
      Alert.alert(t.settings_title, 'Reinicie o aplicativo para aplicar o novo layout.');
    }
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

/**
 * Contracts for LocaleContext (web and mobile)
 *
 * Both platforms expose the same context shape.
 * Web uses React.createContext; mobile uses the same pattern with AsyncStorage.
 */

import type { Locale, UIText } from './shared-i18n';

export interface LocaleContextValue {
  /** Active locale code (persisted to localStorage / AsyncStorage) */
  locale: Locale;
  /** Active translations object — components read `t.someKey` */
  t: UIText;
  /** Switch locale; persists to storage and triggers RTL flip when needed */
  setLocale: (l: Locale) => void;
}

/**
 * Storage contract
 *
 * Key used on both platforms: `crypto-assist:locale`
 * Value: a valid Locale string, or absent (use default 'pt-BR')
 */
export const LOCALE_STORAGE_KEY = 'crypto-assist:locale' as const;

/**
 * RTL locales: setting one of these triggers dir/I18nManager flip
 */
export const RTL_LOCALES: ReadonlySet<Locale> = new Set<Locale>(['ar-SA']);

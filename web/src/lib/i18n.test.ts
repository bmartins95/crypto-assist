import { describe, it, expect } from 'vitest';
import { LOCALES, getLocale } from '@crypto-assist/shared';
import type { Locale, UIText } from '@crypto-assist/shared';

const EXPECTED_LOCALES: Locale[] = [
  'pt-BR', 'en-US', 'es-ES', 'fr-FR', 'de-DE',
  'zh-CN', 'ja-JP', 'ar-SA', 'hi-IN', 'ru-RU',
];

describe('LOCALES record', () => {
  it('contains all 10 supported locales', () => {
    expect(Object.keys(LOCALES).sort()).toEqual([...EXPECTED_LOCALES].sort());
  });

  it.each(EXPECTED_LOCALES)('%s satisfies UIText (has no undefined values)', (locale) => {
    const text: UIText = LOCALES[locale];
    for (const [key, value] of Object.entries(text)) {
      expect(value, `${locale}.${key}`).toBeDefined();
      expect(typeof value, `${locale}.${key}`).toBe('string');
    }
  });

  it('every locale has the same set of keys as pt-BR', () => {
    const referenceKeys = Object.keys(LOCALES['pt-BR']).sort();
    for (const locale of EXPECTED_LOCALES) {
      expect(Object.keys(LOCALES[locale]).sort(), `${locale} key mismatch`).toEqual(referenceKeys);
    }
  });
});

describe('getLocale', () => {
  it('returns the correct UIText for a known locale', () => {
    expect(getLocale('en-US').tabs_wallet).toBe('Wallet');
  });

  it('falls back to pt-BR for an unknown code', () => {
    const result = getLocale('xx-XX' as Locale);
    expect(result.tabs_wallet).toBe('Carteira');
  });
});

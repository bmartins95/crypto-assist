import type { Locale, UIText } from './types';
import ptBR from './locales/pt-BR';
import enUS from './locales/en-US';
import esES from './locales/es-ES';
import frFR from './locales/fr-FR';
import deDE from './locales/de-DE';
import zhCN from './locales/zh-CN';
import jaJP from './locales/ja-JP';
import arSA from './locales/ar-SA';
import hiIN from './locales/hi-IN';
import ruRU from './locales/ru-RU';

export type { Locale, UIText };

export const LOCALES: Record<Locale, UIText> = {
  'pt-BR': ptBR,
  'en-US': enUS,
  'es-ES': esES,
  'fr-FR': frFR,
  'de-DE': deDE,
  'zh-CN': zhCN,
  'ja-JP': jaJP,
  'ar-SA': arSA,
  'hi-IN': hiIN,
  'ru-RU': ruRU,
};

export function getLocale(code: Locale): UIText {
  return LOCALES[code] ?? LOCALES['pt-BR'];
}

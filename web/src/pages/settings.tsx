import type { Locale } from '@crypto-assist/shared';
import { LOCALES } from '@crypto-assist/shared';
import { useLocale } from '@/context/LocaleContext';

const LOCALE_LABELS: Record<Locale, string> = {
  'pt-BR': 'Português (Brasil)',
  'en-US': 'English (US)',
  'es-ES': 'Español',
  'fr-FR': 'Français',
  'de-DE': 'Deutsch',
  'zh-CN': '中文（简体）',
  'ja-JP': '日本語',
  'ar-SA': 'العربية',
  'hi-IN': 'हिंदी',
  'ru-RU': 'Русский',
};

export default function SettingsPage() {
  const { locale, t, setLocale } = useLocale();

  return (
    <div className="section active">
      <div style={{ maxWidth: 320 }}>
        <div className="field">
          <label htmlFor="language-select">{t.settings_language}</label>
          <select
            id="language-select"
            value={locale}
            onChange={e => setLocale(e.target.value as Locale)}
          >
            {(Object.keys(LOCALES) as Locale[]).map(code => (
              <option key={code} value={code}>
                {LOCALE_LABELS[code]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

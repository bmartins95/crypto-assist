import React from 'react';
import type { Locale, ThemeMode } from '@crypto-assist/shared';
import { LOCALES } from '@crypto-assist/shared';
import { useLocale } from '@/context/LocaleContext';
import { useTheme } from '@/context/ThemeContext';
import { useBalance } from '@/context/BalanceContext';
import { exportData, importData } from '@/lib/dataHandlers';
import { api } from '@/lib/api/client';
import { usePortfolio } from '@/components/AppLayout';

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

export default function SettingsPage(): React.ReactElement {
  const { locale, t, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const { hidden, toggleHidden } = useBalance();
  const { reload } = usePortfolio();
  const importRef = React.useRef<HTMLInputElement>(null);

  function handleExport(): void {
    exportData().catch(() => alert(t.dashboard_error_export));
  }

  function handleImportClick(): void {
    importRef.current?.click();
  }

  function handleImportChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    importData(file, reload)
      .then(() => { e.target.value = ''; alert(t.settings_clear_wallet_success); })
      .catch((err: unknown) => {
        const detail = err instanceof Error && err.message ? `\n${err.message}` : '';
        alert(t.dashboard_error_import + detail);
      });
  }

  function handleClearWallet(): void {
    if (!window.confirm(t.settings_clear_wallet_confirm)) return;
    api.clearOps()
      .then(async () => { await reload(); alert(t.settings_clear_wallet_success); })
      .catch(() => alert(t.common_error));
  }

  function themeLabel(m: ThemeMode): string {
    if (m === 'light') return t.settings_theme_light;
    if (m === 'dark') return t.settings_theme_dark;
    return t.settings_theme_system;
  }

  return (
    <div className="settings-page">

      <div className="settings-card">
        <div className="settings-card-head">
          <div className="settings-card-title">
            <i className="ti ti-sun settings-card-icon" aria-hidden="true" />
            {t.settings_section_appearance}
          </div>
          <p className="settings-card-desc">{t.settings_appearance_desc}</p>
        </div>
        <div className="settings-card-body">
          <div className="settings-row">
            <span className="settings-row-label">{t.settings_theme}</span>
            <div className="seg-ctrl" role="group" aria-label={t.settings_theme}>
              {(['light', 'dark', 'system'] as ThemeMode[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTheme(m)}
                  className={`seg-btn${theme === m ? ' active' : ''}`}
                  aria-pressed={theme === m}
                >
                  {themeLabel(m)}
                </button>
              ))}
            </div>
          </div>
          <div className="settings-row">
            <label htmlFor="language-select" className="settings-row-label">{t.settings_language}</label>
            <select
              id="language-select"
              className="settings-select"
              value={locale}
              onChange={e => setLocale(e.target.value as Locale)}
            >
              {(Object.keys(LOCALES) as Locale[]).map(code => (
                <option key={code} value={code}>{LOCALE_LABELS[code]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-head">
          <div className="settings-card-title">
            <i className="ti ti-currency-dollar settings-card-icon" aria-hidden="true" />
            {t.settings_section_currency}
          </div>
          <p className="settings-card-desc">{t.settings_currency_desc}</p>
        </div>
        <div className="settings-card-body">
          <div className="settings-row">
            <div>
              <div className="settings-row-label">{t.settings_currency_label}</div>
              <div className="settings-row-hint">{t.settings_currency_hint}</div>
            </div>
            <select disabled className="settings-select settings-select--disabled">
              <option>{t.settings_currency_value}</option>
            </select>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">{t.settings_refresh_label}</div>
              <div className="settings-row-hint">{t.settings_refresh_hint}</div>
            </div>
            <select disabled className="settings-select settings-select--disabled">
              <option>Manual</option>
            </select>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">{t.settings_hide_balances}</span>
            <button
              type="button"
              role="switch"
              aria-checked={hidden}
              onClick={toggleHidden}
              className={`toggle-track${hidden ? ' toggle-track--on' : ''}`}
              aria-label={t.settings_hide_balances}
            >
              <span className="toggle-thumb" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-head">
          <div className="settings-card-title">
            <i className="ti ti-message-circle settings-card-icon" aria-hidden="true" />
            {t.settings_section_data}
          </div>
          <p className="settings-card-desc">{t.settings_data_desc}</p>
        </div>
        <div className="settings-card-body">
          <div className="settings-row">
            <div>
              <div className="settings-row-label">{t.settings_export_label}</div>
              <div className="settings-row-hint">{t.settings_export_hint}</div>
            </div>
            <button type="button" className="settings-btn" onClick={handleExport}>
              <i className="ti ti-download" aria-hidden="true" /> {t.dashboard_export}
            </button>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">{t.settings_import_label}</div>
              <div className="settings-row-hint">{t.settings_import_hint}</div>
            </div>
            <button type="button" className="settings-btn" onClick={handleImportClick}>
              <i className="ti ti-upload" aria-hidden="true" /> {t.dashboard_import}
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json"
              onChange={handleImportChange}
              style={{ display: 'none' }}
              aria-label={t.dashboard_import}
            />
          </div>
        </div>
      </div>

      <div className="settings-card settings-card--danger">
        <div className="settings-card-head">
          <div className="settings-card-title settings-card-title--danger">
            <i className="ti ti-alert-triangle settings-card-icon--danger" aria-hidden="true" />
            {t.settings_section_danger}
          </div>
          <p className="settings-card-desc">{t.settings_danger_desc}</p>
        </div>
        <div className="settings-card-body">
          <div className="settings-row">
            <div>
              <div className="settings-row-label">{t.settings_clear_wallet}</div>
              <div className="settings-row-hint">{t.settings_clear_hint}</div>
            </div>
            <button type="button" className="settings-btn settings-btn--danger" onClick={handleClearWallet}>
              <i className="ti ti-trash" aria-hidden="true" /> {t.settings_clear_data}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

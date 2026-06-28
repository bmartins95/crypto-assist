import React from 'react';
import type { Locale } from '@crypto-assist/shared';
import { LOCALES } from '@crypto-assist/shared';
import { useLocale } from '@/context/LocaleContext';
import { useTheme } from '@/context/ThemeContext';
import { useBalance } from '@/context/BalanceContext';
import type { ThemeMode } from '@crypto-assist/shared';
import { exportData, importData } from '@/lib/dataHandlers';
import { api } from '@/lib/api/client';

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

const THEME_OPTIONS: ThemeMode[] = ['system', 'light', 'dark'];

const cardStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '0.5px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '1.25rem',
  marginBottom: '1rem',
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text2)',
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  marginBottom: '1rem',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: '0.5px solid var(--border)',
};

const lastRowStyle: React.CSSProperties = {
  ...rowStyle,
  borderBottom: 'none',
};

const rowLabelStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--text)',
};

const rowHintStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text3)',
  marginTop: 2,
};

export default function SettingsPage(): React.ReactElement {
  const { locale, t, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const { hidden, toggleHidden } = useBalance();

  function handleExport(): void {
    exportData().catch(() => alert(t.dashboard_error_export));
  }

  const importRef = React.useRef<HTMLInputElement>(null);
  function handleImportClick(): void { importRef.current?.click(); }
  function handleImportChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]; if (!file) return;
    importData(file).then(() => { e.target.value = ''; alert(t.settings_clear_wallet_success); }).catch(() => alert(t.dashboard_error_import));
  }

  function handleClearWallet(): void {
    if (!window.confirm(t.settings_clear_wallet_confirm)) return;
    api.clearOps().then(() => alert(t.settings_clear_wallet_success)).catch(() => alert(t.common_error));
  }

  const themeLabel = (m: ThemeMode): string => {
    if (m === 'light') return t.settings_theme_light;
    if (m === 'dark') return t.settings_theme_dark;
    return t.settings_theme_system;
  };

  return (
    <div style={{ maxWidth: 560 }}>

      <div style={cardStyle}>
        <div style={cardTitleStyle}>{t.settings_section_appearance}</div>

        <div style={rowStyle}>
          <label htmlFor="language-select" style={rowLabelStyle}>{t.settings_language}</label>
          <select
            id="language-select"
            value={locale}
            onChange={e => setLocale(e.target.value as Locale)}
            style={{ minWidth: 180 }}
          >
            {(Object.keys(LOCALES) as Locale[]).map(code => (
              <option key={code} value={code}>{LOCALE_LABELS[code]}</option>
            ))}
          </select>
        </div>

        <div style={lastRowStyle}>
          <label htmlFor="theme-select" style={rowLabelStyle}>{t.settings_theme}</label>
          <select
            id="theme-select"
            value={theme}
            onChange={e => setTheme(e.target.value as ThemeMode)}
            style={{ minWidth: 140 }}
          >
            {THEME_OPTIONS.map(m => (
              <option key={m} value={m}>{themeLabel(m)}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardTitleStyle}>{t.settings_section_currency}</div>

        <div style={rowStyle}>
          <div>
            <div style={rowLabelStyle}>Moeda</div>
            <div style={rowHintStyle}>{t.settings_currency_placeholder}</div>
          </div>
          <select disabled style={{ minWidth: 120, opacity: 0.5 }}>
            <option>BRL</option>
          </select>
        </div>

        <div style={rowStyle}>
          <div>
            <div style={rowLabelStyle}>Intervalo de atualização</div>
            <div style={rowHintStyle}>{t.settings_refresh_placeholder}</div>
          </div>
          <select disabled style={{ minWidth: 120, opacity: 0.5 }}>
            <option>Manual</option>
          </select>
        </div>

        <div style={lastRowStyle}>
          <label htmlFor="hide-balances-toggle" style={rowLabelStyle}>{t.settings_hide_balances}</label>
          <input
            id="hide-balances-toggle"
            type="checkbox"
            checked={hidden}
            onChange={toggleHidden}
            aria-label={t.settings_hide_balances}
          />
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardTitleStyle}>{t.settings_section_data}</div>

        <div style={rowStyle}>
          <div style={rowLabelStyle}>{t.dashboard_export}</div>
          <button type="button" onClick={handleExport}>
            <i className="ti ti-download" /> {t.dashboard_export}
          </button>
        </div>

        <div style={lastRowStyle}>
          <div style={rowLabelStyle}>{t.dashboard_import}</div>
          <button type="button" onClick={handleImportClick}>
            <i className="ti ti-upload" /> {t.dashboard_import}
          </button>
          <input ref={importRef} type="file" accept=".json" onChange={handleImportChange} style={{ display: 'none' }} aria-label={t.dashboard_import} />
        </div>
      </div>

      <div style={{ ...cardStyle, borderColor: 'var(--danger)', background: 'var(--danger-bg)' }}>
        <div style={{ ...cardTitleStyle, color: 'var(--danger)' }}>{t.settings_section_danger}</div>

        <div style={lastRowStyle}>
          <div>
            <div style={{ ...rowLabelStyle, color: 'var(--danger)' }}>{t.settings_clear_wallet}</div>
          </div>
          <button type="button" onClick={handleClearWallet} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
            <i className="ti ti-trash" /> {t.settings_clear_wallet}
          </button>
        </div>
      </div>

    </div>
  );
}

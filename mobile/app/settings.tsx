import { View, Text, Switch, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import type { Locale, Currency } from '@crypto-assist/shared';
import type { ThemeMode } from '@crypto-assist/shared';
import { LOCALES } from '@crypto-assist/shared';
import { useLocale } from '@/context/LocaleContext';
import { useTheme } from '@/context/ThemeContext';
import { useBalance } from '@/context/BalanceContext';
import { CURRENCIES, useCurrency } from '@/context/CurrencyContext';
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

const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

const CURRENCY_LABELS: Record<Currency, string> = {
  BRL: 'BRL (R$)',
  USD: 'USD ($)',
  EUR: 'EUR (€)',
  GBP: 'GBP (£)',
  JPY: 'JPY (¥)',
};

export default function SettingsScreen(): React.ReactElement {
  const { locale, t, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const { hidden, toggleHidden } = useBalance();
  const { currency, setCurrency, ratesStatus } = useCurrency();

  const themeLabel = (m: ThemeMode): string => {
    if (m === 'light') return t.settings_theme_light;
    if (m === 'dark') return t.settings_theme_dark;
    return t.settings_theme_system;
  };

  async function handleExport(): Promise<void> {
    try {
      const backup = await api.exportBackup();
      const path = FileSystem.cacheDirectory + 'carteira-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      await FileSystem.writeAsStringAsync(path, JSON.stringify(backup, null, 2));
      await Sharing.shareAsync(path, { mimeType: 'application/json' });
    } catch {
      Alert.alert(t.common_error, t.dashboard_error_export);
    }
  }

  async function handleImport(): Promise<void> {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (result.canceled) return;
      const asset = result.assets[0];
      const text = await FileSystem.readAsStringAsync(asset.uri);
      const backup = JSON.parse(text) as Record<string, unknown>;
      if (!Array.isArray(backup.ops)) throw new Error('invalid-format');
      await api.importBackup(backup as Parameters<typeof api.importBackup>[0]);
      Alert.alert(t.settings_clear_wallet_success);
    } catch {
      Alert.alert(t.common_error, t.dashboard_error_import);
    }
  }

  function handleClearWallet(): void {
    Alert.alert(
      t.settings_clear_wallet,
      t.settings_clear_wallet_confirm,
      [
        { text: t.common_cancel, style: 'cancel' },
        {
          text: t.settings_clear_wallet,
          style: 'destructive',
          onPress: () => {
            api.clearOps()
              .then(() => Alert.alert(t.settings_clear_wallet_success))
              .catch(() => Alert.alert(t.common_error));
          },
        },
      ],
    );
  }

  return (
    <ScrollView style={styles.container}>

      <Text style={styles.sectionHeader}>{t.settings_preferences}</Text>
      <View style={styles.group}>
        <Text style={styles.groupSubheader}>{t.settings_language}</Text>
        {(Object.keys(LOCALES) as Locale[]).map((code, idx, arr) => (
          <TouchableOpacity
            key={code}
            style={[styles.row, idx === arr.length - 1 && styles.rowLast]}
            onPress={() => setLocale(code)}
            accessibilityLabel={LOCALE_LABELS[code]}
            accessibilityRole="radio"
            accessibilityState={{ checked: locale === code }}
          >
            <Text style={styles.rowLabel}>{LOCALE_LABELS[code]}</Text>
            {locale === code && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}
        <Text style={styles.groupSubheader}>{t.settings_currency_label}</Text>
        {ratesStatus !== 'fresh' && (
          <Text style={[styles.rowHint, styles.currencyStatusHint]}>
            {ratesStatus === 'unavailable' ? t.currency_rates_unavailable : t.currency_rates_stale}
          </Text>
        )}
        {CURRENCIES.map((c, idx, arr) => (
          <TouchableOpacity
            key={c}
            style={[styles.row, idx === arr.length - 1 && styles.rowNoBottomBorder]}
            onPress={() => setCurrency(c)}
            accessibilityLabel={CURRENCY_LABELS[c]}
            accessibilityRole="radio"
            accessibilityState={{ checked: currency === c }}
          >
            <Text style={styles.rowLabel}>{CURRENCY_LABELS[c]}</Text>
            {currency === c && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}
        <View style={[styles.row, styles.rowLast, styles.rowDisabled]}>
          <Text style={styles.rowLabel}>Intervalo de atualização</Text>
          <Text style={styles.rowHint}>{t.settings_refresh_placeholder}</Text>
        </View>
      </View>

      <Text style={styles.sectionHeader}>{t.settings_appearance_privacy}</Text>
      <View style={styles.group}>
        <Text style={styles.groupSubheader}>{t.settings_theme}</Text>
        {THEME_MODES.map((m, idx, arr) => (
          <TouchableOpacity
            key={m}
            style={[styles.row, idx === arr.length - 1 && styles.rowNoBottomBorder]}
            onPress={() => setTheme(m)}
            accessibilityLabel={themeLabel(m)}
            accessibilityRole="radio"
            accessibilityState={{ checked: theme === m }}
          >
            <Text style={styles.rowLabel}>{themeLabel(m)}</Text>
            {theme === m && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}
        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.rowLabel}>{t.settings_hide_balances}</Text>
          <Switch
            value={hidden}
            onValueChange={toggleHidden}
            accessibilityLabel={t.settings_hide_balances}
          />
        </View>
      </View>

      <Text style={styles.sectionHeader}>{t.settings_data_account}</Text>
      <View style={styles.group}>
        <TouchableOpacity
          style={styles.row}
          onPress={handleExport}
          accessibilityLabel={t.dashboard_export}
        >
          <Text style={styles.rowLabel}>{t.dashboard_export}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.row}
          onPress={handleImport}
          accessibilityLabel={t.dashboard_import}
        >
          <Text style={styles.rowLabel}>{t.dashboard_import}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.row, styles.rowLast]}
          onPress={handleClearWallet}
          accessibilityLabel={t.settings_clear_wallet}
        >
          <Text style={[styles.rowLabel, styles.rowDanger]}>{t.settings_clear_wallet}</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  sectionHeader: {
    fontSize: 13,
    color: '#6b7280',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  group: {
    backgroundColor: '#fff',
    marginHorizontal: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#d1d5db',
  },
  groupSubheader: {
    fontSize: 12,
    color: '#9ca3af',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowNoBottomBorder: {
    borderBottomWidth: 0,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowDisabledText: {
    color: '#9ca3af',
  },
  rowLabel: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  rowHint: {
    fontSize: 13,
    color: '#9ca3af',
  },
  currencyStatusHint: {
    color: '#dc2626',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  rowDanger: {
    color: '#dc2626',
  },
  checkmark: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '600',
  },
});

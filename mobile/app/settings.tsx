import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
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

export default function SettingsScreen() {
  const { locale, t, setLocale } = useLocale();
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>{t.settings_language}</Text>
      {(Object.keys(LOCALES) as Locale[]).map(code => (
        <TouchableOpacity
          key={code}
          style={[styles.row, locale === code && styles.rowSelected]}
          onPress={() => setLocale(code)}
          accessibilityLabel={LOCALE_LABELS[code]}
          accessibilityRole="radio"
          accessibilityState={{ checked: locale === code }}
        >
          <Text style={[styles.label, locale === code && styles.labelSelected]}>{LOCALE_LABELS[code]}</Text>
          {locale === code && <Text style={styles.check}>✓</Text>}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  sectionTitle: { fontSize: 13, color: '#64748b', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0' },
  rowSelected: { backgroundColor: '#eff6ff' },
  label: { fontSize: 16, color: '#1a1a2e' },
  labelSelected: { color: '#2563eb', fontWeight: '600' },
  check: { fontSize: 16, color: '#2563eb' },
});

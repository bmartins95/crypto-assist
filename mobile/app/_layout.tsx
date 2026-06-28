import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth, AuthProvider } from '@/lib/auth';
import { LocaleProvider } from '@/context/LocaleContext';
import { useLocale } from '@/context/LocaleContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { BalanceProvider } from '@/context/BalanceContext';

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const { t } = useLocale();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    const inTabs = segments[0] === '(tabs)';
    if (!session && !inAuth) {
      router.replace('/(auth)/login');
    } else if (session && !inTabs) {
      router.replace('/(tabs)/wallet');
    }
  }, [session, loading, segments]);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="settings" options={{ headerShown: true, title: t.settings_title, presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LocaleProvider>
          <BalanceProvider>
            <RootLayoutNav />
          </BalanceProvider>
        </LocaleProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

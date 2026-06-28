import { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { ThemeMode } from '@crypto-assist/shared';

const STORAGE_KEY = 'crypto-assist:theme';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const colorScheme = useColorScheme();

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then(stored => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeState(stored);
      }
    });
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && colorScheme === 'dark');

  function setTheme(mode: ThemeMode): void {
    SecureStore.setItemAsync(STORAGE_KEY, mode);
    setThemeState(mode);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

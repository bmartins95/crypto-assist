import { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'crypto-assist:balance-hidden';

interface BalanceContextValue {
  hidden: boolean;
  toggleHidden: () => void;
}

const BalanceContext = createContext<BalanceContextValue | null>(null);

export function BalanceProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [hidden, setHidden] = useState<boolean>(false);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then(stored => {
      if (stored === 'true') setHidden(true);
    });
  }, []);

  function toggleHidden(): void {
    const next = !hidden;
    SecureStore.setItemAsync(STORAGE_KEY, String(next));
    setHidden(next);
  }

  return (
    <BalanceContext.Provider value={{ hidden, toggleHidden }}>
      {children}
    </BalanceContext.Provider>
  );
}

export function useBalance(): BalanceContextValue {
  const ctx = useContext(BalanceContext);
  if (!ctx) throw new Error('useBalance must be used within BalanceProvider');
  return ctx;
}

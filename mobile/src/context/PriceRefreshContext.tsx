import { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'price_refresh_interval';
const VALID_INTERVALS = [30000, 60000, 300000];

interface PriceRefreshContextValue {
  interval: number | null;
  setInterval: (value: number | null) => void;
}

const PriceRefreshContext = createContext<PriceRefreshContextValue | null>(null);

export function PriceRefreshProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [interval, setIntervalState] = useState<number | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then(stored => {
      const parsed = stored === null ? null : Number(stored);
      if (parsed !== null && VALID_INTERVALS.includes(parsed)) setIntervalState(parsed);
    });
  }, []);

  function setInterval(value: number | null): void {
    if (value === null) SecureStore.deleteItemAsync(STORAGE_KEY);
    else SecureStore.setItemAsync(STORAGE_KEY, String(value));
    setIntervalState(value);
  }

  return (
    <PriceRefreshContext.Provider value={{ interval, setInterval }}>
      {children}
    </PriceRefreshContext.Provider>
  );
}

export function usePriceRefresh(): PriceRefreshContextValue {
  const ctx = useContext(PriceRefreshContext);
  if (!ctx) throw new Error('usePriceRefresh must be used within PriceRefreshProvider');
  return ctx;
}

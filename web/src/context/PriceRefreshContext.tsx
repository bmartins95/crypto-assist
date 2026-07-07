import { createContext, useContext, useState } from 'react';

const STORAGE_KEY = 'price_refresh_interval';
const VALID_INTERVALS = [30000, 60000, 300000];

interface PriceRefreshContextValue {
  interval: number | null;
  setInterval: (value: number | null) => void;
}

const PriceRefreshContext = createContext<PriceRefreshContextValue | null>(null);

function readStoredInterval(): number | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  const parsed = stored === null ? null : Number(stored);
  return parsed !== null && VALID_INTERVALS.includes(parsed) ? parsed : null;
}

export function PriceRefreshProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [interval, setIntervalState] = useState<number | null>(() => readStoredInterval());

  function setInterval(value: number | null): void {
    if (value === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(value));
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

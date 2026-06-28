import { createContext, useContext, useState } from 'react';

const STORAGE_KEY = 'crypto-assist:balance-hidden';

interface BalanceContextValue {
  hidden: boolean;
  toggleHidden: () => void;
}

const BalanceContext = createContext<BalanceContextValue | null>(null);

export function BalanceProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [hidden, setHidden] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  function toggleHidden(): void {
    const next = !hidden;
    localStorage.setItem(STORAGE_KEY, String(next));
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

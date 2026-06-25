import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { CognitoTokens } from './cognito';
import { clearSession, getSession } from './cognito';

interface AuthContextValue {
  session: CognitoTokens | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  signOut: async () => {},
  refreshSession: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<CognitoTokens | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const s = await getSession();
    setSession(s);
  }, []);

  useEffect(() => {
    getSession().then(s => {
      setSession(s);
      setLoading(false);
    });
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

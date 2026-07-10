import { useEffect, useState, type ReactNode } from 'react';
import AuthShell from './AuthShell';
import AuthCard from './AuthCard';
import LoadingState from './LoadingState';
import { useLocale } from '@/context/LocaleContext';

const TIMEOUT_MS = 28000;

interface AppBootstrapGateProps {
  run: () => Promise<void>;
  children: ReactNode;
}

export default function AppBootstrapGate({ run, children }: AppBootstrapGateProps) {
  const { t } = useLocale();
  const [status, setStatus] = useState<'pending' | 'ready' | 'error'>('pending');
  const [attemptCount, setAttemptCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('pending');
    const timeoutId = setTimeout(() => {
      if (!cancelled) setStatus('error');
    }, TIMEOUT_MS);

    run()
      .then(() => {
        if (!cancelled) {
          clearTimeout(timeoutId);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearTimeout(timeoutId);
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [attemptCount]);

  if (status === 'ready') return <>{children}</>;

  if (status === 'error') {
    return (
      <AuthShell>
        <AuthCard>
          <div className="auth-error-state">
            <h2>{t.auth_bootstrap_error_title}</h2>
            <p>{t.auth_bootstrap_error_message}</p>
            <button
              type="button"
              className="auth-btn auth-btn-primary"
              style={{ marginTop: 22, maxWidth: 220 }}
              onClick={() => setAttemptCount(c => c + 1)}
            >
              {t.auth_bootstrap_retry}
            </button>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard>
        <LoadingState
          title={t.auth_bootstrap_title}
          messages={[t.auth_bootstrap_msg1, t.auth_bootstrap_msg2, t.auth_bootstrap_msg3, t.auth_bootstrap_msg4]}
        />
      </AuthCard>
    </AuthShell>
  );
}

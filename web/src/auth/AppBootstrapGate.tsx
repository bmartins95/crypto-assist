import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import AuthShell from './AuthShell';
import AuthCard from './AuthCard';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import { signOut, type SignOutOutcome } from './useAuth';
import { useLocale } from '@/context/LocaleContext';

const TIMEOUT_MS = 28000;
// On a fast/warm backend this can resolve in well under a second, right after
// AuthCallback's own loading screen — a minimum visible time keeps that handoff
// from reading as a flicker (entrance animation cut off mid-fade).
const MIN_VISIBLE_MS = 400;

interface AppBootstrapGateProps {
  run: () => Promise<void>;
  children: ReactNode;
}

export default function AppBootstrapGate({ run, children }: AppBootstrapGateProps) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'pending' | 'ready' | 'error'>('pending');

  useEffect(() => {
    let cancelled = false;
    const mountedAt = Date.now();
    setStatus('pending');
    const timeoutId = setTimeout(() => {
      if (!cancelled) setStatus('error');
    }, TIMEOUT_MS);

    run()
      .then(() => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - mountedAt));
        setTimeout(() => {
          if (!cancelled) setStatus('ready');
        }, wait);
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
    // Deliberately excludes `run` — its identity changes whenever AppLayout's own
    // state changes (ops/prices/etc.), which must not re-trigger the initial-load
    // effect. Manual retries call `run()` directly instead (see handleRetry below).
  }, []);

  // Stays on the error card and shows an inline "retrying" state on the button rather
  // than bouncing back through the full-screen loading state — a manual retry is a
  // much shorter, more confident wait than the initial cold load.
  const handleRetry = useCallback(async () => {
    try {
      await run();
      setStatus('ready');
    } catch {
      // Stays in 'error' — ErrorState's own local state resets the button and the
      // icon reshakes on the next click.
    }
  }, [run]);

  // The escape hatch the timeout screen didn't have before: a user stuck here (bad
  // network, backend down) can leave instead of being trapped with only a retry
  // button. 'redirecting' means signOut() is already hard-navigating via Cognito's
  // hosted logout for a federated session — don't also navigate and race it.
  const handleExit = useCallback(async () => {
    let outcome: SignOutOutcome = 'done';
    try {
      outcome = await signOut();
    } catch {
      // Still want the user out of the stuck screen even if sign-out itself failed.
    }
    if (outcome !== 'redirecting') navigate({ to: '/' });
  }, [navigate]);

  if (status === 'ready') return <>{children}</>;

  if (status === 'error') {
    return (
      <AuthShell>
        <AuthCard>
          <ErrorState
            title={t.auth_bootstrap_error_title}
            message={t.auth_bootstrap_error_message}
            retryLabel={t.auth_bootstrap_retry}
            retryingLabel={t.auth_bootstrap_retrying}
            exitLabel={t.nav_logout}
            onRetry={handleRetry}
            onExit={handleExit}
          />
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

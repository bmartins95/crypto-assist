import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import AuthShell from './AuthShell';
import AuthCard from './AuthCard';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import { signOut, type SignOutOutcome } from './useAuth';
import { useLocale } from '@/context/LocaleContext';
import { BootstrapStatusContext, type BootstrapStatus } from './BootstrapStatusContext';

const TIMEOUT_MS = 28000;
// On a fast/warm backend this can resolve in well under a second, right after
// AuthCallback's own loading screen — a minimum visible time keeps that handoff
// from reading as a flicker (entrance animation cut off mid-fade).
const MIN_VISIBLE_MS = 400;
// Set once bootstrap succeeds in this tab. A page refresh (F5) reads this back
// synchronously and skips the full-screen loader entirely — only a fresh tab /
// first arrival after login should ever block on it (see isWarmBoot below).
export const WALLET_ENTERED_KEY = 'wallet:entered';

interface AppBootstrapGateProps {
  run: () => Promise<void>;
  children: ReactNode;
}

export default function AppBootstrapGate({ run, children }: AppBootstrapGateProps) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [status, setStatus] = useState<BootstrapStatus>('pending');
  // Read once at mount — a later write (this same load succeeding) must not
  // flip an already-rendering cold boot into warm-boot behavior mid-session.
  const isWarmBoot = useRef(sessionStorage.getItem(WALLET_ENTERED_KEY) === '1').current;

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
        sessionStorage.setItem(WALLET_ENTERED_KEY, '1');
        // The minimum-visible-time only exists to protect the full-screen loader's
        // entrance animation — irrelevant on warm boot, which never shows it.
        if (isWarmBoot) { setStatus('ready'); return; }
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

  // A genuine failure (rejection or the 28s timeout) always gets the full-screen
  // error/retry card — even on warm boot. That behavior is unchanged by this file;
  // only the *pending* state's presentation differs between cold and warm boot.
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

  // Warm boot (a refresh in a tab that already showed the wallet once) never
  // blocks on the full-screen loader, even while status is still 'pending' — the
  // shell renders immediately and the content area shows its own skeleton via
  // useBootstrapStatus()/useDelayedLoading().
  if (isWarmBoot || status === 'ready') {
    return <BootstrapStatusContext.Provider value={status}>{children}</BootstrapStatusContext.Provider>;
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

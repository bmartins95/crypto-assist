import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Hub } from 'aws-amplify/utils';
import AuthShell from './AuthShell';
import AuthCard from './AuthCard';
import LoadingState from './LoadingState';
import { isAuthenticated } from './useAuth';
import { useLocale } from '@/context/LocaleContext';

// Auth on localhost/warm backends can resolve in well under a second, which — combined
// with AppBootstrapGate's own loading screen right after — cut this screen's entrance
// animation off mid-fade and read as a flicker. A short minimum visible time lets each
// stage actually settle before the next one takes over.
const MIN_VISIBLE_MS = 400;

export default function AuthCallback() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let navigated = false;
    const mountedAt = Date.now();

    const proceed = () => {
      if (navigated) return;
      navigated = true;
      const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - mountedAt));
      setTimeout(() => {
        if (!cancelled) navigate({ to: '/wallet' });
      }, wait);
    };

    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (cancelled) return;
      if (payload.event === 'signInWithRedirect') {
        proceed();
      } else if (payload.event === 'signInWithRedirect_failure') {
        setFailed(true);
      }
    });

    isAuthenticated().then(ok => {
      if (!cancelled && ok) proceed();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [navigate]);

  if (failed) {
    return (
      <AuthShell>
        <AuthCard>
          <div className="auth-error-state">
            <h2>{t.auth_failed}</h2>
            <p>
              <a onClick={() => navigate({ to: '/login' })}>{t.auth_callback_return}</a>
            </p>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard>
        <LoadingState title={t.auth_callback_title} messages={[t.auth_callback_message]} />
      </AuthCard>
    </AuthShell>
  );
}

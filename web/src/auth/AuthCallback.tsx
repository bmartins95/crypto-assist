import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Hub } from 'aws-amplify/utils';
import AuthShell from './AuthShell';
import AuthCard from './AuthCard';
import LoadingState from './LoadingState';
import { isAuthenticated } from './useAuth';
import { useLocale } from '@/context/LocaleContext';

export default function AuthCallback() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (cancelled) return;
      if (payload.event === 'signInWithRedirect') {
        navigate({ to: '/wallet' });
      } else if (payload.event === 'signInWithRedirect_failure') {
        setFailed(true);
      }
    });

    isAuthenticated().then(ok => {
      if (!cancelled && ok) navigate({ to: '/wallet' });
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

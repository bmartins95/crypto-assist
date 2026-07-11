import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import AuthShell from '../AuthShell';
import AuthCard from '../AuthCard';
import BrandMark from '../BrandMark';
import ProviderButton from '../ProviderButton';
import LoadingState from '../LoadingState';
import BackButton from '../BackButton';
import { signInWithRedirect } from '../useAuth';
import { useLocale } from '@/context/LocaleContext';

export default function LoginScreen() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  const handleSocial = async (provider: 'Google' | 'Facebook') => {
    setError('');
    // signInWithRedirect hard-navigates the browser away almost immediately on
    // success — there's no "loading" gap for a normal await to cover, so the
    // loading state has to go up before the call, not after it.
    setRedirecting(true);
    try {
      await signInWithRedirect(provider);
    } catch (err) {
      console.error('signInWithRedirect failed:', err);
      setRedirecting(false);
      setError(t.auth_error_generic);
    }
  };

  if (redirecting) {
    return (
      <AuthShell>
        <AuthCard>
          <LoadingState title={t.auth_callback_title} messages={[t.auth_callback_message]} />
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard>
        <BackButton label={t.auth_back_home} onClick={() => navigate({ to: '/' })} />
        <div className="auth-brand">
          <BrandMark size={60} />
          <h1>{t.auth_welcome}</h1>
          <p>{t.auth_subtitle}</p>
        </div>
        <ProviderButton provider="google" label={t.auth_google} onClick={() => handleSocial('Google')} />
        <ProviderButton provider="facebook" label={t.auth_facebook} onClick={() => handleSocial('Facebook')} />
        <div className="auth-divider">ou</div>
        <ProviderButton provider="email" label={t.auth_email} onClick={() => navigate({ to: '/login/email' })} />
        {error && (
          <p className="auth-field-error" role="alert" style={{ marginTop: 12, textAlign: 'center' }}>
            {error}
          </p>
        )}
        <p className="auth-legal">
          {t.auth_legal_prefix}{' '}
          <a href="/terms">{t.auth_terms_link}</a> {t.auth_legal_and}{' '}
          <a href="/privacy">{t.auth_privacy_link}</a>.
        </p>
      </AuthCard>
    </AuthShell>
  );
}

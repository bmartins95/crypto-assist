import { useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import AuthShell from '../AuthShell';
import AuthCard from '../AuthCard';
import BrandMark from '../BrandMark';
import AuthField from '../AuthField';
import PasswordField from '../PasswordField';
import PasswordRequirements from '../PasswordRequirements';
import ConfirmSignUpCard from '../ConfirmSignUpCard';
import { storePasswordCredential } from '../credentials';
import BackButton from '../BackButton';
import { signIn, resetPassword, confirmResetPassword } from '../useAuth';
import { isPasswordValid } from '../passwordPolicy';
import { useLocale } from '@/context/LocaleContext';

type Mode = 'login' | 'confirm-signup' | 'forgot-request' | 'forgot-confirm' | 'forgot-done';

export default function EmailLoginScreen() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const outcome = await signIn(email, password);
      if (outcome === 'confirm-signup') {
        setMode('confirm-signup');
        return;
      }
      await storePasswordCredential(email, password);
      navigate({ to: '/wallet' });
    } catch {
      setError(t.auth_error_invalid_credentials);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotRequest = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await resetPassword(email);
      setMode('forgot-confirm');
    } catch {
      setError(t.auth_error_generic);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isPasswordValid(newPassword)) {
      setError(t.auth_error_password_short);
      return;
    }
    setSubmitting(true);
    try {
      await confirmResetPassword(email, code, newPassword);
      await storePasswordCredential(email, newPassword);
      setMode('forgot-done');
    } catch (err) {
      const errName = err instanceof Error ? err.name : '';
      setError(errName === 'InvalidPasswordException' ? t.auth_error_password_rejected : t.auth_error_code_invalid);
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'confirm-signup') {
    return (
      <AuthShell>
        <AuthCard>
          <BackButton label={t.auth_back} onClick={() => setMode('login')} />
          <ConfirmSignUpCard
            email={email}
            resendOnMount
            onConfirmed={async () => {
              await signIn(email, password);
              await storePasswordCredential(email, password);
              navigate({ to: '/wallet' });
            }}
          />
        </AuthCard>
      </AuthShell>
    );
  }

  if (mode === 'forgot-request') {
    return (
      <AuthShell>
        <AuthCard>
          <BackButton label={t.auth_back} onClick={() => setMode('login')} />
          <div className="auth-brand">
            <BrandMark size={60} />
            <h1>{t.auth_forgot_title}</h1>
            <p>{t.auth_forgot_subtitle}</p>
          </div>
          <form onSubmit={handleForgotRequest} noValidate>
            <AuthField label={t.auth_field_email} type="email" value={email} onChange={setEmail} autoComplete="email" />
            {error && <p className="auth-field-error" role="alert">{error}</p>}
            <button type="submit" className="auth-btn auth-btn-primary" disabled={submitting}>
              {t.auth_forgot_submit_request}
            </button>
          </form>
        </AuthCard>
      </AuthShell>
    );
  }

  if (mode === 'forgot-confirm') {
    return (
      <AuthShell>
        <AuthCard>
          <BackButton label={t.auth_back} onClick={() => setMode('login')} />
          <div className="auth-brand">
            <BrandMark size={60} />
            <h1>{t.auth_forgot_title}</h1>
            <p>{t.auth_forgot_subtitle}</p>
          </div>
          <form onSubmit={handleForgotConfirm} noValidate>
            <AuthField label={t.auth_forgot_code_label} value={code} onChange={setCode} />
            <PasswordField
              label={t.auth_forgot_new_password_label}
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />
            <PasswordRequirements password={newPassword} />
            {error && <p className="auth-field-error" role="alert">{error}</p>}
            <button type="submit" className="auth-btn auth-btn-primary" disabled={submitting}>
              {t.auth_forgot_submit_confirm}
            </button>
          </form>
        </AuthCard>
      </AuthShell>
    );
  }

  if (mode === 'forgot-done') {
    return (
      <AuthShell>
        <AuthCard>
          <div className="auth-brand">
            <BrandMark size={60} />
            <h1>{t.auth_forgot_title}</h1>
            <p>{t.auth_forgot_success}</p>
          </div>
          <button type="button" className="auth-btn auth-btn-primary" onClick={() => setMode('login')}>
            {t.auth_login_submit}
          </button>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard>
        <BackButton label={t.auth_back} onClick={() => navigate({ to: '/login' })} />
        <div className="auth-brand">
          <BrandMark size={60} />
          <h1>{t.auth_login_title}</h1>
          <p>{t.auth_login_subtitle}</p>
        </div>
        <form onSubmit={handleLogin} noValidate>
          <AuthField label={t.auth_field_email} type="email" value={email} onChange={setEmail} autoComplete="email" />
          <PasswordField
            label={t.auth_field_password}
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          <div className="auth-row-between">
            <span />
            <a onClick={() => setMode('forgot-request')}>{t.auth_forgot_password}</a>
          </div>
          {error && <p className="auth-field-error" role="alert">{error}</p>}
          <button type="submit" className="auth-btn auth-btn-primary" disabled={submitting}>
            {t.auth_login_submit}
          </button>
        </form>
        <p className="auth-foot">
          {t.auth_no_account} <a onClick={() => navigate({ to: '/signup' })}>{t.auth_create_account}</a>
        </p>
      </AuthCard>
    </AuthShell>
  );
}

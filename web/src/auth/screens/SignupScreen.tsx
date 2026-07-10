import { useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import AuthShell from '../AuthShell';
import AuthCard from '../AuthCard';
import BrandMark from '../BrandMark';
import AuthField from '../AuthField';
import { signUp, confirmSignUp, resendSignUpCode, signIn } from '../useAuth';
import { useLocale } from '@/context/LocaleContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = t.auth_error_required_field;
    if (!email.trim()) errors.email = t.auth_error_required_field;
    else if (!EMAIL_RE.test(email)) errors.email = t.auth_error_email_invalid;
    if (!password) errors.password = t.auth_error_required_field;
    else if (password.length < 8) errors.password = t.auth_error_password_short;
    if (!confirmPassword) errors.confirmPassword = t.auth_error_required_field;
    // Both operands are plain-text form input already visible to the user typing them,
    // not a secret comparison — not a timing-attack surface.
    // eslint-disable-next-line security/detect-possible-timing-attacks
    else if (confirmPassword !== password) errors.confirmPassword = t.auth_error_password_mismatch;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      await signUp(name, email, password);
      setStep('confirm');
    } catch (err) {
      const errName = err instanceof Error ? err.name : '';
      setError(errName === 'UsernameExistsException' ? t.auth_error_email_taken : t.auth_error_generic);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await confirmSignUp(email, code);
      await signIn(email, password);
      navigate({ to: '/wallet' });
    } catch {
      setError(t.auth_error_code_invalid);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      await resendSignUpCode(email);
    } catch {
      setError(t.auth_error_generic);
    }
  };

  if (step === 'confirm') {
    return (
      <AuthShell>
        <AuthCard>
          <div className="auth-brand">
            <BrandMark size={60} />
            <h1>{t.auth_confirm_title}</h1>
            <p>{t.auth_confirm_subtitle}</p>
          </div>
          <form onSubmit={handleConfirm} noValidate>
            <AuthField label={t.auth_confirm_code_label} value={code} onChange={setCode} />
            {error && <p className="auth-field-error" role="alert">{error}</p>}
            <button type="submit" className="auth-btn auth-btn-primary" disabled={submitting}>
              {t.auth_confirm_submit}
            </button>
          </form>
          <p className="auth-foot">
            <a onClick={handleResend}>{t.auth_confirm_resend}</a>
          </p>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard>
        <button type="button" className="auth-back" onClick={() => navigate({ to: '/login/email' })}>
          {t.auth_back}
        </button>
        <div className="auth-brand">
          <BrandMark size={60} />
          <h1>{t.auth_signup_title}</h1>
          <p>{t.auth_signup_subtitle}</p>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <AuthField label={t.auth_field_name} value={name} onChange={setName} error={fieldErrors.name} />
          <AuthField
            label={t.auth_field_email}
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            error={fieldErrors.email}
          />
          <AuthField
            label={t.auth_field_password}
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={t.auth_signup_min_password}
            autoComplete="new-password"
            error={fieldErrors.password}
          />
          <AuthField
            label={t.auth_field_confirm_password}
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            error={fieldErrors.confirmPassword}
          />
          {error && <p className="auth-field-error" role="alert">{error}</p>}
          <button type="submit" className="auth-btn auth-btn-primary" disabled={submitting}>
            {t.auth_signup_submit}
          </button>
        </form>
        <p className="auth-foot">
          {t.auth_have_account} <a onClick={() => navigate({ to: '/login/email' })}>{t.auth_login_submit}</a>
        </p>
      </AuthCard>
    </AuthShell>
  );
}

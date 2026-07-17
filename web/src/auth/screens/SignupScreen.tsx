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
import { signUp, signIn } from '../useAuth';
import { isPasswordValid } from '../passwordPolicy';
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = t.auth_error_required_field;
    if (!email.trim()) errors.email = t.auth_error_required_field;
    else if (!EMAIL_RE.test(email)) errors.email = t.auth_error_email_invalid;
    if (!password) errors.password = t.auth_error_required_field;
    else if (!isPasswordValid(password)) errors.password = t.auth_error_password_short;
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
      // The account now exists server-side with this password even though the email
      // is not yet confirmed — this is the success moment for the save-password offer.
      await storePasswordCredential(email, password);
      setStep('confirm');
    } catch (err) {
      const errName = err instanceof Error ? err.name : '';
      const errMessage = err instanceof Error ? err.message : '';
      if (errName === 'UsernameExistsException') setError(t.auth_error_email_taken);
      else if (errName === 'InvalidPasswordException') setError(t.auth_error_password_rejected);
      // Thrown by the Pre Sign-up Lambda (aws-infra/functions/cognito-pre-signup) when this
      // email already belongs to a confirmed Google/Facebook account — Cognito wraps it as
      // UserLambdaValidationException, the reason string is only reachable via .message.
      else if (errName === 'UserLambdaValidationException' && errMessage.includes('linked-to-provider')) {
        setError(t.auth_error_email_linked_provider);
      } else setError(t.auth_error_generic);
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'confirm') {
    return (
      <AuthShell>
        <AuthCard>
          <ConfirmSignUpCard
            email={email}
            onConfirmed={async () => {
              await signIn(email, password);
              navigate({ to: '/wallet' });
            }}
          />
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard>
        <BackButton label={t.auth_back} onClick={() => navigate({ to: '/login/email' })} />
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
          <PasswordField
            label={t.auth_field_password}
            value={password}
            onChange={setPassword}
            placeholder={t.auth_signup_min_password}
            autoComplete="new-password"
            error={fieldErrors.password}
          />
          <PasswordRequirements password={password} />
          <PasswordField
            label={t.auth_field_confirm_password}
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            error={fieldErrors.confirmPassword}
          />
          {confirmPassword !== '' && confirmPassword === password && (
            <p className="auth-password-match" role="status">✓ {t.auth_password_match}</p>
          )}
          {confirmPassword !== '' && confirmPassword !== password && (
            <p className="auth-password-mismatch" role="status">{t.auth_password_mismatch}</p>
          )}
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

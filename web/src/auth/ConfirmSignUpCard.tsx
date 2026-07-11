import { useEffect, useRef, useState, type FormEvent } from 'react';
import BrandMark from './BrandMark';
import AuthField from './AuthField';
import { confirmSignUp, resendSignUpCode } from './useAuth';
import { useLocale } from '@/context/LocaleContext';

const RESEND_COOLDOWN_S = 30;

interface ConfirmSignUpCardProps {
  email: string;
  onConfirmed: () => Promise<void>;
  resendOnMount?: boolean;
}

export default function ConfirmSignUpCard({ email, onConfirmed, resendOnMount = false }: ConfirmSignUpCardProps) {
  const { t } = useLocale();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_S);
  const resentOnMountRef = useRef(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Reaching this card from the login flow means the user's original code is long
  // gone (or expired) — send a fresh one immediately instead of making them find
  // the resend link. Signup reaches this card right after signUp already sent one.
  useEffect(() => {
    if (!resendOnMount || resentOnMountRef.current) return;
    resentOnMountRef.current = true;
    resendSignUpCode(email).catch(() => setError(t.auth_error_generic));
  }, [resendOnMount, email, t]);

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await confirmSignUp(email, code);
      await onConfirmed();
    } catch {
      setError(t.auth_error_code_invalid);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError('');
    try {
      await resendSignUpCode(email);
      setResendCooldown(RESEND_COOLDOWN_S);
    } catch {
      setError(t.auth_error_generic);
    }
  };

  return (
    <>
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
        {resendCooldown > 0 ? (
          <span>{t.auth_confirm_resend_wait.replace('{seconds}', String(resendCooldown))}</span>
        ) : (
          <a onClick={handleResend}>{t.auth_confirm_resend}</a>
        )}
      </p>
    </>
  );
}

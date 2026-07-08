import { useEffect } from 'react';
import { buildAuthUrl } from '@/lib/cognito/client';
import { useLocale } from '@/context/LocaleContext';
import { api } from '@/lib/api/client';

const searchParams = new URLSearchParams(window.location.search);
const authError = searchParams.get('error');

export default function AuthClient() {
  const { t } = useLocale();

  useEffect(() => {
    // Fire-and-forget: wakes the paused Aurora instance while the user goes
    // through the OAuth handshake, so the wallet fetch after login is fast.
    // A failure here changes nothing for the user — the wallet load retries
    // the connection anyway — so there is no UI state to update.
    api.warmupDb().catch(() => undefined);
  }, []);

  const handleGoogle = async () => {
    window.location.href = await buildAuthUrl('Google');
  };

  const handleFacebook = async () => {
    window.location.href = await buildAuthUrl('Facebook');
  };

  const handleEmail = async () => {
    window.location.href = await buildAuthUrl();
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <i className="ti ti-currency-bitcoin" /> {t.app_title}
        </h1>
        <p style={{ color: 'var(--text3)', marginBottom: 24 }}>
          {t.auth_subtitle}
        </p>

        <button
          onClick={handleGoogle}
          className="btn-sm"
          style={{ width: '100%', justifyContent: 'center', padding: '10px 0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <i className="ti ti-brand-google" /> {t.auth_google}
        </button>

        <button
          onClick={handleFacebook}
          className="btn-sm"
          style={{ width: '100%', justifyContent: 'center', padding: '10px 0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <i className="ti ti-brand-facebook" /> {t.auth_facebook}
        </button>

        <button
          onClick={handleEmail}
          className="btn-sm"
          style={{ width: '100%', justifyContent: 'center', padding: '10px 0', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <i className="ti ti-mail" /> {t.auth_email}
        </button>

        {authError && (
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text3)' }}>
            {t.auth_failed}
          </p>
        )}
      </div>
    </div>
  );
}

import { clearSession, buildLogoutUrl } from '@/lib/cognito/client';
import { useLocale } from '@/context/LocaleContext';

export default function LogoutButton() {
  const { t } = useLocale();

  const handleLogout = () => {
    clearSession();
    window.location.href = buildLogoutUrl();
  };

  return (
    <button className="btn-sm" onClick={handleLogout} title={t.nav_logout}>
      <i className="ti ti-logout" /> {t.nav_logout}
    </button>
  );
}

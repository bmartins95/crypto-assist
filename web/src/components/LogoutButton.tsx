import { clearSession, buildLogoutUrl } from '@/lib/cognito/client';

export default function LogoutButton() {
  const handleLogout = () => {
    clearSession();
    window.location.href = buildLogoutUrl();
  };

  return (
    <button className="btn-sm" onClick={handleLogout} title="Sair da conta">
      <i className="ti ti-logout" /> Sair
    </button>
  );
}

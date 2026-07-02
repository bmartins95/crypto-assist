import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { getSession, getEmailFromIdToken, clearSession, buildLogoutUrl } from '@/lib/cognito/client';
import { useLocale } from '@/context/LocaleContext';

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: Props) {
  const { t } = useLocale();
  const [email, setEmail] = useState('');

  useEffect(() => {
    const session = getSession();
    if (session) setEmail(getEmailFromIdToken(session.id_token));
  }, []);

  const handleLogout = () => {
    clearSession();
    window.location.href = buildLogoutUrl();
  };

  const navItems = [
    { to: '/wallet', icon: 'ti ti-wallet', label: t.nav_wallet },
    { to: '/profit', icon: 'ti ti-trending-up', label: t.nav_profit },
    { to: '/history', icon: 'ti ti-receipt', label: t.nav_history },
  ] as const;

  return (
    <aside className="sb">
      <div className="sb-top">
        <div className="brand">
          <span className="logo" aria-hidden="true">₿</span>
          <span className="txt">{t.app_title}</span>
        </div>
        <button
          type="button"
          className="collapse-btn"
          onClick={onToggle}
          aria-label={t.nav_toggle_sidebar}
          aria-expanded={!collapsed}
        >
          <i className="ti ti-chevron-left" aria-hidden="true" />
        </button>
      </div>

      <div className="navlbl">{t.nav_section_portfolio}</div>
      {navItems.map(item => (
        <Link
          key={item.to}
          to={item.to}
          className="navi"
          activeProps={{ className: 'active' }}
          data-tip={item.label}
        >
          <i className={item.icon} aria-hidden="true" />
          <span className="lbl">{item.label}</span>
        </Link>
      ))}

      <div className="sb-foot">
        <Link
          to="/settings"
          className="navi"
          activeProps={{ className: 'active' }}
          data-tip={t.nav_settings}
        >
          <i className="ti ti-settings" aria-hidden="true" />
          <span className="lbl">{t.nav_settings}</span>
        </Link>
        <button type="button" className="navi" onClick={handleLogout} data-tip={t.nav_logout}>
          <i className="ti ti-logout" aria-hidden="true" />
          <span className="lbl">{t.nav_logout}</span>
        </button>
        <div className="userchip">
          <span className="avatar">{email ? email[0].toUpperCase() : ''}</span>
          <span className="ue">{email}</span>
        </div>
      </div>
    </aside>
  );
}

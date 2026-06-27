import { useState, useEffect } from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  Outlet,
  Link,
} from '@tanstack/react-router';
import AuthClient from './app/auth/AuthClient';
import DashboardPage from './app/dashboard/page';
import SettingsPage from './pages/settings';
import LogoutButton from './components/LogoutButton';
import { exchangeCode, getSession, getEmailFromIdToken } from './lib/cognito/client';
import { useLocale } from './context/LocaleContext';

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => { throw redirect({ to: '/dashboard' }); },
});

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth',
  beforeLoad: () => {
    if (getSession()) throw redirect({ to: '/dashboard' });
  },
  component: () => <AuthClient />,
});

function AuthCallbackPage() {
  const { t } = useLocale();
  const [error, setError] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) {
      window.location.replace('/auth?error=auth_callback_failed');
      return;
    }
    exchangeCode(code)
      .then(() => window.location.replace('/dashboard'))
      .catch(() => {
        setError(true);
        setTimeout(() => window.location.replace('/auth?error=auth_callback_failed'), 2000);
      });
  }, []);

  if (error) return <p style={{ padding: 32 }}>{t.auth_failed}</p>;
  return <p style={{ padding: 32 }}>{t.auth_authenticating}</p>;
}

const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  component: AuthCallbackPage,
});

function DashboardLayout() {
  const { t } = useLocale();
  const [email, setEmail] = useState('');

  useEffect(() => {
    const session = getSession();
    if (session) setEmail(getEmailFromIdToken(session.id_token));
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '8px 16px', fontSize: 12, color: 'var(--text3)' }}>
        <span>{email}</span>
        <Link to="/settings" className="btn-sm">
          <i className="ti ti-settings" /> {t.nav_settings}
        </Link>
        <LogoutButton />
      </div>
      <DashboardPage />
    </div>
  );
}

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  beforeLoad: () => {
    if (!getSession()) throw redirect({ to: '/auth' });
  },
  component: DashboardLayout,
});

function SettingsLayout() {
  const { t } = useLocale();
  const [email, setEmail] = useState('');

  useEffect(() => {
    const session = getSession();
    if (session) setEmail(getEmailFromIdToken(session.id_token));
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '8px 16px', fontSize: 12, color: 'var(--text3)' }}>
        <span>{email}</span>
        <Link to="/dashboard" className="btn-sm">
          <i className="ti ti-arrow-left" /> Dashboard
        </Link>
        <LogoutButton />
      </div>
      <div className="app">
        <div className="header">
          <h2>{t.settings_title}</h2>
        </div>
        <SettingsPage />
      </div>
    </div>
  );
}

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  beforeLoad: () => {
    if (!getSession()) throw redirect({ to: '/auth' });
  },
  component: SettingsLayout,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute,
  authCallbackRoute,
  dashboardRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

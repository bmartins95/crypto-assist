import { useState, useEffect } from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  Outlet,
} from '@tanstack/react-router';
import AuthClient from './app/auth/AuthClient';
import DashboardPage from './app/dashboard/page';
import LogoutButton from './components/LogoutButton';
import { exchangeCode, getSession, getEmailFromIdToken } from './lib/cognito/client';

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

  if (error) return <p style={{ padding: 32 }}>Falha na autenticação. Redirecionando...</p>;
  return <p style={{ padding: 32 }}>Autenticando...</p>;
}

const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  component: AuthCallbackPage,
});

function DashboardLayout() {
  const [email, setEmail] = useState('');

  useEffect(() => {
    const session = getSession();
    if (session) setEmail(getEmailFromIdToken(session.id_token));
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '8px 16px', fontSize: 12, color: 'var(--text3)' }}>
        <span>{email}</span>
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

const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute,
  authCallbackRoute,
  dashboardRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

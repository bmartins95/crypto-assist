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
import { createClient } from './lib/supabase/client';

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => { throw redirect({ to: '/dashboard' }); },
});

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth',
  component: () => <AuthClient />,
});

function AuthCallbackPage() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) { window.location.replace('/auth?error=auth_callback_failed'); return; }
    createClient().auth.exchangeCodeForSession(code).then(({ error }) => {
      window.location.replace(error ? '/auth?error=auth_callback_failed' : '/dashboard');
    });
  }, []);
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
    createClient().auth.getSession().then(({ data: { session } }) => {
      setEmail(session?.user?.email ?? '');
    });
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
  beforeLoad: async () => {
    const { data: { session } } = await createClient().auth.getSession();
    if (!session) throw redirect({ to: '/auth' });
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

import { useState, useEffect } from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  Outlet,
  type RouterHistory,
} from '@tanstack/react-router';
import AuthClient from './app/auth/AuthClient';
import SettingsPage from './pages/settings';
import AppLayout, { usePortfolio } from './components/AppLayout';
import WalletTab from './components/WalletTab';
import ProfitTab from './components/ProfitTab';
import HistoryTab from './components/HistoryTab';
import { exchangeCode, getSession } from './lib/cognito/client';
import { useLocale } from './context/LocaleContext';

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => { throw redirect({ to: '/wallet' }); },
});

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth',
  beforeLoad: () => {
    if (getSession()) throw redirect({ to: '/wallet' });
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
      .then(() => window.location.replace('/wallet'))
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

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: () => {
    if (!getSession()) throw redirect({ to: '/auth' });
  },
  component: AppLayout,
});

function WalletRoute() {
  const p = usePortfolio();
  return (
    <div className="app">
      <WalletTab
        ops={p.ops} assets={p.assets} prices={p.prices} avatarCache={p.avatarCache}
        groupMode={p.groupMode} onGroupMode={p.setGroupMode}
        statusMsg={p.statusMsg} onFetchPrices={p.fetchPrices}
        onExitPriceChange={p.setExitPrice}
      />
    </div>
  );
}

function ProfitRoute() {
  const p = usePortfolio();
  return (
    <div className="app">
      <ProfitTab
        ops={p.ops} prices={p.prices}
        activeChart={p.activeChart} onChartSwitch={p.setActiveChart}
        statusMsg={p.statusMsg} onFetchPrices={p.fetchPrices}
      />
    </div>
  );
}

function HistoryRoute() {
  const p = usePortfolio();
  return (
    <div className="app">
      <HistoryTab
        ops={p.ops} assets={p.assets} prices={p.prices}
        onAddOp={p.addOp} onEditOp={p.editOp} onRemoveOp={p.removeOp}
      />
    </div>
  );
}

function SettingsRoute() {
  const { t } = useLocale();
  return (
    <div className="app">
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1.2 }}>
          {t.settings_title}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--s-text-dim)', marginTop: 3 }}>
          {t.settings_subtitle}
        </p>
      </div>
      <SettingsPage />
    </div>
  );
}

const walletRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/wallet',
  component: WalletRoute,
});

const profitRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/profit',
  component: ProfitRoute,
});

const historyRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/history',
  component: HistoryRoute,
});

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/settings',
  component: SettingsRoute,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute,
  authCallbackRoute,
  appLayoutRoute.addChildren([walletRoute, profitRoute, historyRoute, settingsRoute]),
]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history });
}

export const router = createAppRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  Outlet,
  type RouterHistory,
} from '@tanstack/react-router';
import HeroPage from './auth/screens/HeroPage';
import LoginScreen from './auth/screens/LoginScreen';
import EmailLoginScreen from './auth/screens/EmailLoginScreen';
import SignupScreen from './auth/screens/SignupScreen';
import AuthCallback from './auth/AuthCallback';
import { requireAuth, redirectIfAuthenticated } from './auth/RequireAuth';
import { isAuthenticated } from './auth/useAuth';
import SettingsPage from './pages/settings';
import PrivacyPage from './pages/privacy';
import TermsPage from './pages/terms';
import DataDeletionPage from './pages/data-deletion';
import AppLayout, { usePortfolio } from './components/AppLayout';
import WalletTab from './components/WalletTab';
import ProfitTab from './components/ProfitTab';
import HistoryTab from './components/HistoryTab';
import { useLocale } from './context/LocaleContext';

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async () => {
    if (await isAuthenticated()) {
      throw redirect({ to: '/wallet' });
    }
  },
  component: HeroPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: redirectIfAuthenticated,
  component: LoginScreen,
});

const loginEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login/email',
  beforeLoad: redirectIfAuthenticated,
  component: EmailLoginScreen,
});

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  beforeLoad: redirectIfAuthenticated,
  component: SignupScreen,
});

const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  component: AuthCallback,
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: PrivacyPage,
});

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terms',
  component: TermsPage,
});

const dataDeletionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/data-deletion',
  component: DataDeletionPage,
});

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: requireAuth,
  component: AppLayout,
});

function WalletRoute() {
  const p = usePortfolio();
  return (
    <div className="app">
      <WalletTab
        ops={p.usdOps} assets={p.assets} prices={p.prices} avatarCache={p.avatarCache}
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
        ops={p.usdOps} prices={p.prices}
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
  loginRoute,
  loginEmailRoute,
  signupRoute,
  authCallbackRoute,
  privacyRoute,
  termsRoute,
  dataDeletionRoute,
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

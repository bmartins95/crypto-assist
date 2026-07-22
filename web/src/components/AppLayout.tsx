import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet } from '@tanstack/react-router';
import { Op, NewOp, OpClosure, Prices, AvatarCache, GroupMode, ChartType, BackupPayload, Asset } from '@/lib/types';
import { storage, getLegacyOps, getLegacyExitPrices, hasMigrationBeenDeclined, declineMigration, clearLegacyData } from '@/lib/storage';
import { api } from '@/lib/api/client';
import { collectAssets, convertOpsToUsd } from '@/lib/portfolio';
import Sidebar from '@/components/Sidebar';
import Toast, { ToastKind } from '@/components/Toast';
import AppBootstrapGate from '@/auth/AppBootstrapGate';
import { useLocale } from '@/context/LocaleContext';
import { useCurrency } from '@/context/CurrencyContext';
import { usePriceRefresh } from '@/context/PriceRefreshContext';

interface PortfolioContextValue {
  ops: Op[];
  usdOps: Op[];
  assets: Asset[];
  prices: Prices;
  avatarCache: AvatarCache;
  closures: OpClosure[];
  statusMsg: string;
  groupMode: GroupMode;
  setGroupMode: (mode: GroupMode) => void;
  activeChart: ChartType;
  setActiveChart: (chart: ChartType) => void;
  fetchPrices: () => Promise<void>;
  addOp: (op: NewOp) => Promise<void>;
  editOp: (id: string, op: NewOp) => Promise<void>;
  removeOp: (id: string) => Promise<void>;
  closeOp: (sourceOpId: string, op: NewOp, qtyToClose: number) => Promise<void>;
  setExitPrice: (coinId: string, value: string) => Promise<void>;
  reload: () => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function usePortfolio(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio must be used within AppLayout');
  return ctx;
}

export default function AppLayout() {
  const { locale, t } = useLocale();
  const { rates } = useCurrency();
  const { interval } = usePriceRefresh();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar:collapsed') === '1');
  const [ops, setOps] = useState<Op[]>([]);
  const [closures, setClosures] = useState<OpClosure[]>([]);
  const [exitPrices, setExitPrices] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Prices>({});
  const [avatarCache, setAvatarCache] = useState<AvatarCache>({});
  const [groupMode, setGroupMode] = useState<GroupMode>('asset');
  const [activeChart, setActiveChart] = useState<ChartType>('by-asset');
  const [statusMsg, setStatusMsg] = useState('');
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null);

  const toggleSidebar = useCallback(() => {
    setCollapsed(prev => {
      localStorage.setItem('sidebar:collapsed', prev ? '0' : '1');
      return !prev;
    });
  }, []);

  // Without rates no op amount can be normalized to USD; empty positions plus the
  // rates-status message beat rendering numbers in mixed currencies (FR-009).
  const usdOps = useMemo(() => (rates ? convertOpsToUsd(ops, rates) : []), [ops, rates]);
  const assets = useMemo(() => collectAssets(usdOps, exitPrices, closures), [usdOps, exitPrices, closures]);

  const reload = useCallback(async () => {
    const [remoteOps, remoteExitPrices, remoteClosures] = await Promise.all([api.getOps(), api.getExitPrices(), api.getOpClosures()]);
    setOps(remoteOps);
    setExitPrices(remoteExitPrices);
    setClosures(remoteClosures);

    const ids = [...new Set(remoteOps.map(o => o.coinId))];
    if (ids.length === 0) return;
    // Covers the same "first price fetch" job as the mount-time auto-fetch effect below,
    // so that effect doesn't also fire and double up this request right after an import.
    didAutoFetchPrices.current = true;
    try {
      const market = await api.getPrices(ids);
      setPrices(prev => {
        const next = { ...prev };
        for (const [coinId, info] of Object.entries(market)) next[coinId] = info.price;
        return next;
      });
      setAvatarCache(prev => {
        const next = { ...prev };
        for (const [coinId, info] of Object.entries(market)) if (info.image) next[coinId] = { url: info.image };
        return next;
      });
    } catch {
      // Best-effort top-up: leave existing prices in place. The manual refresh
      // button or the auto-refresh interval will retry.
    }
  }, []);

  // Deliberately lets a failure here propagate instead of catching it: AppBootstrapGate
  // (the caller) awaits this promise and shows its own full-screen error/retry state on
  // rejection. Swallowing the error here used to leave the wallet silently rendering
  // with an empty portfolio on any transient failure (Aurora cold start, a token not
  // yet ready right after login) — the exact bug of "wallet loads empty, refresh fixes
  // it" — since AppBootstrapGate never saw the failure and always moved on to 'ready'.
  const bootstrap = useCallback(async () => {
    setAvatarCache(storage.getAvatars());
    const [remoteOps, remoteExitPrices, remoteClosures] = await Promise.all([api.getOps(), api.getExitPrices(), api.getOpClosures()]);

    if (remoteOps.length === 0) {
      const legacyOps = getLegacyOps();
      if (legacyOps.length > 0 && !hasMigrationBeenDeclined()) {
        const wantsImport = confirm(t.dashboard_confirm_legacy);
        if (wantsImport) {
          const legacyExitPrices = getLegacyExitPrices();
          const legacyBackup: BackupPayload = { version: 1, exportedAt: new Date().toISOString(), ops: legacyOps, exitPrices: legacyExitPrices };
          await api.importBackup(legacyBackup);
          clearLegacyData();
          await reload();
          return;
        }
        declineMigration();
      }
    }

    setOps(remoteOps);
    setExitPrices(remoteExitPrices);
    setClosures(remoteClosures);
  }, [reload, t]);

  const addOp = useCallback(async (op: NewOp) => {
    try {
      const created = await api.createOp(op);
      setOps(prev => [...prev, created]);
    } catch (e) {
      // Re-thrown so callers (e.g. a swap's second leg) don't proceed as if this
      // succeeded — HistoryTab relies on the rejection to skip its own success toast
      // and to stop a multi-step submission (a swap) after the first leg fails.
      setToast({ kind: 'error', message: t.dashboard_error_add_op });
      throw e;
    }
  }, [t]);

  const editOp = useCallback(async (id: string, op: NewOp) => {
    try {
      const updated = await api.updateOp(id, op);
      setOps(prev => prev.map(o => (o.id === id ? updated : o)));
    } catch (e) {
      setToast({ kind: 'error', message: t.dashboard_error_edit_op });
      throw e;
    }
  }, [t]);

  const removeOp = useCallback(async (id: string) => {
    try {
      // The backend deletes the whole trade group when the op belongs to one (both legs
      // of a swap or a trade-close), so honour the ids it actually removed rather than
      // assuming a single row.
      const { deletedIds } = await api.deleteOp(id);
      const removed = new Set(deletedIds);
      setOps(prev => prev.filter(o => !removed.has(o.id)));
      // The DB cascades op_closures on either side (ON DELETE CASCADE on both source_op_id
      // and closing_op_id), so drop the same rows locally — otherwise a deleted closing op
      // would leave its link behind and keep the source op stuck as partially closed.
      setClosures(prev => prev.filter(c => !removed.has(c.sourceOpId) && !removed.has(c.closingOpId)));
    } catch (e) {
      setToast({ kind: 'error', message: t.dashboard_error_delete_op });
      throw e;
    }
  }, [t]);

  const closeOp = useCallback(async (sourceOpId: string, op: NewOp, qtyToClose: number) => {
    try {
      const { closingOp, closures: newClosures } = await api.closeOp(sourceOpId, { closingOp: op, qtyToClose });
      setOps(prev => [...prev, closingOp]);
      setClosures(prev => [...prev, ...newClosures]);
    } catch (e) {
      setToast({ kind: 'error', message: t.dashboard_error_add_op });
      throw e;
    }
  }, [t]);

  const setExitPrice = useCallback(async (coinId: string, value: string) => {
    const exitPrice = parseFloat(value) || 0;
    try {
      await api.setExitPrice(coinId, exitPrice);
      setExitPrices(prev => {
        const next = { ...prev };
        if (exitPrice > 0) next[coinId] = exitPrice; else delete next[coinId];
        return next;
      });
    } catch {
      setStatusMsg(t.dashboard_error_exit_price);
    }
  }, [t]);

  const fetchPrices = useCallback(async () => {
    if (!assets.length) { setStatusMsg(t.dashboard_status_no_ops); return; }
    setStatusMsg(t.dashboard_status_fetching);
    const ids = [...new Set(assets.map(a => a.coinId))];
    try {
      const market = await api.getPrices(ids);
      const newPrices: Prices = { ...prices };
      const newAvatars: AvatarCache = { ...avatarCache };
      let updated = 0;
      for (const [coinId, info] of Object.entries(market)) {
        newPrices[coinId] = info.price;
        updated++;
        if (info.image) newAvatars[coinId] = { url: info.image };
      }
      setPrices(newPrices);
      setAvatarCache(newAvatars);
      storage.setAvatars(newAvatars);
      const now = new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
      const missing = ids.length - updated;
      setStatusMsg(missing > 0
        ? t.dashboard_status_updated_missing.replace('{time}', now).replace('{count}', String(missing))
        : t.dashboard_status_updated.replace('{time}', now));
    } catch (e: unknown) {
      const status = (e as { status?: number }).status;
      if (status === 429) setStatusMsg(t.dashboard_status_rate_limited);
      else setStatusMsg(t.dashboard_status_fetch_error);
    }
  }, [assets, prices, avatarCache, locale, t]);

  const didAutoFetchPrices = useRef(false);
  useEffect(() => {
    if (assets.length > 0 && !didAutoFetchPrices.current) {
      didAutoFetchPrices.current = true;
      fetchPrices();
    }
  }, [assets, fetchPrices]);

  // fetchPrices' identity changes every time prices/avatarCache update; reading it through
  // a ref keeps this effect's own dependency to just `interval`, so scheduling isn't reset each tick.
  const fetchPricesRef = useRef(fetchPrices);
  useEffect(() => { fetchPricesRef.current = fetchPrices; }, [fetchPrices]);

  useEffect(() => {
    if (interval === null) return;
    const id = window.setInterval(() => fetchPricesRef.current(), interval);
    return () => window.clearInterval(id);
  }, [interval]);

  const portfolio = useMemo<PortfolioContextValue>(() => ({
    ops, usdOps, assets, prices, avatarCache, closures, statusMsg,
    groupMode, setGroupMode, activeChart, setActiveChart,
    fetchPrices, addOp, editOp, removeOp, closeOp, setExitPrice, reload,
  }), [ops, usdOps, assets, prices, avatarCache, closures, statusMsg, groupMode, activeChart, fetchPrices, addOp, editOp, removeOp, closeOp, setExitPrice, reload]);

  return (
    <AppBootstrapGate run={bootstrap}>
      <div className={collapsed ? 'layout collapsed' : 'layout'}>
        <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
        <main className="content">
          <PortfolioContext.Provider value={portfolio}>
            <Outlet />
          </PortfolioContext.Provider>
        </main>
      </div>
      {toast && (
        <Toast kind={toast.kind} message={toast.message} onDismiss={() => setToast(null)} closeLabel={t.common_close} />
      )}
    </AppBootstrapGate>
  );
}

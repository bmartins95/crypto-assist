import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet } from '@tanstack/react-router';
import { Op, NewOp, Prices, AvatarCache, GroupMode, ChartType, BackupPayload, Asset } from '@/lib/types';
import { storage, getLegacyOps, getLegacyExitPrices, hasMigrationBeenDeclined, declineMigration, clearLegacyData } from '@/lib/storage';
import { api } from '@/lib/api/client';
import { collectAssets } from '@/lib/portfolio';
import Sidebar from '@/components/Sidebar';
import { useLocale } from '@/context/LocaleContext';

interface PortfolioContextValue {
  ops: Op[];
  assets: Asset[];
  prices: Prices;
  avatarCache: AvatarCache;
  statusMsg: string;
  groupMode: GroupMode;
  setGroupMode: (mode: GroupMode) => void;
  activeChart: ChartType;
  setActiveChart: (chart: ChartType) => void;
  fetchPrices: () => Promise<void>;
  addOp: (op: NewOp) => Promise<void>;
  editOp: (id: string, op: NewOp) => Promise<void>;
  removeOp: (id: string) => Promise<void>;
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
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar:collapsed') === '1');
  const [ops, setOps] = useState<Op[]>([]);
  const [exitPrices, setExitPrices] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Prices>({});
  const [avatarCache, setAvatarCache] = useState<AvatarCache>({});
  const [loading, setLoading] = useState(true);
  const [groupMode, setGroupMode] = useState<GroupMode>('asset');
  const [activeChart, setActiveChart] = useState<ChartType>('by-asset');
  const [statusMsg, setStatusMsg] = useState('');

  const toggleSidebar = useCallback(() => {
    setCollapsed(prev => {
      localStorage.setItem('sidebar:collapsed', prev ? '0' : '1');
      return !prev;
    });
  }, []);

  const assets = useMemo(() => collectAssets(ops, exitPrices), [ops, exitPrices]);

  const reload = useCallback(async () => {
    const [remoteOps, remoteExitPrices] = await Promise.all([api.getOps(), api.getExitPrices()]);
    setOps(remoteOps);
    setExitPrices(remoteExitPrices);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAvatarCache(storage.getAvatars());
      try {
        const [remoteOps, remoteExitPrices] = await Promise.all([api.getOps(), api.getExitPrices()]);
        if (cancelled) return;

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
              if (!cancelled) setLoading(false);
              return;
            }
            declineMigration();
          }
        }

        setOps(remoteOps);
        setExitPrices(remoteExitPrices);
      } catch {
        setStatusMsg(t.dashboard_error_load);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reload]);

  const addOp = useCallback(async (op: NewOp) => {
    try {
      const created = await api.createOp(op);
      setOps(prev => [...prev, created]);
    } catch {
      alert(t.dashboard_error_add_op);
    }
  }, [t]);

  const editOp = useCallback(async (id: string, op: NewOp) => {
    try {
      const updated = await api.updateOp(id, op);
      setOps(prev => prev.map(o => (o.id === id ? updated : o)));
    } catch {
      alert(t.dashboard_error_edit_op);
    }
  }, [t]);

  const removeOp = useCallback(async (id: string) => {
    try {
      await api.deleteOp(id);
      setOps(prev => prev.filter(o => o.id !== id));
    } catch {
      alert(t.dashboard_error_delete_op);
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
    if (!loading && assets.length > 0 && !didAutoFetchPrices.current) {
      didAutoFetchPrices.current = true;
      fetchPrices();
    }
  }, [loading, assets, fetchPrices]);

  const portfolio = useMemo<PortfolioContextValue>(() => ({
    ops, assets, prices, avatarCache, statusMsg,
    groupMode, setGroupMode, activeChart, setActiveChart,
    fetchPrices, addOp, editOp, removeOp, setExitPrice, reload,
  }), [ops, assets, prices, avatarCache, statusMsg, groupMode, activeChart, fetchPrices, addOp, editOp, removeOp, setExitPrice, reload]);

  return (
    <div className={collapsed ? 'layout collapsed' : 'layout'}>
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <main className="content">
        {loading ? (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <i className="ti ti-loader-2" />
            <span>{t.common_loading}</span>
          </div>
        ) : (
          <PortfolioContext.Provider value={portfolio}>
            <Outlet />
          </PortfolioContext.Provider>
        )}
      </main>
    </div>
  );
}

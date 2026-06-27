import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Op, NewOp, Prices, AvatarCache, TabType, GroupMode, ChartType, BackupPayload } from '@/lib/types';
import { storage, getLegacyOps, getLegacyExitPrices, hasMigrationBeenDeclined, declineMigration, clearLegacyData } from '@/lib/storage';
import { api } from '@/lib/api/client';
import { collectAssets } from '@/lib/portfolio';
import WalletTab from '@/components/WalletTab';
import ProfitTab from '@/components/ProfitTab';
import HistoryTab from '@/components/HistoryTab';
import { useLocale } from '@/context/LocaleContext';

export default function DashboardPage() {
  const { locale, t } = useLocale();
  const [ops, setOps] = useState<Op[]>([]);
  const [exitPrices, setExitPrices] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Prices>({});
  const [avatarCache, setAvatarCache] = useState<AvatarCache>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('wallet');
  const [groupMode, setGroupMode] = useState<GroupMode>('asset');
  const [activeChart, setActiveChart] = useState<ChartType>('by-asset');
  const [statusMsg, setStatusMsg] = useState('');

  const assets = useMemo(() => collectAssets(ops, exitPrices), [ops, exitPrices]);

  const reloadFromBackend = useCallback(async () => {
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
              await reloadFromBackend();
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
  }, [reloadFromBackend]);

  const handleAddOp = useCallback(async (op: NewOp) => {
    try {
      const created = await api.createOp(op);
      setOps(prev => [...prev, created]);
    } catch {
      alert(t.dashboard_error_add_op);
    }
  }, [t]);

  const handleEditOp = useCallback(async (id: string, op: NewOp) => {
    try {
      const updated = await api.updateOp(id, op);
      setOps(prev => prev.map(o => (o.id === id ? updated : o)));
    } catch {
      alert(t.dashboard_error_edit_op);
    }
  }, [t]);

  const handleRemoveOp = useCallback(async (id: string) => {
    try {
      await api.deleteOp(id);
      setOps(prev => prev.filter(o => o.id !== id));
    } catch {
      alert(t.dashboard_error_delete_op);
    }
  }, [t]);

  const handleExitPriceChange = useCallback(async (coinId: string, value: string) => {
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

  const exportData = async () => {
    try {
      const backup = await api.exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'carteira-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click(); URL.revokeObjectURL(a.href);
    } catch {
      alert(t.dashboard_error_export);
    }
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const backup = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(backup.ops)) throw new Error('Formato inválido');
        await api.importBackup(backup);
        await reloadFromBackend();
        e.target.value = '';
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('Session not found')) {
          alert(t.dashboard_error_session);
        } else {
          alert(t.dashboard_error_import);
        }
      }
    };
    reader.readAsText(file);
  };

  const tabs: TabType[] = ['wallet', 'profit', 'history'];

  return (
    <div className="app">
      <div className="header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1><i className="ti ti-currency-bitcoin" /> {t.app_title}</h1>
          <p>{t.dashboard_subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginTop: 2, alignItems: 'center' }}>
          <button className="btn-sm" onClick={exportData} title={t.dashboard_export}><i className="ti ti-download" /> {t.dashboard_export}</button>
          <label className="btn-sm" style={{ cursor: 'pointer', border: '0.5px solid var(--border2)', borderRadius: 'var(--radius)', padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }} title={t.dashboard_import}>
            <i className="ti ti-upload" /> {t.dashboard_import}
            <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }} aria-label={t.dashboard_import} />
          </label>
        </div>
      </div>

      <div className="nav">
        {tabs.map(tab => (
          <button key={tab} className={`nav-btn${activeTab === tab ? ' active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'wallet' && <><i className="ti ti-wallet" /> <span>{t.tabs_wallet}</span></>}
            {tab === 'profit' && <><i className="ti ti-trending-up" /> <span>{t.tabs_profit}</span></>}
            {tab === 'history' && <><i className="ti ti-receipt" /> <span>{t.tabs_history}</span></>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <i className="ti ti-loader-2" />
          <span>{t.common_loading}</span>
        </div>
      ) : (
        <>
          {activeTab === 'wallet' && (
            <WalletTab
              ops={ops} assets={assets} prices={prices} avatarCache={avatarCache}
              groupMode={groupMode} onGroupMode={setGroupMode}
              statusMsg={statusMsg} onFetchPrices={fetchPrices}
              onExitPriceChange={handleExitPriceChange}
            />
          )}
          {activeTab === 'profit' && (
            <ProfitTab
              assets={assets} ops={ops} prices={prices}
              activeChart={activeChart} onChartSwitch={setActiveChart}
            />
          )}
          {activeTab === 'history' && (
            <HistoryTab
              ops={ops} assets={assets} prices={prices}
              onAddOp={handleAddOp} onEditOp={handleEditOp} onRemoveOp={handleRemoveOp}
            />
          )}
        </>
      )}
    </div>
  );
}

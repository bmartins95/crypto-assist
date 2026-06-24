import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Op, NewOp, Prices, AvatarCache, TabType, GroupMode, ChartType, BackupPayload } from '@/lib/types';
import { storage, getLegacyOps, getLegacyExitPrices, hasMigrationBeenDeclined, declineMigration, clearLegacyData } from '@/lib/storage';
import { api } from '@/lib/api/client';
import { collectAssets } from '@/lib/portfolio';
import { driveFindFile, driveUpload, driveDownload, GDRIVE_FILE_NAME, GDRIVE_CONFIG_NAME } from '@/lib/gdrive';
import WalletTab from '@/components/WalletTab';
import ProfitTab from '@/components/ProfitTab';
import HistoryTab from '@/components/HistoryTab';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: { error?: string; access_token?: string }) => void;
          }) => { requestAccessToken: (opts: { prompt: string }) => void };
        };
      };
    };
  }
}

export default function DashboardPage() {
  const [ops, setOps] = useState<Op[]>([]);
  const [exitPrices, setExitPrices] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Prices>({});
  const [avatarCache, setAvatarCache] = useState<AvatarCache>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('wallet');
  const [groupMode, setGroupMode] = useState<GroupMode>('asset');
  const [activeChart, setActiveChart] = useState<ChartType>('by-asset');
  const [statusMsg, setStatusMsg] = useState('');
  const [driveStatus, setDriveStatus] = useState('');

  // Google Drive state
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [configFileId, setConfigFileId] = useState<string | null>(null);
  const [coingeckoApiKey, setCoingeckoApiKey] = useState('');
  const [tokenClient, setTokenClient] = useState<{ requestAccessToken: (o: { prompt: string }) => void } | null>(null);
  const [driveConnected, setDriveConnected] = useState(false);

  const assets = useMemo(() => collectAssets(ops, exitPrices), [ops, exitPrices]);

  const reloadFromBackend = useCallback(async () => {
    const [remoteOps, remoteExitPrices] = await Promise.all([api.getOps(), api.getExitPrices()]);
    setOps(remoteOps);
    setExitPrices(remoteExitPrices);
  }, []);

  // ─── Initial load: fetch from the backend, offer to import legacy localStorage data ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAvatarCache(storage.getAvatars());
      if (storage.getGdriveUsed()) setDriveStatus('Clique em Drive para sincronizar');
      try {
        const [remoteOps, remoteExitPrices] = await Promise.all([api.getOps(), api.getExitPrices()]);
        if (cancelled) return;

        if (remoteOps.length === 0) {
          const legacyOps = getLegacyOps();
          if (legacyOps.length > 0 && !hasMigrationBeenDeclined()) {
            const wantsImport = confirm('Detectamos dados salvos neste navegador. Deseja importar para sua conta?');
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
        setStatusMsg('Erro ao carregar seus dados. Recarregue a página.');
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
      alert('Erro ao registrar a operação. Tente novamente.');
    }
  }, []);

  const handleEditOp = useCallback(async (id: string, op: NewOp) => {
    try {
      const updated = await api.updateOp(id, op);
      setOps(prev => prev.map(o => (o.id === id ? updated : o)));
    } catch {
      alert('Erro ao salvar a operação. Tente novamente.');
    }
  }, []);

  const handleRemoveOp = useCallback(async (id: string) => {
    try {
      await api.deleteOp(id);
      setOps(prev => prev.filter(o => o.id !== id));
    } catch {
      alert('Erro ao excluir a operação. Tente novamente.');
    }
  }, []);

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
      setStatusMsg('Erro ao salvar meta de saída.');
    }
  }, []);

  // ─── Prices (backend-cached CoinGecko) ────────────────────────────────────
  const fetchPrices = useCallback(async () => {
    if (!assets.length) { setStatusMsg('Registre operações no Histórico primeiro.'); return; }
    setStatusMsg('Buscando cotações...');
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
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const missing = ids.length - updated;
      setStatusMsg(missing > 0 ? `Atualizado às ${now} (${missing} ativo(s) sem cotação)` : 'Atualizado às ' + now);
    } catch (e: unknown) {
      const status = (e as { status?: number }).status;
      if (status === 429) setStatusMsg('Limite de requisições atingido. Aguarde alguns minutos.');
      else setStatusMsg('Erro ao buscar preços. Verifique sua conexão.');
    }
  }, [assets, prices, avatarCache]);

  // Fetch prices once automatically after the wallet first has assets to price.
  const didAutoFetchPrices = useRef(false);
  useEffect(() => {
    if (!loading && assets.length > 0 && !didAutoFetchPrices.current) {
      didAutoFetchPrices.current = true;
      fetchPrices();
    }
  }, [loading, assets, fetchPrices]);

  // ─── Export / Import (full account backup via the backend) ────────────────
  const exportData = async () => {
    try {
      const backup = await api.exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'carteira-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click(); URL.revokeObjectURL(a.href);
    } catch {
      alert('Erro ao exportar backup.');
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
      } catch { alert('Arquivo inválido. Use um backup exportado por esta aplicação.'); }
    };
    reader.readAsText(file);
  };

  // ─── Google Drive ─────────────────────────────────────────────────────────────
  const gdriveOnToken = useCallback(async (resp: { error?: string; access_token?: string }) => {
    if (resp.error || !resp.access_token) { setDriveStatus('Erro: ' + resp.error); return; }
    const token = resp.access_token;
    setDriveToken(token); setDriveConnected(true);
    storage.setGdriveUsed();
    setDriveStatus('Conectado');
    // Load config (CoinGecko key)
    try {
      const cfgId = configFileId || await driveFindFile(GDRIVE_CONFIG_NAME, token);
      if (cfgId) {
        setConfigFileId(cfgId);
        const cfg = await driveDownload<{ coingecko_api_key?: string }>(cfgId, token);
        if (cfg.coingecko_api_key) setCoingeckoApiKey(cfg.coingecko_api_key);
      }
    } catch { /* sem config é ok */ }
  }, [configFileId]);

  const gdriveConnect = useCallback(() => {
    let clientId = storage.getClientId();
    if (!clientId) {
      const input = prompt('Cole aqui o seu Google OAuth Client ID:\n\n(Acesse console.cloud.google.com → APIs & Services → Credentials)');
      if (!input?.trim()) return;
      clientId = input.trim();
      storage.setClientId(clientId);
    }
    if (!window.google?.accounts) { alert('Google Identity Services ainda não carregou. Aguarde e tente novamente.'); return; }

    let client = tokenClient;
    if (!client) {
      client = window.google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: 'https://www.googleapis.com/auth/drive.file', callback: gdriveOnToken });
      setTokenClient(client);
    }
    client.requestAccessToken({ prompt: driveToken ? '' : 'consent' });
  }, [tokenClient, driveToken, gdriveOnToken]);

  const gdriveDisconnect = useCallback(() => {
    if (!confirm('Desconectar do Google Drive?\n\nSeus dados na conta não serão apagados.')) return;
    storage.removeClientId(); storage.removeGdriveUsed();
    setDriveToken(null); setTokenClient(null); setDriveFileId(null); setConfigFileId(null);
    setCoingeckoApiKey(''); setDriveConnected(false); setDriveStatus('');
  }, []);

  const gdriveSave = useCallback(async () => {
    if (!driveToken) { gdriveConnect(); return; }
    setDriveStatus('Salvando...');
    try {
      const backup = await api.exportBackup();
      const payload = JSON.stringify(backup, null, 2);
      const existingId = driveFileId || await driveFindFile(GDRIVE_FILE_NAME, driveToken);
      const newId = await driveUpload(GDRIVE_FILE_NAME, payload, driveToken, existingId);
      setDriveFileId(newId);
      setDriveStatus('Salvo às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (e: unknown) {
      if ((e as Error).message !== 'token_expired') setDriveStatus('Erro ao salvar');
      else { setDriveToken(null); setDriveConnected(false); setDriveStatus('Sessão expirada — reconecte'); }
    }
  }, [driveToken, driveFileId, gdriveConnect]);

  const gdriveLoad = useCallback(async () => {
    if (!driveToken) { gdriveConnect(); return; }
    setDriveStatus('Carregando...');
    try {
      const fid = driveFileId || await driveFindFile(GDRIVE_FILE_NAME, driveToken);
      if (!fid) { setDriveStatus('Nenhum backup no Drive'); return; }
      setDriveFileId(fid);
      const backup = await driveDownload<BackupPayload>(fid, driveToken);
      if (!Array.isArray(backup.ops)) throw new Error('invalid');
      await api.importBackup(backup);
      await reloadFromBackend();
      setDriveStatus('Carregado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (e: unknown) {
      if ((e as Error).message !== 'token_expired') setDriveStatus('Erro ao carregar');
      else { setDriveToken(null); setDriveConnected(false); setDriveStatus('Sessão expirada — reconecte'); }
    }
  }, [driveToken, driveFileId, gdriveConnect, reloadFromBackend]);

  const gdriveConfigKey = useCallback(() => {
    const key = prompt('Cole sua chave da API CoinGecko Demo:\n(deixe em branco para remover)', coingeckoApiKey);
    if (key === null) return;
    if (!driveToken) { gdriveConnect(); return; }
    setDriveStatus('Salvando chave...');
    const payload = JSON.stringify({ coingecko_api_key: key.trim() });
    (async () => {
      try {
        const existingId = configFileId || await driveFindFile(GDRIVE_CONFIG_NAME, driveToken);
        const newId = await driveUpload(GDRIVE_CONFIG_NAME, payload, driveToken, existingId);
        setConfigFileId(newId);
        setCoingeckoApiKey(key.trim());
        setDriveStatus(key.trim() ? 'Chave salva no Drive' : 'Chave removida');
      } catch { setDriveStatus('Erro ao salvar chave'); }
    })();
  }, [driveToken, configFileId, coingeckoApiKey, gdriveConnect]);

  const tabs: TabType[] = ['wallet', 'profit', 'history'];

  return (
    <div className="app">
      {/* Header */}
      <div className="header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1><i className="ti ti-currency-bitcoin" /> Carteira de Criptoativos</h1>
          <p>Cotações em tempo real via CoinGecko · Valores em reais (BRL)</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginTop: 2, alignItems: 'center' }}>
          <button className="btn-sm" onClick={exportData} title="Exportar backup em JSON"><i className="ti ti-download" /> Exportar</button>
          <label className="btn-sm" style={{ cursor: 'pointer', border: '0.5px solid var(--border2)', borderRadius: 'var(--radius)', padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }} title="Importar backup JSON">
            <i className="ti ti-upload" /> Importar
            <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }} />
          </label>
          <div style={{ width: 1, height: 20, background: 'var(--border2)', flexShrink: 0 }} />
          {!driveConnected ? (
            <button className="btn-sm" onClick={gdriveConnect} title="Conectar ao Google Drive">
              <i className="ti ti-cloud" /> Drive
            </button>
          ) : (
            <>
              <button className="btn-sm" onClick={gdriveConnect} title="Reconectar ao Google Drive">
                <i className="ti ti-check" /> Drive
              </button>
              <button className="btn-sm" onClick={gdriveSave} title="Salvar dados no Google Drive"><i className="ti ti-cloud-upload" /></button>
              <button className="btn-sm" onClick={gdriveLoad} title="Carregar dados do Google Drive"><i className="ti ti-cloud-download" /></button>
              <button className="btn-sm" onClick={gdriveConfigKey} title={coingeckoApiKey ? 'Chave CoinGecko carregada — clique para atualizar' : 'Configurar chave da API CoinGecko'}>
                <i className={coingeckoApiKey ? 'ti ti-key' : 'ti ti-key-off'} />
              </button>
              <button className="btn-sm" onClick={gdriveDisconnect} title="Desconectar e esquecer Client ID"><i className="ti ti-logout" /></button>
            </>
          )}
          <span style={{ fontSize: 11, color: 'var(--text3)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{driveStatus}</span>
        </div>
      </div>

      {/* Nav */}
      <div className="nav">
        {tabs.map(t => (
          <button key={t} className={`nav-btn${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>
            {t === 'wallet' && <><i className="ti ti-wallet" /> <span>Carteira</span></>}
            {t === 'profit' && <><i className="ti ti-trending-up" /> <span>Lucro</span></>}
            {t === 'history' && <><i className="ti ti-receipt" /> <span>Histórico</span></>}
          </button>
        ))}
      </div>

      {/* Tabs */}
      {loading ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <i className="ti ti-loader-2" />
          <span>Carregando sua carteira...</span>
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
              ops={ops} assets={assets} prices={prices} apiKey={coingeckoApiKey}
              onAddOp={handleAddOp} onEditOp={handleEditOp} onRemoveOp={handleRemoveOp}
            />
          )}
        </>
      )}
    </div>
  );
}

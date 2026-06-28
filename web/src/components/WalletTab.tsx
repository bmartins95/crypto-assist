'use client';

import { Asset, AssetWithPlatform, GroupMode, Prices } from '@/lib/types';
import { fmt, fmtPct, fmtQty } from '@/lib/format';
import { computePositionsByAssetAndPlatform } from '@/lib/portfolio';
import { Op } from '@/lib/types';
import { useLocale } from '@/context/LocaleContext';
import { useBalance } from '@/context/BalanceContext';

interface Props {
  ops: Op[];
  assets: Asset[];
  prices: Prices;
  avatarCache: Record<string, { url: string }>;
  groupMode: GroupMode;
  onGroupMode: (m: GroupMode) => void;
  statusMsg: string;
  onFetchPrices: () => void;
  onExitPriceChange: (coinId: string, value: string) => void;
}

function AvatarImg({ coinId, symbol, avatarCache }: { coinId: string; symbol: string; avatarCache: Record<string, { url: string }> }) {
  const url = avatarCache[coinId]?.url;
  return (
    <div className="avatar">
      {url ? <img src={url} alt={symbol} /> : (symbol || '?').slice(0, 3)}
    </div>
  );
}

export default function WalletTab({ ops, assets, prices, avatarCache, groupMode, onGroupMode, statusMsg, onFetchPrices, onExitPriceChange }: Props) {
  const { locale, t } = useLocale();
  const { hidden } = useBalance();
  const mask = (v: string): string => (hidden ? '••••••' : v);
  let totalInv = 0, totalAtual = 0;
  let content: React.ReactNode;

  if (!assets.length) {
    content = (
      <div className="empty-state">
        <i className="ti ti-chart-candle" />
        <span>{t.wallet_emptyState}</span>
      </div>
    );
  } else if (groupMode === 'platform') {
    const byAssetPlat = computePositionsByAssetAndPlatform(ops);
    const platMap: Record<string, AssetWithPlatform[]> = {};
    byAssetPlat.forEach(p => { (platMap[p.platform] ||= []).push(p); });
    const groups = Object.entries(platMap);
    const rows = groups.map(([plat, positions]) => {
      const inv = positions.reduce((s, p) => s + p.qty * p.avgPrice, 0);
      const atual = positions.reduce((s, p) => s + p.qty * (prices[p.coinId] || 0), 0);
      const lucro = atual - inv, pct = inv > 0 ? (lucro / inv) * 100 : 0;
      const hasPrice = positions.some(p => prices[p.coinId] > 0);
      const symbols = [...new Set(positions.map(p => p.symbol))].join(', ');
      totalInv += inv; if (hasPrice) totalAtual += atual;
      return { plat, inv, atual, lucro, pct, hasPrice, symbols };
    });
    content = (
      <div className="table-wrap">
        <table>
          <thead><tr>
            <th>{t.wallet_col_platform}</th><th>{t.wallet_col_asset}</th>
            <th style={{ width: 110 }}>{t.profit_invested}</th>
            <th style={{ width: 110 }}>{t.profit_currentValue}</th>
            <th style={{ width: 120 }}>{t.wallet_col_pnl}</th>
            <th style={{ width: 90 }}>{t.wallet_col_pnlPct}</th>
          </tr></thead>
          <tbody>{rows.map(({ plat, inv, atual, lucro, pct, hasPrice, symbols }) => (
            <tr key={plat || '__none__'}>
              <td style={{ fontWeight: 500 }}>{plat || t.wallet_noPlatform}</td>
              <td style={{ color: 'var(--text2)', fontSize: 12 }}>{symbols}</td>
              <td>{mask(fmt(inv, locale))}</td>
              <td>{hasPrice ? mask(fmt(atual, locale)) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
              <td className={lucro >= 0 ? 'pos' : 'neg'} style={{ fontWeight: 500 }}>{hasPrice ? mask(fmt(lucro, locale)) : '—'}</td>
              <td>{hasPrice ? <span className={`pill ${pct >= 0 ? 'pill-pos' : 'pill-neg'}`}>{fmtPct(pct)}</span> : '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );

  } else if (groupMode === 'both') {
    const positions = computePositionsByAssetAndPlatform(ops);
    const platMap: Record<string, AssetWithPlatform[]> = {};
    positions.forEach(p => { (platMap[p.platform] ||= []).push(p); });
    const tableHeader = (
      <thead><tr>
        <th style={{ width: 170 }}>{t.wallet_col_asset}</th>
        <th style={{ width: 120 }}>{t.wallet_col_currentPrice}</th>
        <th style={{ width: 110 }}>{t.profit_invested}</th>
        <th style={{ width: 110 }}>{t.profit_currentValue}</th>
        <th style={{ width: 120 }}>{t.wallet_col_pnl}</th>
        <th style={{ width: 90 }}>{t.wallet_col_pnlPct}</th>
      </tr></thead>
    );
    content = (
      <>
        {Object.entries(platMap).map(([plat, rows]) => {
          return (
            <div key={plat || '__none__'} style={{ marginBottom: '1rem' }}>
              <div className="topbar-title" style={{ marginBottom: 6, padding: '0 2px' }}>
                <i className="ti ti-building-bank" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 4 }} />
                {plat || t.wallet_noPlatform}
              </div>
              <div className="table-wrap">
                <table>
                  {tableHeader}
                  <tbody>{rows.map(p => {
                    const price = prices[p.coinId] || 0;
                    const inv = p.qty * p.avgPrice, atual = p.qty * price, lucro = atual - inv, pct = inv > 0 ? (lucro / inv) * 100 : 0;
                    totalInv += inv; if (price) totalAtual += atual;
                    return (
                      <tr key={p.coinId + p.platform}>
                        <td><div className="coin-cell">
                          <AvatarImg coinId={p.coinId} symbol={p.symbol} avatarCache={avatarCache} />
                          <div><div className="coin-name">{p.name}</div><div className="coin-sym">{p.symbol} · {mask(fmtQty(p.qty, locale))}</div></div>
                        </div></td>
                        <td style={{ fontWeight: 500 }}>{price ? mask(fmt(price, locale)) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td>{mask(fmt(inv, locale))}</td>
                        <td>{price ? mask(fmt(atual, locale)) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td className={lucro >= 0 ? 'pos' : 'neg'} style={{ fontWeight: 500 }}>{price ? mask(fmt(lucro, locale)) : '—'}</td>
                        <td>{price ? <span className={`pill ${pct >= 0 ? 'pill-pos' : 'pill-neg'}`}>{fmtPct(pct)}</span> : '—'}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            </div>
          );
        })}
      </>
    );

  } else {
    const rows = assets.map(a => {
      const p = prices[a.coinId] || 0;
      const inv = a.qty * a.avgPrice, atual = a.qty * p, lucro = atual - inv, pct = inv > 0 ? (lucro / inv) * 100 : 0;
      totalInv += inv; totalAtual += atual;
      const hasMeta = a.exitPrice > 0;
      const lMeta = hasMeta ? a.qty * a.exitPrice - inv : null;
      const pMeta = hasMeta && inv > 0 ? ((lMeta! / inv) * 100) : null;
      return { a, p, inv, atual, lucro, pct, lMeta, pMeta };
    });
    content = (
      <div className="table-wrap">
        <table>
          <thead><tr>
            <th style={{ width: 170 }}>{t.wallet_col_asset}</th>
            <th style={{ width: 120 }}>{t.wallet_col_currentPrice}</th>
            <th style={{ width: 110 }}>{t.profit_invested}</th>
            <th style={{ width: 110 }}>{t.profit_currentValue}</th>
            <th style={{ width: 120 }}>{t.wallet_col_pnl}</th>
            <th style={{ width: 90 }}>{t.wallet_col_pnlPct}</th>
            <th>{t.wallet_col_exitPrice}</th>
          </tr></thead>
          <tbody>{rows.map(({ a, p, inv, atual, lucro, pct, lMeta, pMeta }) => (
            <tr key={a.coinId}>
              <td><div className="coin-cell">
                <AvatarImg coinId={a.coinId} symbol={a.symbol} avatarCache={avatarCache} />
                <div><div className="coin-name">{a.name}</div><div className="coin-sym">{a.symbol} · {mask(fmtQty(a.qty, locale))}</div></div>
              </div></td>
              <td style={{ fontWeight: 500 }}>{p ? mask(fmt(p, locale)) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
              <td>{mask(fmt(inv, locale))}</td>
              <td>{p ? mask(fmt(atual, locale)) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
              <td className={lucro >= 0 ? 'pos' : 'neg'} style={{ fontWeight: 500 }}>{p ? mask(fmt(lucro, locale)) : '—'}</td>
              <td>{p ? <span className={`pill ${pct >= 0 ? 'pill-pos' : 'pill-neg'}`}>{fmtPct(pct)}</span> : '—'}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number" className="exit-input" placeholder="—" step="any"
                    defaultValue={a.exitPrice || ''}
                    style={{ width: 90 }}
                    onChange={e => onExitPriceChange(a.coinId, e.target.value)}
                  />
                  {lMeta !== null && <span className="pill pill-neu" style={{ fontSize: 11 }}>{fmtPct(pMeta!)}</span>}
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  }

  const inv = totalInv, atual = totalAtual;
  const l = atual - inv, pPct = inv > 0 ? (l / inv) * 100 : 0;

  return (
    <div id="tab-carteira" className="section active">
      <div className="metrics">
        <div className="metric">
          <div className="metric-label"><i className="ti ti-arrow-down-circle" /> {t.profit_invested}</div>
          <div className="metric-value">{mask(fmt(inv, locale))}</div>
        </div>
        <div className="metric">
          <div className="metric-label"><i className="ti ti-coin" /> {t.profit_currentValue}</div>
          <div className="metric-value">{inv && atual ? mask(fmt(atual, locale)) : '—'}</div>
        </div>
        <div className="metric">
          <div className="metric-label"><i className="ti ti-plus-minus" /> {t.profit_pnl}</div>
          <div className={`metric-value ${l >= 0 ? 'pos' : 'neg'}`}>{inv && atual ? mask(fmt(l, locale)) : '—'}</div>
        </div>
        <div className="metric">
          <div className="metric-label"><i className="ti ti-percentage" /> {t.wallet_col_pnlPct}</div>
          <div className={`metric-value ${pPct >= 0 ? 'pos' : 'neg'}`}>{inv && atual ? fmtPct(pPct) : '—'}</div>
        </div>
      </div>
      <div className="topbar">
        <div className="chart-switcher" style={{ marginBottom: 0 }}>
          {(['asset', 'platform', 'both'] as GroupMode[]).map(m => (
            <button
              key={m}
              className={`chart-btn${groupMode === m ? ' active' : ''}`}
              onClick={() => onGroupMode(m)}
            >
              {m === 'asset' && <><i className="ti ti-coins" /> {t.wallet_groupBy_asset}</>}
              {m === 'platform' && <><i className="ti ti-building-bank" /> {t.wallet_groupBy_platform}</>}
              {m === 'both' && <><i className="ti ti-layout-grid" /> {t.wallet_groupBy_both}</>}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="status">{statusMsg}</span>
          <button className="btn-sm" onClick={onFetchPrices}><i className="ti ti-refresh" /> {t.wallet_updatePrices}</button>
        </div>
      </div>
      <div id="table-wrap">{content}</div>
    </div>
  );
}

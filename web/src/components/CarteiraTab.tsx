'use client';

import { Asset, AssetWithPlatform, GroupMode, Prices } from '@/lib/types';
import { fmt, fmtPct, fmtQtd } from '@/lib/format';
import { storage } from '@/lib/storage';
import { computePositionsByAssetAndPlatform } from '@/lib/portfolio';
import { Op } from '@/lib/types';

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

function Metrics({ inv, atual }: { inv: number; atual: number }) {
  const l = atual - inv, p = inv > 0 ? (l / inv) * 100 : 0;
  return (
    <div className="metrics">
      <div className="metric">
        <div className="metric-label"><i className="ti ti-arrow-down-circle" /> Investido</div>
        <div className="metric-value">{fmt(inv)}</div>
      </div>
      <div className="metric">
        <div className="metric-label"><i className="ti ti-coin" /> Valor atual</div>
        <div className="metric-value">{inv && atual ? fmt(atual) : '—'}</div>
      </div>
      <div className="metric">
        <div className="metric-label"><i className="ti ti-plus-minus" /> Lucro / Prej.</div>
        <div className={`metric-value ${l >= 0 ? 'pos' : 'neg'}`}>{inv && atual ? fmt(l) : '—'}</div>
      </div>
      <div className="metric">
        <div className="metric-label"><i className="ti ti-percentage" /> Retorno</div>
        <div className={`metric-value ${p >= 0 ? 'pos' : 'neg'}`}>{inv && atual ? fmtPct(p) : '—'}</div>
      </div>
    </div>
  );
}

function AvatarImg({ coinId, symbol, avatarCache }: { coinId: string; symbol: string; avatarCache: Record<string, { url: string }> }) {
  const url = avatarCache[coinId]?.url;
  return (
    <div className="avatar">
      {url ? <img src={url} alt={symbol} /> : (symbol || '?').slice(0, 3)}
    </div>
  );
}

export default function CarteiraTab({ ops, assets, prices, avatarCache, groupMode, onGroupMode, statusMsg, onFetchPrices, onExitPriceChange }: Props) {
  let totalInv = 0, totalAtual = 0;
  let content: React.ReactNode;

  if (!assets.length) {
    content = (
      <div className="empty-state">
        <i className="ti ti-chart-candle" />
        <span>Registre operações no <strong>Histórico</strong> para ver sua carteira</span>
      </div>
    );
  } else if (groupMode === 'plataforma') {
    const byAssetPlat = computePositionsByAssetAndPlatform(ops);
    const platMap: Record<string, AssetWithPlatform[]> = {};
    byAssetPlat.forEach(p => { (platMap[p.plataforma] ||= []).push(p); });
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
            <th>Plataforma</th><th>Ativos</th>
            <th style={{ width: 110 }}>Investido</th>
            <th style={{ width: 110 }}>Valor atual</th>
            <th style={{ width: 120 }}>Lucro / Prej.</th>
            <th style={{ width: 90 }}>Retorno</th>
          </tr></thead>
          <tbody>{rows.map(({ plat, inv, atual, lucro, pct, hasPrice, symbols }) => (
            <tr key={plat}>
              <td style={{ fontWeight: 500 }}>{plat}</td>
              <td style={{ color: 'var(--text2)', fontSize: 12 }}>{symbols}</td>
              <td>{fmt(inv)}</td>
              <td>{hasPrice ? fmt(atual) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
              <td className={lucro >= 0 ? 'pos' : 'neg'} style={{ fontWeight: 500 }}>{hasPrice ? fmt(lucro) : '—'}</td>
              <td>{hasPrice ? <span className={`pill ${pct >= 0 ? 'pill-pos' : 'pill-neg'}`}>{fmtPct(pct)}</span> : '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );

  } else if (groupMode === 'ambos') {
    const positions = computePositionsByAssetAndPlatform(ops);
    const platMap: Record<string, AssetWithPlatform[]> = {};
    positions.forEach(p => { (platMap[p.plataforma] ||= []).push(p); });
    const tableHeader = (
      <thead><tr>
        <th style={{ width: 170 }}>Ativo</th>
        <th style={{ width: 120 }}>Preço atual</th>
        <th style={{ width: 110 }}>Investido</th>
        <th style={{ width: 110 }}>Valor atual</th>
        <th style={{ width: 120 }}>Lucro / Prej.</th>
        <th style={{ width: 90 }}>Retorno</th>
      </tr></thead>
    );
    content = (
      <>
        {Object.entries(platMap).map(([plat, rows]) => {
          return (
            <div key={plat} style={{ marginBottom: '1rem' }}>
              <div className="topbar-title" style={{ marginBottom: 6, padding: '0 2px' }}>
                <i className="ti ti-building-bank" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 4 }} />
                {plat}
              </div>
              <div className="table-wrap">
                <table>
                  {tableHeader}
                  <tbody>{rows.map(p => {
                    const price = prices[p.coinId] || 0;
                    const inv = p.qty * p.avgPrice, atual = p.qty * price, lucro = atual - inv, pct = inv > 0 ? (lucro / inv) * 100 : 0;
                    totalInv += inv; if (price) totalAtual += atual;
                    return (
                      <tr key={p.coinId + p.plataforma}>
                        <td><div className="coin-cell">
                          <AvatarImg coinId={p.coinId} symbol={p.symbol} avatarCache={avatarCache} />
                          <div><div className="coin-name">{p.name}</div><div className="coin-sym">{p.symbol} · {fmtQtd(p.qty)}</div></div>
                        </div></td>
                        <td style={{ fontWeight: 500 }}>{price ? fmt(price) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td>{fmt(inv)}</td>
                        <td>{price ? fmt(atual) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                        <td className={lucro >= 0 ? 'pos' : 'neg'} style={{ fontWeight: 500 }}>{price ? fmt(lucro) : '—'}</td>
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
    // groupMode === 'ativo'
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
            <th style={{ width: 170 }}>Ativo</th>
            <th style={{ width: 120 }}>Preço atual</th>
            <th style={{ width: 110 }}>Investido</th>
            <th style={{ width: 110 }}>Valor atual</th>
            <th style={{ width: 120 }}>Lucro / Prej.</th>
            <th style={{ width: 90 }}>Retorno</th>
            <th>Meta de saída</th>
          </tr></thead>
          <tbody>{rows.map(({ a, p, inv, atual, lucro, pct, lMeta, pMeta }) => (
            <tr key={a.coinId}>
              <td><div className="coin-cell">
                <AvatarImg coinId={a.coinId} symbol={a.symbol} avatarCache={avatarCache} />
                <div><div className="coin-name">{a.name}</div><div className="coin-sym">{a.symbol} · {fmtQtd(a.qty)}</div></div>
              </div></td>
              <td style={{ fontWeight: 500 }}>{p ? fmt(p) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
              <td>{fmt(inv)}</td>
              <td>{p ? fmt(atual) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
              <td className={lucro >= 0 ? 'pos' : 'neg'} style={{ fontWeight: 500 }}>{p ? fmt(lucro) : '—'}</td>
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

  return (
    <div id="tab-carteira" className="section active">
      <Metrics inv={totalInv} atual={totalAtual} />
      <div className="topbar">
        <div className="chart-switcher" style={{ marginBottom: 0 }}>
          {(['ativo', 'plataforma', 'ambos'] as GroupMode[]).map(m => (
            <button
              key={m}
              className={`chart-btn${groupMode === m ? ' active' : ''}`}
              onClick={() => onGroupMode(m)}
            >
              {m === 'ativo' && <><i className="ti ti-coins" /> Por ativo</>}
              {m === 'plataforma' && <><i className="ti ti-building-bank" /> Por plataforma</>}
              {m === 'ambos' && <><i className="ti ti-layout-grid" /> Ativo + plataforma</>}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="status">{statusMsg}</span>
          <button className="btn-sm" onClick={onFetchPrices}><i className="ti ti-refresh" /> Atualizar preços</button>
        </div>
      </div>
      <div id="table-wrap">{content}</div>
    </div>
  );
}

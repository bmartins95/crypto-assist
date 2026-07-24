'use client';

import { Asset, AssetWithPlatform, GroupMode, Prices, PlatformKind } from '@/lib/types';
import { fmtPct, fmtQty, currencySymbol } from '@/lib/format';
import { computePositionsByAssetAndPlatform } from '@/lib/portfolio';
import { Op, OpClosure } from '@/lib/types';
import { useLocale } from '@/context/LocaleContext';
import { useBalance } from '@/context/BalanceContext';
import { useCurrency } from '@/context/CurrencyContext';
import ContentHeader from '@/components/ContentHeader';
import MetricCard from '@/components/MetricCard';
import PlatformChip from '@/components/platform/PlatformChip';
import PlatformLogo from '@/components/platform/PlatformLogo';
import { usePlatformCatalog } from '@/components/platform/usePlatformCatalog';

interface Props {
  ops: Op[];
  closures: OpClosure[];
  assets: Asset[];
  prices: Prices;
  avatarCache: Record<string, { url: string }>;
  groupMode: GroupMode;
  onGroupMode: (m: GroupMode) => void;
  statusMsg: string;
  onFetchPrices: () => void;
  onExitPriceChange: (coinId: string, value: string) => void;
}

function CoinBadge({ coinId, symbol, avatarCache }: { coinId: string; symbol: string; avatarCache: Record<string, { url: string }> }) {
  const url = avatarCache[coinId]?.url;
  return (
    <div className="coin">
      {url ? <img src={url} alt={symbol} /> : (symbol || '?').slice(0, 3)}
    </div>
  );
}

const CATEGORY_LABEL_KEY: Record<PlatformKind, 'platform_kind_exchange' | 'platform_kind_wallet' | 'platform_kind_defi' | 'platform_kind_custom'> = {
  exchange: 'platform_kind_exchange',
  wallet: 'platform_kind_wallet',
  defi: 'platform_kind_defi',
  custom: 'platform_kind_custom',
};

export default function WalletTab({ ops, closures, assets, prices, avatarCache, groupMode, onGroupMode, statusMsg, onFetchPrices, onExitPriceChange }: Props) {
  const { locale, t } = useLocale();
  const { hidden } = useBalance();
  const { currency, rates, ratesStatus, fmtMoney } = useCurrency();
  const { resolveOpPlatform } = usePlatformCatalog();
  const mask = (v: string): string => (hidden ? '••••••' : v);
  const toDisplay = (usd: number): number => usd * (rates ? rates[currency] : 0);
  const ratesMsg = ratesStatus === 'unavailable' ? t.currency_rates_unavailable
    : ratesStatus === 'stale' ? t.currency_rates_stale : '';
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
    const byAssetPlat = computePositionsByAssetAndPlatform(ops, closures);
    const platMap: Record<string, { platformId: string; platformName: string; positions: AssetWithPlatform[] }> = {};
    byAssetPlat.forEach(p => {
      (platMap[p.platformId] ||= { platformId: p.platformId, platformName: p.platformName, positions: [] }).positions.push(p);
    });
    const rows = Object.values(platMap).map(({ platformId, platformName, positions }) => {
      const inv = positions.reduce((s, p) => s + p.qty * p.avgPrice, 0);
      const atual = positions.reduce((s, p) => s + p.qty * (prices[p.coinId] || 0), 0);
      const lucro = atual - inv, pct = inv > 0 ? (lucro / inv) * 100 : 0;
      const hasPrice = positions.some(p => prices[p.coinId] > 0);
      const symbols = [...new Set(positions.map(p => p.symbol))].join(', ');
      totalInv += inv; if (hasPrice) totalAtual += atual;
      const platform = resolveOpPlatform(platformId, platformName);
      return { platform, inv, atual, lucro, pct, hasPrice, symbols };
    });
    content = (
      <div className="tbl scroll">
        <table>
          <thead><tr>
            <th>{t.wallet_col_platform}</th><th>{t.wallet_col_asset}</th>
            <th className="num">{t.profit_invested}</th>
            <th className="num">{t.profit_currentValue}</th>
            <th className="num">{t.wallet_col_pnl}</th>
            <th className="num">{t.wallet_col_pnlPct}</th>
          </tr></thead>
          <tbody>{rows.map(({ platform, inv, atual, lucro, pct, hasPrice, symbols }) => (
            <tr key={platform?.id || '__none__'}>
              <td>{platform ? <PlatformChip platform={platform} size="md" bold /> : <span style={{ fontWeight: 500 }}>{t.wallet_noPlatform}</span>}</td>
              <td style={{ color: 'var(--s-text-dim)', fontSize: 12 }}>{symbols}</td>
              <td className="num">{mask(fmtMoney(inv))}</td>
              <td className="num">{hasPrice ? mask(fmtMoney(atual)) : <span className="muted">—</span>}</td>
              <td className={`num ${lucro >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 500 }}>{hasPrice ? mask(fmtMoney(lucro)) : '—'}</td>
              <td className="num">{hasPrice ? <span className={`pill ${pct >= 0 ? 'up' : 'down'}`}>{fmtPct(pct)}</span> : '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );

  } else if (groupMode === 'both') {
    const positions = computePositionsByAssetAndPlatform(ops, closures);
    const platMap: Record<string, { platformId: string; platformName: string; rows: AssetWithPlatform[] }> = {};
    positions.forEach(p => {
      (platMap[p.platformId] ||= { platformId: p.platformId, platformName: p.platformName, rows: [] }).rows.push(p);
    });
    const tableHeader = (
      <thead><tr>
        <th>{t.wallet_col_asset}</th>
        <th className="num">{t.wallet_col_currentPrice}</th>
        <th className="num">{t.profit_invested}</th>
        <th className="num">{t.profit_currentValue}</th>
        <th className="num">{t.wallet_col_pnl}</th>
        <th className="num">{t.wallet_col_pnlPct}</th>
      </tr></thead>
    );
    content = (
      <>
        {Object.values(platMap).map(({ platformId, platformName, rows }) => {
          const platform = resolveOpPlatform(platformId, platformName);
          let groupInv = 0, groupAtual = 0;
          rows.forEach(p => { const price = prices[p.coinId] || 0; groupInv += p.qty * p.avgPrice; if (price) groupAtual += p.qty * price; });
          const groupHasPrice = rows.some(p => prices[p.coinId] > 0);
          const groupPct = groupInv > 0 ? ((groupAtual - groupInv) / groupInv) * 100 : 0;
          return (
            <div key={platformId || '__none__'} style={{ marginBottom: '1rem' }}>
              <div className="grp-hd">
                {platform && <PlatformLogo platform={platform} size="md" />}
                <span className="gname">{platform ? platform.name : t.wallet_noPlatform}</span>
                {platform && <span className={`cat ${platform.kind}`}>{t[CATEGORY_LABEL_KEY[platform.kind]]}</span>}
                {groupHasPrice && (
                  <span className="gsum">
                    {mask(fmtMoney(groupAtual))} · <span className={groupPct >= 0 ? 'pos' : 'neg'}>{fmtPct(groupPct)}</span>
                  </span>
                )}
              </div>
              <div className="tbl scroll">
                <table>
                  {tableHeader}
                  <tbody>{rows.map(p => {
                    const price = prices[p.coinId] || 0;
                    const inv = p.qty * p.avgPrice, atual = p.qty * price, lucro = atual - inv, pct = inv > 0 ? (lucro / inv) * 100 : 0;
                    totalInv += inv; if (price) totalAtual += atual;
                    return (
                      <tr key={p.coinId + p.platformId}>
                        <td><div className="asset">
                          <CoinBadge coinId={p.coinId} symbol={p.symbol} avatarCache={avatarCache} />
                          <div><div className="nm">{p.name}</div><div className="tk">{p.symbol} · {mask(fmtQty(p.qty, locale))}</div></div>
                        </div></td>
                        <td className="num" style={{ fontWeight: 500 }}>{price ? mask(fmtMoney(price)) : <span className="muted">—</span>}</td>
                        <td className="num">{mask(fmtMoney(inv))}</td>
                        <td className="num">{price ? mask(fmtMoney(atual)) : <span className="muted">—</span>}</td>
                        <td className={`num ${lucro >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 500 }}>{price ? mask(fmtMoney(lucro)) : '—'}</td>
                        <td className="num">{price ? <span className={`pill ${pct >= 0 ? 'up' : 'down'}`}>{fmtPct(pct)}</span> : '—'}</td>
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
      // Exit targets are typed by the user in the display currency, so the
      // comparison base is the invested amount converted to display space.
      const lMeta = hasMeta ? a.qty * a.exitPrice - toDisplay(inv) : null;
      const pMeta = hasMeta && toDisplay(inv) > 0 ? ((lMeta! / toDisplay(inv)) * 100) : null;
      return { a, p, inv, atual, lucro, pct, lMeta, pMeta };
    });
    content = (
      <div className="tbl scroll">
        <table>
          <thead><tr>
            <th>{t.wallet_col_asset}</th>
            <th className="num">{t.wallet_col_currentPrice}</th>
            <th className="num">{t.profit_invested}</th>
            <th className="num">{t.profit_currentValue}</th>
            <th className="num">{t.wallet_col_pnl}</th>
            <th className="num">{t.wallet_col_pnlPct}</th>
            <th>{t.wallet_col_exitPrice}</th>
          </tr></thead>
          <tbody>{rows.map(({ a, p, inv, atual, lucro, pct, lMeta, pMeta }) => (
            <tr key={a.coinId}>
              <td><div className="asset">
                <CoinBadge coinId={a.coinId} symbol={a.symbol} avatarCache={avatarCache} />
                <div><div className="nm">{a.name}</div><div className="tk">{a.symbol} · {mask(fmtQty(a.qty, locale))}</div></div>
              </div></td>
              <td className="num" style={{ fontWeight: 500 }}>{p ? mask(fmtMoney(p)) : <span className="muted">—</span>}</td>
              <td className="num">{mask(fmtMoney(inv))}</td>
              <td className="num">{p ? mask(fmtMoney(atual)) : <span className="muted">—</span>}</td>
              <td className={`num ${lucro >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 500 }}>{p ? mask(fmtMoney(lucro)) : '—'}</td>
              <td className="num">{p ? <span className={`pill ${pct >= 0 ? 'up' : 'down'}`}>{fmtPct(pct)}</span> : '—'}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Kept as a plain uncontrolled input (not MoneyField/NumericField, both
                      controlled-only) — onExitPriceChange awaits a network round trip on every
                      keystroke, so binding `value` to the not-yet-updated exitPrice prop would
                      fight the user mid-type. Still shows the live currency symbol so a typed
                      target isn't silently mislabeled after a currency switch. */}
                  <span style={{ fontSize: 12, color: 'var(--s-text-dim)' }}>{currencySymbol(currency, locale)}</span>
                  <input
                    type="number" className="exit-input" placeholder="—" step="any"
                    defaultValue={a.exitPrice || ''}
                    style={{ width: 90 }}
                    aria-label={t.wallet_col_exitPrice}
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
  const hasPrices = inv > 0 && atual > 0;

  return (
    <div id="tab-carteira" className="section active">
      <ContentHeader title={t.nav_wallet} subtitle={`${t.wallet_subtitle} · ${currency}`}>
        {ratesMsg && <span className="ts neg">{ratesMsg}</span>}
        <span className="ts">{statusMsg}</span>
        <button className="btn" onClick={onFetchPrices}>
          <i className="ti ti-refresh" /> {t.wallet_updatePrices}
        </button>
      </ContentHeader>

      {assets.length > 0 && (
        <div className="metrics">
          <MetricCard label={t.profit_invested} value={mask(fmtMoney(inv))} />
          <MetricCard label={t.profit_currentValue} value={hasPrices ? mask(fmtMoney(atual)) : '—'} />
          <MetricCard
            label={t.profit_pnl}
            value={hasPrices ? mask(fmtMoney(l)) : '—'}
            valueColor={hasPrices ? (l >= 0 ? 'pos' : 'neg') : undefined}
          />
          <MetricCard
            label={t.wallet_col_pnlPct}
            value={hasPrices ? fmtPct(pPct) : '—'}
            valueColor={hasPrices ? (pPct >= 0 ? 'pos' : 'neg') : undefined}
          />
        </div>
      )}

      {assets.length > 0 && (
        <div className="chart-switcher">
          {(['asset', 'platform', 'both'] as GroupMode[]).map(m => (
            <button
              key={m}
              className={`chart-btn${groupMode === m ? ' active' : ''}`}
              onClick={() => onGroupMode(m)}
            >
              {m === 'asset' && t.wallet_groupBy_asset}
              {m === 'platform' && t.wallet_groupBy_platform}
              {m === 'both' && t.wallet_groupBy_both}
            </button>
          ))}
        </div>
      )}

      <div id="table-wrap">{content}</div>
    </div>
  );
}

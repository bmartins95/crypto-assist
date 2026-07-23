import { useId, useState } from 'react';
import { useLocale } from '@/context/LocaleContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useBalance } from '@/context/BalanceContext';
import { fmtPct } from '@/lib/format';

export interface AssetListItem {
  coinId: string;
  symbol: string;
  name: string;
  price: number;
  pctChange: number;
  series: number[];
  color: string;
  allocationPct: number;
}

type SortMode = 'movement' | 'alphabetical' | 'allocation';

interface Props {
  assets: AssetListItem[];
  onSelectAsset: (coinId: string) => void;
  dayContribution?: Record<string, string>;
}

function sparklinePath(series: number[], width: number, height: number): string {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  return series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function sortAssets(assets: AssetListItem[], mode: SortMode): AssetListItem[] {
  const sorted = [...assets];
  if (mode === 'alphabetical') return sorted.sort((a, b) => a.symbol.localeCompare(b.symbol));
  if (mode === 'allocation') return sorted.sort((a, b) => b.allocationPct - a.allocationPct);
  return sorted.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
}

export default function AssetsOverTimeList({ assets, onSelectAsset, dayContribution }: Props) {
  const { t } = useLocale();
  const { hidden } = useBalance();
  const { fmtMoney } = useCurrency();
  const searchId = useId();
  const sortId = useId();
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('movement');
  const mask = (v: string): string => (hidden ? '••••••' : v);

  const filtered = assets.filter(a => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
  });
  const rows = sortAssets(filtered, sortMode);

  return (
    <div className="assets-list">
      <div className="assets-list-header">
        <div className="assets-list-search">
          <i className="ti ti-search" />
          <label htmlFor={searchId} className="sr-only">{t.profit_assetsList_searchAriaLabel}</label>
          <input
            id={searchId}
            type="text"
            className="inp"
            placeholder={t.profit_assetsList_searchPlaceholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <label htmlFor={sortId} className="sr-only">{t.profit_assetsList_sortAriaLabel}</label>
        <select id={sortId} className="inp assets-list-sort" value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)}>
          <option value="movement">{t.profit_assetsList_sortMovement}</option>
          <option value="alphabetical">{t.profit_assetsList_sortAlphabetical}</option>
          <option value="allocation">{t.profit_assetsList_sortAllocation}</option>
        </select>
      </div>

      <div className="assets-list-table">
        <div className="assets-list-row assets-list-row--head">
          <span>{t.profit_assetsList_colAsset}</span>
          <span>{t.profit_assetsList_colPeriod}</span>
          <span className="assets-list-num">{t.profit_assetsList_colPrice}</span>
          <span className="assets-list-num">{t.profit_assetsList_colChange}</span>
        </div>
        <div className="assets-list-rows">
          {!rows.length ? (
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <span style={{ fontSize: 12 }}>{t.profit_assetsList_emptySearch}</span>
            </div>
          ) : (
            rows.map(asset => {
              const hasData = asset.series.length >= 2;
              const up = asset.pctChange >= 0;
              const contribution = dayContribution?.[asset.coinId];
              return (
                <button
                  key={asset.coinId}
                  type="button"
                  className={`assets-list-row assets-list-row--body${contribution ? ' assets-list-row--highlighted' : ''}`}
                  onClick={() => onSelectAsset(asset.coinId)}
                  aria-label={`${asset.name} ${asset.symbol}`}
                >
                  <span className="assets-list-asset">
                    <span className="assets-list-badge" style={{ background: `${asset.color}22`, color: asset.color }}>{asset.symbol}</span>
                    <span>{asset.name}</span>
                  </span>
                  <span className="assets-list-spark">
                    {hasData ? (
                      <svg viewBox="0 0 64 24" preserveAspectRatio="none">
                        <path d={sparklinePath(asset.series, 64, 24)} fill="none" stroke={up ? 'var(--success)' : 'var(--danger)'} strokeWidth={1.5} />
                      </svg>
                    ) : (
                      <span className="assets-list-nodata">—</span>
                    )}
                  </span>
                  <span className="assets-list-num">{mask(fmtMoney(asset.price))}</span>
                  {contribution ? (
                    <span className="assets-list-num assets-list-contribution">{contribution}</span>
                  ) : (
                    <span className={`assets-list-num ${hasData ? (up ? 'pos' : 'neg') : ''}`}>
                      {hasData ? fmtPct(asset.pctChange) : '—'}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

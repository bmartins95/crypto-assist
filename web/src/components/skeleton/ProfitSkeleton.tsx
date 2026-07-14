'use client';

import { useLocale } from '@/context/LocaleContext';
import { useCurrency } from '@/context/CurrencyContext';
import { Sk } from './Skeleton';

const DIST_ROWS = 4;

// Mirrors ProfitTab's default (by-asset chart) layout — same card/chart/bar
// wrapper classes and heights (chart-canvas-wrap is a fixed 260px, matched below).
export default function ProfitSkeleton() {
  const { t } = useLocale();
  const { currency } = useCurrency();

  return (
    <div id="tab-lucro" className="section active">
      <div className="chead">
        <div>
          <div className="ct">{t.nav_profit}</div>
          <div className="cs">{t.profit_subtitle} · {currency}</div>
        </div>
        <div className="refresh">
          <button type="button" className="btn" disabled><i className="ti ti-refresh" /> {t.wallet_updatePrices}</button>
        </div>
      </div>

      <div className="metrics" style={{ marginBottom: '1rem' }}>
        {[
          { icon: 'ti ti-check', label: t.profit_realized },
          { icon: 'ti ti-clock', label: t.profit_unrealized },
          { icon: 'ti ti-arrow-up', label: t.profit_bestAsset },
          { icon: 'ti ti-arrow-down', label: t.profit_worstAsset },
        ].map(({ icon, label }) => (
          <div className="metric" key={label}>
            <div className="metric-label"><i className={icon} /> {label}</div>
            <Sk w={80} h={20} />
          </div>
        ))}
      </div>

      <div className="chart-switcher">
        <button type="button" className="chart-btn active" disabled>{t.chart_byAsset}</button>
        <button type="button" className="chart-btn" disabled>{t.chart_overTime}</button>
        <button type="button" className="chart-btn" disabled>{t.chart_value}</button>
      </div>

      <div className="chart-area">
        <div className="sec-title">{t.chart_byAsset}</div>
        <div className="chart-canvas-wrap">
          <Sk w="100%" h={260} radius={8} />
        </div>
      </div>

      <div className="dist-section">
        <div className="sec-title">{t.profit_distribution}</div>
        {Array.from({ length: DIST_ROWS }).map((_, i) => (
          <div className="bar-row" key={i}>
            <div className="bar-header">
              <Sk w={100} h={12} />
              <Sk w={70} h={12} />
            </div>
            <div className="bar-track"><Sk w="100%" h={6} radius={3} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useLocale } from '@/context/LocaleContext';
import { useCurrency } from '@/context/CurrencyContext';
import { Sk } from './Skeleton';

const ROWS = 6;

// Mirrors WalletTab's default (by-asset) layout exactly — same wrapper classes,
// same card/row/column shapes — so nothing shifts once real data swaps in.
export default function WalletSkeleton() {
  const { t } = useLocale();
  const { currency } = useCurrency();

  return (
    <div id="tab-carteira" className="section active">
      <div className="chead">
        <div>
          <div className="ct">{t.nav_wallet}</div>
          <div className="cs">{t.wallet_subtitle} · {currency}</div>
        </div>
        <div className="refresh">
          <button type="button" className="btn" disabled><i className="ti ti-refresh" /> {t.wallet_updatePrices}</button>
        </div>
      </div>

      <div className="metrics">
        {[t.profit_invested, t.profit_currentValue, t.profit_pnl, t.wallet_col_pnlPct].map(label => (
          <div className="metric" key={label}>
            <div className="metric-label">{label}</div>
            <Sk w={92} h={20} />
          </div>
        ))}
      </div>

      <div className="chart-switcher">
        <button type="button" className="chart-btn active" disabled>{t.wallet_groupBy_asset}</button>
        <button type="button" className="chart-btn" disabled>{t.wallet_groupBy_platform}</button>
        <button type="button" className="chart-btn" disabled>{t.wallet_groupBy_both}</button>
      </div>

      <div className="tbl scroll">
        <table>
          <thead>
            <tr>
              <th>{t.wallet_col_asset}</th>
              <th className="num">{t.wallet_col_currentPrice}</th>
              <th className="num">{t.profit_invested}</th>
              <th className="num">{t.profit_currentValue}</th>
              <th className="num">{t.wallet_col_pnl}</th>
              <th className="num">{t.wallet_col_pnlPct}</th>
              <th>{t.wallet_col_exitPrice}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }).map((_, i) => (
              <tr key={i}>
                <td>
                  <div className="asset">
                    <span className="sk" style={{ width: 28, height: 28, borderRadius: '50%', display: 'block', flexShrink: 0 }} />
                    <div>
                      <Sk w={112} h={13} />
                      <div style={{ marginTop: 4 }}><Sk w={64} h={11} /></div>
                    </div>
                  </div>
                </td>
                <td className="num"><Sk w={78} h={13} /></td>
                <td className="num"><Sk w={78} h={13} /></td>
                <td className="num"><Sk w={78} h={13} /></td>
                <td className="num"><Sk w={68} h={13} /></td>
                <td className="num"><Sk w={50} h={20} radius={6} /></td>
                <td><Sk w={80} h={26} radius={6} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

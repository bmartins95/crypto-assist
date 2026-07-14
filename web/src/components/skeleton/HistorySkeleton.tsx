'use client';

import { useLocale } from '@/context/LocaleContext';
import { useCurrency } from '@/context/CurrencyContext';
import { Sk } from './Skeleton';

const ROWS = 8;

// Mirrors HistoryTab's operations table — same wrapper classes and column count,
// so nothing shifts once real operations swap in.
export default function HistorySkeleton() {
  const { t } = useLocale();
  const { currency } = useCurrency();

  return (
    <div id="tab-historico" className="section active">
      <div className="chead">
        <div>
          <div className="ct">{t.nav_history}</div>
          <div className="cs">{t.history_subtitle} · {currency}</div>
        </div>
        <div className="refresh">
          <button type="button" className="btn btn-accent" disabled><i className="ti ti-plus" /> {t.history_form_addOp}</button>
        </div>
      </div>

      <div className="tbl scroll">
        <table>
          <thead>
            <tr>
              <th>{t.history_col_date}</th>
              <th>{t.history_col_asset}</th>
              <th>{t.history_col_type}</th>
              <th className="num">{t.history_col_qty}</th>
              <th className="num">{t.history_col_price}</th>
              <th className="num">{t.history_col_total}</th>
              <th className="num">{t.history_col_fee}</th>
              <th>{t.history_col_platform}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }).map((_, i) => (
              <tr key={i}>
                <td><Sk w={70} h={13} /></td>
                <td><Sk w={50} h={13} /></td>
                <td><Sk w={54} h={20} radius={6} /></td>
                <td className="num"><Sk w={60} h={13} /></td>
                <td className="num"><Sk w={72} h={13} /></td>
                <td className="num"><Sk w={80} h={13} /></td>
                <td className="num"><Sk w={50} h={13} /></td>
                <td><Sk w={70} h={13} /></td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

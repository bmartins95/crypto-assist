'use client';

import { Fragment } from 'react';
import { useLocale } from '@/context/LocaleContext';
import { useCurrency } from '@/context/CurrencyContext';
import { Sk } from './Skeleton';

const COLS = 7;
const DATE_GROUPS = 2;
const ROWS_PER_GROUP = 3;

// Mirrors HistoryTab's current (post day-grouping, wallet-vs-trade refactor) table
// exactly — same 7 columns (asset, type, qty, total, pnl, status, actions) and the
// same date-group header rows — so nothing shifts once real operations swap in.
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
          <button type="button" className="btn btn-accent" disabled><i className="ti ti-plus" /> {t.history_action_moveWallet}</button>
          <button type="button" className="btn btn-outline-accent" disabled><i className="ti ti-bolt" /> {t.history_action_newTrade}</button>
        </div>
      </div>

      <div className="tbl scroll">
        <table>
          <thead>
            <tr>
              <th>{t.history_col_asset}</th>
              <th>{t.history_col_type}</th>
              <th className="num">{t.history_col_qty}</th>
              <th className="num">{t.history_col_total}</th>
              <th className="num">{t.history_col_pnl}</th>
              <th>{t.history_col_status}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: DATE_GROUPS }).map((_, g) => (
              <Fragment key={g}>
                <tr className="history-group-row">
                  <th colSpan={COLS} className="history-group-header" scope="colgroup"><Sk w={90} h={12} /></th>
                </tr>
                {Array.from({ length: ROWS_PER_GROUP }).map((_, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}><Sk w={50} h={13} /></td>
                    <td><Sk w={54} h={20} radius={6} /></td>
                    <td className="num"><Sk w={60} h={13} /></td>
                    <td className="num"><Sk w={80} h={13} /></td>
                    <td className="num"><Sk w={64} h={13} /></td>
                    <td><Sk w={60} h={20} radius={6} /></td>
                    <td></td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

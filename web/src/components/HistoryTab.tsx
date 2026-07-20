'use client';

import { Fragment, useMemo, useState } from 'react';
import { Op, NewOp, OpClosure, Asset, AvatarCache, Prices } from '@/lib/types';
import { fmtQty, fmtDate } from '@/lib/format';
import { computePositionsByAssetAndPlatform, computeOpStatus, realizedPnlFor, hasClosure } from '@/lib/portfolio';
import { useLocale } from '@/context/LocaleContext';
import { useBalance } from '@/context/BalanceContext';
import { useCurrency } from '@/context/CurrencyContext';
import ContentHeader from '@/components/ContentHeader';
import OpDrawer from '@/components/OpDrawer';
import { usePlatformCatalog } from '@/components/platform/usePlatformCatalog';

interface Props {
  ops: Op[];
  assets: Asset[];
  avatarCache: AvatarCache;
  prices: Prices;
  closures: OpClosure[];
  onAddOp: (op: NewOp) => Promise<void>;
  onEditOp: (id: string, op: NewOp) => Promise<void>;
  onRemoveOp: (id: string) => void;
  onCloseOp: (sourceOpId: string, op: NewOp, qtyToClose: number) => Promise<void>;
}

// Ops arrive already ordered by date ascending (backend `ORDER BY date`) — this only
// buckets consecutive/matching dates into groups, it never re-sorts the operations.
function groupOpsByDate(ops: Op[]): { date: string; ops: Op[] }[] {
  const groups: { date: string; ops: Op[] }[] = [];
  for (const op of ops) {
    const last = groups[groups.length - 1];
    if (last && last.date === op.date) last.ops.push(op);
    else groups.push({ date: op.date, ops: [op] });
  }
  return groups;
}

export default function HistoryTab({ ops, assets, avatarCache, prices, closures, onAddOp, onEditOp, onRemoveOp, onCloseOp }: Props) {
  const { locale, t } = useLocale();
  const { hidden } = useBalance();
  const { currency, fmtFromCurrency } = useCurrency();
  const mask = (v: string): string => (hidden ? '••••••' : v);
  const fmtOp = (v: number, o: Op): string => fmtFromCurrency(v, o.currency ?? 'BRL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<Op | undefined>(undefined);
  const [closingOp, setClosingOp] = useState<Op | undefined>(undefined);
  const { resolveOpPlatform } = usePlatformCatalog();

  const platformAssets = useMemo(() => computePositionsByAssetAndPlatform(ops), [ops]);
  const dateGroups = useMemo(() => groupOpsByDate(ops), [ops]);

  const openForNew = () => { setEditingOp(undefined); setClosingOp(undefined); setDrawerOpen(true); };
  const openForEdit = (o: Op) => { setEditingOp(o); setClosingOp(undefined); setDrawerOpen(true); };
  const openForClose = (o: Op) => { setClosingOp(o); setEditingOp(undefined); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditingOp(undefined); setClosingOp(undefined); };

  const handleSubmit = (op: NewOp): Promise<void> => (
    editingOp ? onEditOp(editingOp.id, op) : onAddOp(op)
  );

  const handleSubmitTrade = async (sell: NewOp, buy: NewOp): Promise<void> => {
    await onAddOp(sell);
    await onAddOp(buy);
  };

  const handleSubmitClose = (op: NewOp, qtyToClose: number): Promise<void> => (
    closingOp ? onCloseOp(closingOp.id, op, qtyToClose) : Promise.resolve()
  );

  const handleSubmitTradeClose = async (closingLeg: NewOp, qtyToClose: number, newLeg: NewOp): Promise<void> => {
    if (!closingOp) return;
    await onCloseOp(closingOp.id, closingLeg, qtyToClose);
    await onAddOp(newLeg);
  };

  const statusLabel = (status: 'open' | 'partial' | 'closed'): string => (
    status === 'open' ? t.history_status_open : status === 'partial' ? t.history_status_partial : t.history_status_closed
  );

  return (
    <div id="tab-historico" className="section active">
      <ContentHeader title={t.nav_history} subtitle={`${t.history_subtitle} · ${currency}`}>
        <button type="button" className="btn btn-accent" onClick={openForNew}>
          <i className="ti ti-plus" /> {t.history_form_addOp}
        </button>
      </ContentHeader>

      {!ops.length ? (
        <div className="empty-state"><i className="ti ti-receipt" /><span>{t.history_emptyState}</span></div>
      ) : (
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
                <th>{t.history_col_status}</th>
                <th className="num">{t.history_col_pnl}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dateGroups.map(group => (
                <Fragment key={group.date}>
                  <tr className="history-group-row">
                    <th colSpan={11} className="history-group-header" scope="colgroup">{fmtDate(group.date, locale)}</th>
                  </tr>
                  {group.ops.map(o => {
                    const platform = resolveOpPlatform(o.platformId, o.platformName);
                    const status = computeOpStatus(o, closures);
                    const pnl = hasClosure(o.id, closures) ? realizedPnlFor(o.id, closures) : null;
                    return (
                      <tr key={o.id}>
                        <td style={{ color: 'var(--s-text-dim)' }}>{fmtDate(o.date, locale)}</td>
                        <td style={{ fontWeight: 600 }}>{o.symbol || '—'}</td>
                        <td>
                          <span className={`tag ${o.type === 'Buy' ? 'buy' : 'sell'}`}>{o.type === 'Buy' ? t.history_opType_buy : t.history_opType_sell}</span>
                          {o.leverage && <span className="lev-badge">{o.leverage}x</span>}
                        </td>
                        <td className="num">{mask(fmtQty(o.qty, locale))}</td>
                        <td className="num">{mask(fmtOp(o.price, o))}</td>
                        <td className="num" style={{ fontWeight: 600 }}>{mask(fmtOp(o.total, o))}</td>
                        <td className="num" style={{ color: 'var(--s-text-dim)' }}>{o.fee > 0 ? mask(fmtOp(o.fee, o)) : '—'}</td>
                        <td style={{ color: 'var(--s-text-dim)' }}>{platform ? platform.name : '—'}</td>
                        <td><span className={`status-chip ${status}`}>{statusLabel(status)}</span></td>
                        <td className="num">
                          {pnl === null ? <span style={{ color: 'var(--s-text-dim)' }}>—</span> : (
                            <span className={pnl >= 0 ? 'pnl-pos' : 'pnl-neg'}>{mask(fmtOp(pnl, o))}</span>
                          )}
                        </td>
                        <td className="num">
                          <span className="op-actions">
                            {status !== 'closed' && (
                              <button className="icon-btn" onClick={() => openForClose(o)} title={t.history_action_close} aria-label={t.history_action_close} style={{ color: 'var(--accent)' }}><i className="ti ti-circle-check" /></button>
                            )}
                            <button className="icon-btn" onClick={() => openForEdit(o)} title={t.history_form_editOp}><i className="ti ti-pencil" /></button>
                            <button className="icon-btn" onClick={() => onRemoveOp(o.id)} title={t.history_form_delete} style={{ color: 'var(--danger)' }}><i className="ti ti-trash" /></button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OpDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        onSubmit={handleSubmit}
        onSubmitTrade={handleSubmitTrade}
        onSubmitClose={handleSubmitClose}
        onSubmitTradeClose={handleSubmitTradeClose}
        editingOp={editingOp}
        closingOp={closingOp}
        closures={closures}
        assets={assets}
        platformAssets={platformAssets}
        avatarCache={avatarCache}
        prices={prices}
      />
    </div>
  );
}

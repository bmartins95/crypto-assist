'use client';

import { Fragment, useMemo, useState } from 'react';
import { Op, NewOp, OpClosure, Asset, AvatarCache, Prices } from '@/lib/types';
import { fmtQty, fmtDate } from '@/lib/format';
import { computePositionsByAssetAndPlatform, computeOpStatus, realizedPnlForSource, isClosedSource } from '@/lib/portfolio';
import { useLocale } from '@/context/LocaleContext';
import { useBalance } from '@/context/BalanceContext';
import { useCurrency } from '@/context/CurrencyContext';
import ContentHeader from '@/components/ContentHeader';
import OpDrawer from '@/components/OpDrawer';
import Toast, { ToastKind } from '@/components/Toast';
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

const DETAIL_COL_SPAN = 7;

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
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null);
  const { resolveOpPlatform } = usePlatformCatalog();

  const platformAssets = useMemo(() => computePositionsByAssetAndPlatform(ops, closures), [ops, closures]);
  const dateGroups = useMemo(() => groupOpsByDate(ops), [ops]);

  const toggleExpand = (id: string) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

  const openForNew = () => { setEditingOp(undefined); setClosingOp(undefined); setDrawerOpen(true); };
  const openForEdit = (o: Op) => { setEditingOp(o); setClosingOp(undefined); setDrawerOpen(true); };
  const openForClose = (o: Op) => { setClosingOp(o); setEditingOp(undefined); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditingOp(undefined); setClosingOp(undefined); };

  const handleSubmit = (op: NewOp): Promise<void> => (
    editingOp ? onEditOp(editingOp.id, op) : onAddOp(op)
  );

  const handleSubmitTrade = async (sell: NewOp, buy: NewOp): Promise<void> => {
    const tradeGroupId = crypto.randomUUID();
    await onAddOp({ ...sell, tradeGroupId });
    await onAddOp({ ...buy, tradeGroupId });
  };

  const handleSubmitClose = async (op: NewOp, qtyToClose: number): Promise<void> => {
    if (!closingOp) return;
    await onCloseOp(closingOp.id, op, qtyToClose);
    setToast({ kind: 'success', message: t.history_close_success });
  };

  const handleSubmitTradeClose = async (closingLeg: NewOp, qtyToClose: number, newLeg: NewOp): Promise<void> => {
    if (!closingOp) return;
    // The closing leg and the received leg are one trade — a shared group id lets
    // deleting either one undo the whole trade and revert the closed position.
    const tradeGroupId = crypto.randomUUID();
    await onCloseOp(closingOp.id, { ...closingLeg, tradeGroupId }, qtyToClose);
    await onAddOp({ ...newLeg, tradeGroupId });
    setToast({ kind: 'success', message: t.history_close_success });
  };

  const statusLabel = (status: 'open' | 'partial' | 'closed'): string => (
    status === 'open' ? t.history_status_open : status === 'partial' ? t.history_status_partial : t.history_status_closed
  );

  // Stops a row-action click (close/edit/delete) from also toggling the row's expansion.
  const stopAnd = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };

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
              {dateGroups.map(group => (
                <Fragment key={group.date}>
                  <tr className="history-group-row">
                    <th colSpan={DETAIL_COL_SPAN} className="history-group-header" scope="colgroup">{fmtDate(group.date, locale)}</th>
                  </tr>
                  {group.ops.map(o => {
                    const platform = resolveOpPlatform(o.platformId, o.platformName);
                    const status = computeOpStatus(o, closures, ops);
                    const pnl = isClosedSource(o.id, closures) ? realizedPnlForSource(o.id, closures) : null;
                    const expanded = !!expandedRows[o.id];
                    return (
                      <Fragment key={o.id}>
                        <tr className="history-row" onClick={() => toggleExpand(o.id)}>
                          <td style={{ fontWeight: 600 }}>{o.symbol || '—'}</td>
                          <td>
                            <span className={`tag ${o.type === 'Buy' ? 'buy' : 'sell'}`}>{o.type === 'Buy' ? t.history_opType_buy : t.history_opType_sell}</span>
                            {o.leverage && <span className="lev-badge">{o.leverage}x</span>}
                          </td>
                          <td className="num">{mask(fmtQty(o.qty, locale))}</td>
                          <td className="num" style={{ fontWeight: 600 }}>{mask(fmtOp(o.total, o))}</td>
                          <td className="num">
                            {pnl === null ? <span style={{ color: 'var(--s-text-dim)' }}>—</span> : (
                              <span className={pnl >= 0 ? 'pnl-pos' : 'pnl-neg'}>{mask(fmtOp(pnl, o))}</span>
                            )}
                          </td>
                          <td><span className={`status-chip ${status}`}>{statusLabel(status)}</span></td>
                          <td className="num">
                            <span className="op-actions">
                              {status !== 'closed' && (
                                <button className="icon-btn" onClick={stopAnd(() => openForClose(o))} title={t.history_action_close} aria-label={t.history_action_close} style={{ color: 'var(--s-accent)' }}><i className="ti ti-circle-check" /></button>
                              )}
                              <button className="icon-btn" onClick={stopAnd(() => openForEdit(o))} title={t.history_form_editOp}><i className="ti ti-pencil" /></button>
                              <button className="icon-btn" onClick={stopAnd(() => onRemoveOp(o.id))} title={t.history_form_delete} style={{ color: 'var(--danger)' }}><i className="ti ti-trash" /></button>
                              <span className="history-chevron" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}><i className="ti ti-chevron-down" /></span>
                            </span>
                          </td>
                        </tr>
                        <tr className="history-detail-row">
                          <td colSpan={DETAIL_COL_SPAN} className="history-detail-cell">
                            <div className={`history-detail${expanded ? ' expanded' : ''}`}>
                              <div className="history-detail-grid">
                                <div>
                                  <span className="history-detail-label">{t.history_col_price}</span>
                                  <span>{mask(fmtOp(o.price, o))}</span>
                                </div>
                                <div>
                                  <span className="history-detail-label">{t.history_col_fee}</span>
                                  <span>{o.fee > 0 ? mask(fmtOp(o.fee, o)) : '—'}</span>
                                </div>
                                <div>
                                  <span className="history-detail-label">{t.history_col_platform}</span>
                                  <span>{platform ? platform.name : '—'}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </Fragment>
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

      {toast && (
        <Toast kind={toast.kind} message={toast.message} onDismiss={() => setToast(null)} closeLabel={t.common_close} />
      )}
    </div>
  );
}

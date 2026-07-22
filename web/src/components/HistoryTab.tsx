'use client';

import { Fragment, useMemo, useState } from 'react';
import { Op, NewOp, OpClosure, Asset, AvatarCache, Prices } from '@/lib/types';
import { fmtQty, fmtDate } from '@/lib/format';
import { computePositionsByAssetAndPlatform, computeOpStatus, realizedPnlForSource, isClosedSource, computeWalletRealizedPnl, computeWalletEditImpact, computeCycles } from '@/lib/portfolio';
import { useLocale } from '@/context/LocaleContext';
import { useBalance } from '@/context/BalanceContext';
import { useCurrency } from '@/context/CurrencyContext';
import ContentHeader from '@/components/ContentHeader';
import OpDrawer from '@/components/OpDrawer';
import ConfirmDialog from '@/components/ConfirmDialog';
import CyclePopover from '@/components/CyclePopover';
import { useToast } from '@/context/ToastContext';
import { usePlatformCatalog } from '@/components/platform/usePlatformCatalog';

interface Props {
  ops: Op[];
  assets: Asset[];
  avatarCache: AvatarCache;
  prices: Prices;
  closures: OpClosure[];
  onAddOp: (op: NewOp) => Promise<void>;
  onEditOp: (id: string, op: NewOp) => Promise<void>;
  onRemoveOp: (id: string) => Promise<void>;
  onCloseOp: (sourceOpId: string, op: NewOp, qtyToClose: number) => Promise<void>;
}

const DETAIL_COL_SPAN = 7;

interface SwapPair { sell: Op; buy: Op }
type HistoryRow = Op | SwapPair;

function isSwapPair(row: HistoryRow): row is SwapPair {
  return 'sell' in row;
}

// A wallet Swap is two ops (a Sell + a Buy) sharing a tradeGroupId — collapses them
// into a single display row (spec FR-010). Trade ops never share a tradeGroupId (a
// trade close is always a single plain Buy/Sell), so this only ever pairs wallet ops.
function pairSwaps(ops: Op[]): HistoryRow[] {
  const byGroup = new Map<string, Op[]>();
  for (const op of ops) {
    if (!op.tradeGroupId || (op.kind ?? 'wallet') !== 'wallet') continue;
    if (!byGroup.has(op.tradeGroupId)) byGroup.set(op.tradeGroupId, []);
    byGroup.get(op.tradeGroupId)?.push(op);
  }
  const consumed = new Set<string>();
  const rows: HistoryRow[] = [];
  for (const op of ops) {
    if (consumed.has(op.id)) continue;
    const pair = op.tradeGroupId ? byGroup.get(op.tradeGroupId) : undefined;
    const sell = pair?.find(o => o.type === 'Sell');
    const buy = pair?.find(o => o.type === 'Buy');
    if (pair && pair.length === 2 && sell && buy) {
      consumed.add(sell.id);
      consumed.add(buy.id);
      rows.push({ sell, buy });
      continue;
    }
    consumed.add(op.id);
    rows.push(op);
  }
  return rows;
}

// A freshly-added op is always appended to the end of `ops` (see AppLayout's
// addOp/editOp/closeOp) regardless of its own `date` — the backend's own
// `ORDER BY date` only holds for the initial fetch, not for the client-side
// array afterward. So this buckets by date value (a same-date op anywhere in
// the array joins its group, not just an immediately preceding entry), then
// sorts the groups chronologically — grouping is never a function of array
// position/insertion order, only of each op's own `date`.
function groupOpsByDate(ops: Op[]): { date: string; rows: HistoryRow[] }[] {
  const byDate = new Map<string, Op[]>();
  for (const op of ops) {
    if (!byDate.has(op.date)) byDate.set(op.date, []);
    byDate.get(op.date)!.push(op);
  }
  return [...byDate.keys()].sort().map(date => ({ date, rows: pairSwaps(byDate.get(date)!) }));
}

export default function HistoryTab({ ops, assets, avatarCache, prices, closures, onAddOp, onEditOp, onRemoveOp, onCloseOp }: Props) {
  const { locale, t } = useLocale();
  const { hidden } = useBalance();
  const { currency, fmtFromCurrency } = useCurrency();
  const { showToast } = useToast();
  const mask = (v: string): string => (hidden ? '••••••' : v);
  const fmtOp = (v: number, o: Op): string => fmtFromCurrency(v, o.currency ?? 'BRL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<Op | undefined>(undefined);
  const [closingOp, setClosingOp] = useState<Op | undefined>(undefined);
  const [newOpKind, setNewOpKind] = useState<'wallet' | 'trade'>('wallet');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [pendingAction, setPendingAction] = useState<
    | { kind: 'edit'; id: string; op: NewOp; affectedCount: number }
    | { kind: 'delete'; id: string; affectedCount: number }
    | null
  >(null);
  const { resolveOpPlatform } = usePlatformCatalog();

  const platformAssets = useMemo(() => computePositionsByAssetAndPlatform(ops, closures), [ops, closures]);
  const dateGroups = useMemo(() => groupOpsByDate(ops), [ops]);
  const cycles = useMemo(() => computeCycles(ops, closures), [ops, closures]);

  const toggleExpand = (id: string) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

  const openForWallet = () => { setNewOpKind('wallet'); setEditingOp(undefined); setClosingOp(undefined); setDrawerOpen(true); };
  const openForTrade = () => { setNewOpKind('trade'); setEditingOp(undefined); setClosingOp(undefined); setDrawerOpen(true); };
  const openForEdit = (o: Op) => { setEditingOp(o); setClosingOp(undefined); setDrawerOpen(true); };
  const openForClose = (o: Op) => { setClosingOp(o); setEditingOp(undefined); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditingOp(undefined); setClosingOp(undefined); };

  // A wallet op's FIFO-derived balance/cost depends on the chronological order of its
  // asset+platform+currency siblings — editing or deleting one can change what later
  // wallet ops mean (spec FR-020, FR-021). Confirms when later ops are affected; blocks
  // outright when the change would leave a negative balance at any point.
  const checkWalletImpact = (id: string, proposed: Op | null): { verdict: 'proceed' | 'blocked' | 'confirm'; affectedCount: number } => {
    const target = ops.find(o => o.id === id);
    if (!target || (target.kind ?? 'wallet') !== 'wallet') return { verdict: 'proceed', affectedCount: 0 };
    const { affectedCount, firstNegativeBalanceDate } = computeWalletEditImpact(ops, id, proposed);
    if (firstNegativeBalanceDate) return { verdict: 'blocked', affectedCount };
    if (affectedCount > 0) return { verdict: 'confirm', affectedCount };
    return { verdict: 'proceed', affectedCount };
  };

  const handleSubmit = async (op: NewOp): Promise<void> => {
    if (editingOp) {
      const proposed: Op = { ...editingOp, ...op };
      const { verdict, affectedCount } = checkWalletImpact(editingOp.id, proposed);
      if (verdict === 'blocked') { showToast('error', t.history_negative_balance_error); return; }
      if (verdict === 'confirm') { setPendingAction({ kind: 'edit', id: editingOp.id, op, affectedCount }); return; }
      await onEditOp(editingOp.id, op);
      showToast('success', t.history_edit_success);
      return;
    }
    await onAddOp(op);
    showToast('success', t.history_add_success);
  };

  const handleSubmitTrade = async (sell: NewOp, buy: NewOp): Promise<void> => {
    const tradeGroupId = crypto.randomUUID();
    // onAddOp rejecting here (e.g. the sell leg has insufficient balance) must stop
    // this function before the second leg is attempted — otherwise a failed swap could
    // still leave an orphaned single-leg buy with a tradeGroupId that has no matching
    // sell. The rejection propagates to OpDrawer's own try/catch around this call.
    await onAddOp({ ...sell, tradeGroupId });
    await onAddOp({ ...buy, tradeGroupId });
    showToast('success', t.history_add_success);
  };

  const handleSubmitClose = async (op: NewOp, qtyToClose: number): Promise<void> => {
    if (!closingOp) return;
    await onCloseOp(closingOp.id, op, qtyToClose);
    showToast('success', t.history_close_success);
  };

  const requestRemove = (o: Op) => {
    const { verdict, affectedCount } = checkWalletImpact(o.id, null);
    if (verdict === 'blocked') { showToast('error', t.history_negative_balance_error); return; }
    if (verdict === 'confirm') { setPendingAction({ kind: 'delete', id: o.id, affectedCount }); return; }
    // AppLayout's removeOp already shows its own error toast on failure — this only
    // exists so a rejection here doesn't surface as an unhandled promise rejection.
    onRemoveOp(o.id).catch(() => {});
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    try {
      if (pendingAction.kind === 'edit') {
        await onEditOp(pendingAction.id, pendingAction.op);
        showToast('success', t.history_edit_success);
      } else {
        await onRemoveOp(pendingAction.id);
      }
    } catch {
      // AppLayout's onEditOp/onRemoveOp already shows its own error toast on failure.
    }
    setPendingAction(null);
  };

  const statusLabel = (status: 'open' | 'partial' | 'closed'): string => (
    status === 'open' ? t.history_status_open : status === 'partial' ? t.history_status_partial : t.history_status_closed
  );

  // Stops a row-action click (close/edit/delete) from also toggling the row's expansion.
  const stopAnd = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };

  const renderWalletRow = (o: Op, expanded: boolean) => {
    const platform = resolveOpPlatform(o.platformId, o.platformName);
    const pnl = o.type === 'Sell' ? computeWalletRealizedPnl(o, ops) : null;
    return (
      <Fragment key={o.id}>
        <tr className="history-row" onClick={() => toggleExpand(o.id)}>
          <td style={{ fontWeight: 600 }}>{o.symbol || '—'}</td>
          <td>
            <span className={`tag ${o.type === 'Buy' ? 'buy' : 'sell'}`}>{o.type === 'Buy' ? t.history_opType_buy : t.history_opType_sell}</span>
          </td>
          <td className="num">{mask(fmtQty(o.qty, locale))}</td>
          <td className="num" style={{ fontWeight: 600 }}>{mask(fmtOp(o.total, o))}</td>
          <td className="num">
            {pnl === null ? <span style={{ color: 'var(--s-text-dim)' }}>—</span> : (
              <span className={pnl >= 0 ? 'pnl-pos' : 'pnl-neg'}>{mask(fmtOp(pnl, o))}</span>
            )}
          </td>
          <td><span style={{ color: 'var(--s-text-dim)' }}>—</span></td>
          <td className="num">
            <span className="op-actions">
              <button className="icon-btn" onClick={stopAnd(() => openForEdit(o))} title={t.history_form_editOp}><i className="ti ti-pencil" /></button>
              <button className="icon-btn" onClick={stopAnd(() => requestRemove(o))} title={t.history_form_delete} style={{ color: 'var(--danger)' }}><i className="ti ti-trash" /></button>
              <span className="history-chevron" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}><i className="ti ti-chevron-down" /></span>
            </span>
          </td>
        </tr>
        {renderDetailRow(o, platform, expanded)}
      </Fragment>
    );
  };

  const renderSwapRow = (pair: SwapPair, expanded: boolean) => {
    const { sell, buy } = pair;
    const platform = resolveOpPlatform(sell.platformId, sell.platformName);
    return (
      <Fragment key={sell.id}>
        <tr className="history-row" onClick={() => toggleExpand(sell.id)}>
          <td style={{ fontWeight: 600 }}>{sell.symbol}→{buy.symbol}</td>
          <td><span className="tag swap">{t.history_form_swap}</span></td>
          <td className="num">{mask(fmtQty(sell.qty, locale))}→{mask(fmtQty(buy.qty, locale))}</td>
          <td className="num" style={{ fontWeight: 600 }}>{mask(fmtOp(buy.total, buy))}</td>
          <td className="num"><span style={{ color: 'var(--s-text-dim)' }}>—</span></td>
          <td><span style={{ color: 'var(--s-text-dim)' }}>—</span></td>
          <td className="num">
            <span className="op-actions">
              <button className="icon-btn" onClick={stopAnd(() => requestRemove(sell))} title={t.history_form_delete} style={{ color: 'var(--danger)' }}><i className="ti ti-trash" /></button>
              <span className="history-chevron" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}><i className="ti ti-chevron-down" /></span>
            </span>
          </td>
        </tr>
        {renderDetailRow(sell, platform, expanded)}
      </Fragment>
    );
  };

  const renderTradeRow = (o: Op, expanded: boolean) => {
    const platform = resolveOpPlatform(o.platformId, o.platformName);
    const status = computeOpStatus(o, closures, ops);
    const pnl = isClosedSource(o.id, closures) ? realizedPnlForSource(o.id, closures) : null;
    return (
      <Fragment key={o.id}>
        <tr className="history-row trade-row" onClick={() => toggleExpand(o.id)}>
          <td style={{ fontWeight: 600 }}>{o.symbol || '—'}</td>
          <td>
            <span className={`tag ${o.side === 'short' ? 'short' : 'long'}`}>{o.side === 'short' ? t.trade_side_short : t.trade_side_long}</span>
            {o.leverage && <span className="lev-badge">{o.leverage}x</span>}
            {cycles.get(o.id) && <CyclePopover cycle={cycles.get(o.id)!} coinSymbol={o.symbol} />}
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
              <button className="icon-btn" onClick={stopAnd(() => requestRemove(o))} title={t.history_form_delete} style={{ color: 'var(--danger)' }}><i className="ti ti-trash" /></button>
              <span className="history-chevron" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}><i className="ti ti-chevron-down" /></span>
            </span>
          </td>
        </tr>
        {renderDetailRow(o, platform, expanded)}
      </Fragment>
    );
  };

  const renderDetailRow = (o: Op, platform: ReturnType<typeof resolveOpPlatform>, expanded: boolean) => (
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
  );

  return (
    <div id="tab-historico" className="section active">
      <ContentHeader title={t.nav_history} subtitle={`${t.history_subtitle} · ${currency}`}>
        <button type="button" className="btn btn-accent" onClick={openForWallet}>
          <i className="ti ti-plus" /> {t.history_action_moveWallet}
        </button>
        <button type="button" className="btn btn-outline-accent" onClick={openForTrade}>
          <i className="ti ti-bolt" /> {t.history_action_newTrade}
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
                  {group.rows.map(row => {
                    if (isSwapPair(row)) {
                      return renderSwapRow(row, !!expandedRows[row.sell.id]);
                    }
                    const expanded = !!expandedRows[row.id];
                    return (row.kind ?? 'wallet') === 'trade' ? renderTradeRow(row, expanded) : renderWalletRow(row, expanded);
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
        editingOp={editingOp}
        closingOp={closingOp}
        newOpKind={newOpKind}
        ops={ops}
        closures={closures}
        assets={assets}
        platformAssets={platformAssets}
        avatarCache={avatarCache}
        prices={prices}
      />

      <ConfirmDialog
        open={!!pendingAction}
        title={t.history_edit_impact_title}
        message={(pendingAction?.kind === 'delete' ? t.history_delete_impact_message : t.history_edit_impact_message)
          .replace('{count}', String(pendingAction?.affectedCount ?? 0))}
        confirmLabel={t.history_edit_impact_confirm}
        cancelLabel={t.common_cancel}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}

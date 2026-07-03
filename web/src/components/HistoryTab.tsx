'use client';

import { useState } from 'react';
import { Op, NewOp, Asset, Prices } from '@/lib/types';
import { fmt, fmtQty, fmtDate } from '@/lib/format';
import { useLocale } from '@/context/LocaleContext';
import { useBalance } from '@/context/BalanceContext';
import ContentHeader from '@/components/ContentHeader';
import OpDrawer from '@/components/OpDrawer';

interface Props {
  ops: Op[];
  assets: Asset[];
  prices: Prices;
  apiKey?: string;
  onAddOp: (op: NewOp) => void;
  onEditOp: (id: string, op: NewOp) => void;
  onRemoveOp: (id: string) => void;
}

export default function HistoryTab({ ops, assets, prices, apiKey = '', onAddOp, onEditOp, onRemoveOp }: Props) {
  const { locale, t } = useLocale();
  const { hidden } = useBalance();
  const mask = (v: string): string => (hidden ? '••••••' : v);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<Op | undefined>(undefined);

  const openForNew = () => { setEditingOp(undefined); setDrawerOpen(true); };
  const openForEdit = (o: Op) => { setEditingOp(o); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditingOp(undefined); };

  const handleSubmit = (op: NewOp) => {
    if (editingOp) onEditOp(editingOp.id, op);
    else onAddOp(op);
  };

  const handleSubmitTrade = (sell: NewOp, buy: NewOp) => {
    onAddOp(sell);
    onAddOp(buy);
  };

  return (
    <div id="tab-historico" className="section active">
      <ContentHeader title={t.nav_history} subtitle={t.history_subtitle}>
        <button type="button" className="btn btn-accent" onClick={openForNew}>
          <i className="ti ti-plus" /> {t.history_form_addOp}
        </button>
      </ContentHeader>

      {!ops.length ? (
        <div className="empty-state"><i className="ti ti-receipt" /><span>{t.history_emptyState}</span></div>
      ) : (
        <div className="op-list-wrap">
          <div className="op-list-row op-list-head">
            <span>{t.history_col_date}</span><span>{t.history_col_asset}</span><span>{t.history_col_type}</span><span>{t.history_col_qty}</span>
            <span>{t.history_col_price}</span><span>{t.history_col_total}</span><span>{t.history_col_fee}</span><span>{t.history_col_platform}</span><span />
          </div>
          {ops.map(o => (
            <div className="op-list-row" key={o.id}>
              <span style={{ color: 'var(--text2)' }}>{fmtDate(o.date, locale)}</span>
              <span style={{ fontWeight: 500 }}>{o.symbol || '—'}</span>
              <span><span className={`pill ${o.type === 'Buy' ? 'pill-pos' : 'pill-neg'}`}>{o.type === 'Buy' ? t.history_opType_buy : t.history_opType_sell}</span></span>
              <span>{mask(fmtQty(o.qty, locale))}</span>
              <span>{mask(fmt(o.price, locale))}</span>
              <span style={{ fontWeight: 500 }}>{mask(fmt(o.total, locale))}</span>
              <span style={{ color: 'var(--text2)' }}>{o.fee > 0 ? mask(fmt(o.fee, locale)) : '—'}</span>
              <span style={{ color: 'var(--text2)' }}>{o.platform || '—'}</span>
              <span className="op-actions">
                <button className="icon-btn" onClick={() => openForEdit(o)} title={t.history_form_editOp}><i className="ti ti-pencil" /></button>
                <button className="icon-btn" onClick={() => onRemoveOp(o.id)} title={t.history_form_delete} style={{ color: 'var(--danger)' }}><i className="ti ti-trash" /></button>
              </span>
            </div>
          ))}
        </div>
      )}

      <OpDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        onSubmit={handleSubmit}
        onSubmitTrade={handleSubmitTrade}
        editingOp={editingOp}
        assets={assets}
        prices={prices}
        apiKey={apiKey}
      />
    </div>
  );
}

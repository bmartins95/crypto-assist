'use client';

import { useState } from 'react';
import { Op, NewOp, Asset, Prices } from '@/lib/types';
import { fmtQty, fmtDate } from '@/lib/format';
import { useLocale } from '@/context/LocaleContext';
import { useBalance } from '@/context/BalanceContext';
import { useCurrency } from '@/context/CurrencyContext';
import ContentHeader from '@/components/ContentHeader';
import OpDrawer from '@/components/OpDrawer';
import { usePlatformCatalog } from '@/components/platform/usePlatformCatalog';

interface Props {
  ops: Op[];
  assets: Asset[];
  prices: Prices;
  onAddOp: (op: NewOp) => Promise<void>;
  onEditOp: (id: string, op: NewOp) => Promise<void>;
  onRemoveOp: (id: string) => void;
}

export default function HistoryTab({ ops, assets, prices, onAddOp, onEditOp, onRemoveOp }: Props) {
  const { locale, t } = useLocale();
  const { hidden } = useBalance();
  const { currency, fmtFromCurrency } = useCurrency();
  const mask = (v: string): string => (hidden ? '••••••' : v);
  const fmtOp = (v: number, o: Op): string => fmtFromCurrency(v, o.currency ?? 'BRL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<Op | undefined>(undefined);
  const { resolveOpPlatform } = usePlatformCatalog();

  const openForNew = () => { setEditingOp(undefined); setDrawerOpen(true); };
  const openForEdit = (o: Op) => { setEditingOp(o); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditingOp(undefined); };

  const handleSubmit = (op: NewOp): Promise<void> => (
    editingOp ? onEditOp(editingOp.id, op) : onAddOp(op)
  );

  const handleSubmitTrade = async (sell: NewOp, buy: NewOp): Promise<void> => {
    await onAddOp(sell);
    await onAddOp(buy);
  };

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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ops.map(o => {
                const platform = resolveOpPlatform(o.platformId, o.platformName);
                return (
                <tr key={o.id}>
                  <td style={{ color: 'var(--s-text-dim)' }}>{fmtDate(o.date, locale)}</td>
                  <td style={{ fontWeight: 600 }}>{o.symbol || '—'}</td>
                  <td><span className={`tag ${o.type === 'Buy' ? 'buy' : 'sell'}`}>{o.type === 'Buy' ? t.history_opType_buy : t.history_opType_sell}</span></td>
                  <td className="num">{mask(fmtQty(o.qty, locale))}</td>
                  <td className="num">{mask(fmtOp(o.price, o))}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{mask(fmtOp(o.total, o))}</td>
                  <td className="num" style={{ color: 'var(--s-text-dim)' }}>{o.fee > 0 ? mask(fmtOp(o.fee, o)) : '—'}</td>
                  <td style={{ color: 'var(--s-text-dim)' }}>{platform ? platform.name : '—'}</td>
                  <td className="num">
                    <span className="op-actions">
                      <button className="icon-btn" onClick={() => openForEdit(o)} title={t.history_form_editOp}><i className="ti ti-pencil" /></button>
                      <button className="icon-btn" onClick={() => onRemoveOp(o.id)} title={t.history_form_delete} style={{ color: 'var(--danger)' }}><i className="ti ti-trash" /></button>
                    </span>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
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
      />
    </div>
  );
}

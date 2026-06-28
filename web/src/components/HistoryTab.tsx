'use client';

import { useState, useRef, useCallback } from 'react';
import { Op, NewOp, Asset, Prices } from '@/lib/types';
import { fmt, fmtQty, fmtDate } from '@/lib/format';
import { searchCoins, fetchSinglePrice, CoinSearchResult } from '@/lib/coingecko';
import { useLocale } from '@/context/LocaleContext';
import { useBalance } from '@/context/BalanceContext';

interface Props {
  ops: Op[];
  assets: Asset[];
  prices: Prices;
  apiKey?: string;
  onAddOp: (op: NewOp) => void;
  onEditOp: (id: string, op: NewOp) => void;
  onRemoveOp: (id: string) => void;
}

interface CoinSelection { coinId: string; symbol: string; name: string }

function CoinSearch({ id, placeholder, apiKey, onSelect, value, onChange }: {
  id: string; placeholder: string; apiKey: string;
  onSelect: (c: CoinSelection) => void;
  value: string; onChange: (v: string) => void;
}) {
  const [results, setResults] = useState<CoinSearchResult[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInput = (v: string) => {
    onChange(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      try { setResults(await searchCoins(v.trim(), apiKey)); } catch { setResults([]); }
    }, 300);
  };

  const select = (c: CoinSearchResult) => {
    onChange(c.name + ' (' + c.symbol.toUpperCase() + ')');
    setResults([]);
    onSelect({ coinId: c.id, symbol: c.symbol.toUpperCase(), name: c.name });
  };

  return (
    <div className="search-wrap">
      <input type="text" id={id} placeholder={placeholder} autoComplete="off"
        value={value} onChange={e => handleInput(e.target.value)} style={{ width: '100%' }} />
      {results.length > 0 && (
        <div className="search-dropdown">
          {results.map(c => (
            <div key={c.id} className="search-item" onClick={() => select(c)}>
              <span>{c.name} <span style={{ color: 'var(--text2)', fontSize: 12 }}>{c.symbol.toUpperCase()}</span></span>
              <span className="search-item-rank">{c.market_cap_rank ? '#' + c.market_cap_rank : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export default function HistoryTab({ ops, assets, prices, apiKey = '', onAddOp, onEditOp, onRemoveOp }: Props) {
  const { locale, t } = useLocale();
  const { hidden } = useBalance();
  const mask = (v: string): string => (hidden ? '••••••' : v);
  const [opDate, setOpDate] = useState(today());
  const [opCoin, setOpCoin] = useState<CoinSelection | null>(null);
  const [opCoinText, setOpCoinText] = useState('');
  const [opType, setOpType] = useState<'Buy' | 'Sell'>('Buy');
  const [opQty, setOpQty] = useState('');
  const [opPrice, setOpPrice] = useState('');
  const [opFee, setOpFee] = useState('');
  const [opPlatform, setOpPlatform] = useState('');
  const [priceMode, setPriceMode] = useState<'unit' | 'total'>('unit');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [trDate, setTrDate] = useState(today());
  const [trFromCoinId, setTrFromCoinId] = useState('');
  const [trFromQty, setTrFromQty] = useState('');
  const [trToCoin, setTrToCoin] = useState<CoinSelection | null>(null);
  const [trToCoinText, setTrToCoinText] = useState('');
  const [trToQty, setTrToQty] = useState('');
  const [trTotal, setTrTotal] = useState('');
  const [trFee, setTrFee] = useState('');
  const [trTotalHint, setTrTotalHint] = useState('');

  const qty = parseFloat(opQty) || 0;
  const val = parseFloat(opPrice) || 0;
  const hint = qty && val ? (priceMode === 'unit' ? `${t.history_col_total}: ${fmt(qty * val, locale)}` : `${t.history_col_price}: ${fmt(val / qty, locale)}`) : '';

  const resetOpForm = () => {
    setOpDate(today()); setOpCoin(null); setOpCoinText(''); setOpType('Buy');
    setOpQty(''); setOpPrice(''); setOpFee(''); setOpPlatform('');
    setPriceMode('unit'); setEditingId(null);
  };

  const handleAddOp = () => {
    if (!opCoin || !qty || !val) return;
    let price: number, total: number;
    if (priceMode === 'total') {
      total = val; price = qty > 0 ? val / qty : 0;
    } else {
      price = val; total = opType === 'Sell' ? qty * price - (parseFloat(opFee) || 0) : qty * price + (parseFloat(opFee) || 0);
    }
    const op: NewOp = { date: opDate, coinId: opCoin.coinId, symbol: opCoin.symbol, name: opCoin.name, type: opType, qty, price, fee: parseFloat(opFee) || 0, total, platform: opPlatform.trim() };
    if (editingId !== null) onEditOp(editingId, op); else onAddOp(op);
    resetOpForm();
  };

  const handleEditOp = (o: Op) => {
    setEditingId(o.id); setOpDate(o.date || '');
    setOpCoin({ coinId: o.coinId, symbol: o.symbol, name: o.name });
    setOpCoinText((o.name || '') + ' (' + (o.symbol || '') + ')');
    setOpType(o.type); setOpQty(String(o.qty)); setOpPrice(String(o.price));
    setOpFee(String(o.fee)); setOpPlatform(o.platform || '');
    setPriceMode('unit');
  };

  const handleRemoveOp = (id: string) => {
    if (editingId === id) resetOpForm();
    onRemoveOp(id);
  };

  const syncTradeTotal = useCallback((fromId: string, fromQtyStr: string, toCoin: CoinSelection | null, totalStr: string) => {
    const fQty = parseFloat(fromQtyStr) || 0;
    let total = 0;
    if (fromId && fQty && prices[fromId]) {
      total = fQty * prices[fromId];
      setTrTotal(total.toFixed(2));
      setTrTotalHint('≈ atual');
    } else {
      total = parseFloat(totalStr) || 0;
      setTrTotalHint('');
    }
    if (total > 0 && toCoin && prices[toCoin.coinId]) {
      setTrToQty((total / prices[toCoin.coinId]).toFixed(8).replace(/\.?0+$/, ''));
    }
  }, [prices]);

  const handleTrToCoinSelect = async (c: CoinSelection) => {
    setTrToCoin(c);
    if (!prices[c.coinId]) {
      try {
        const p = await fetchSinglePrice(c.coinId, apiKey);
        if (p) prices[c.coinId] = p;
      } catch { /* ignore */ }
    }
    syncTradeTotal(trFromCoinId, trFromQty, c, trTotal);
  };

  const handleAddTrade = () => {
    const fromAsset = assets.find(a => a.coinId === trFromCoinId);
    if (!trFromCoinId || !trToCoin || !trFromQty || !trToQty || !trTotal) {
      alert('Preencha: moeda de origem, qtd. vendida, moeda de destino, qtd. comprada e total.'); return;
    }
    if (trFromCoinId === trToCoin.coinId) { alert('A moeda de origem e de destino não podem ser a mesma.'); return; }
    const fromQty = parseFloat(trFromQty), toQty = parseFloat(trToQty), total = parseFloat(trTotal), fee = parseFloat(trFee) || 0;
    const sellOp: NewOp = { date: trDate, coinId: trFromCoinId, symbol: fromAsset?.symbol || '', name: fromAsset?.name || '', type: 'Sell', qty: fromQty, price: total / fromQty, fee: 0, total, platform: '' };
    const buyOp: NewOp = { date: trDate, coinId: trToCoin.coinId, symbol: trToCoin.symbol, name: trToCoin.name, type: 'Buy', qty: toQty, price: (total + fee) / toQty, fee, total: total + fee, platform: '' };
    onAddOp(sellOp); onAddOp(buyOp);
    setTrFromQty(''); setTrToCoin(null); setTrToCoinText(''); setTrToQty(''); setTrTotal(''); setTrFee(''); setTrTotalHint('');
  };

  const isEditing = editingId !== null;

  return (
    <div id="tab-historico" className="section active">
      <div className="op-card">
        <div className="sec-title" style={{ marginBottom: '.75rem' }}>
          <i className={`ti ${isEditing ? 'ti-pencil' : 'ti-plus'}`} style={{ fontSize: 13, verticalAlign: 'middle', marginRight: 4 }} />
          {isEditing ? t.history_form_editOp : t.history_form_addOp}
        </div>
        <div className="op-fields">
          <div className="field">
            <label htmlFor="op-date">{t.history_form_date}</label>
            <input id="op-date" type="date" value={opDate} onChange={e => setOpDate(e.target.value)} />
          </div>
          <div className="field" style={{ position: 'relative' }}>
            <label htmlFor="op-moeda-search">{t.history_form_asset}</label>
            <CoinSearch id="op-moeda-search" placeholder="Bitcoin, BTC..." apiKey={apiKey}
              value={opCoinText} onChange={setOpCoinText}
              onSelect={c => setOpCoin(c)} />
          </div>
          <div className="field">
            <label htmlFor="op-type">{t.history_form_type}</label>
            <select id="op-type" value={opType} onChange={e => setOpType(e.target.value as 'Buy' | 'Sell')}>
              <option value="Buy">{t.history_opType_buy}</option>
              <option value="Sell">{t.history_opType_sell}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="op-qty">{t.history_form_qty}</label>
            <input id="op-qty" type="number" placeholder="0" step="any" value={opQty} onChange={e => setOpQty(e.target.value)} />
          </div>
          <div className="field" style={{ position: 'relative' }}>
            <label htmlFor="op-price">
              <span>{priceMode === 'total' ? t.history_form_total : t.history_form_price}</span>
              <button type="button" className="op-price-toggle" onClick={() => { setPriceMode(m => m === 'unit' ? 'total' : 'unit'); setOpPrice(''); }}>
                ⇄ {priceMode === 'total' ? t.history_form_price : t.history_form_total}
              </button>
            </label>
            <input id="op-price" type="number" placeholder="0.00" step="any" value={opPrice} onChange={e => setOpPrice(e.target.value)} />
            {hint && <div className="field-hint">{hint}</div>}
          </div>
          <div className="field">
            <label htmlFor="op-fee">{t.history_form_fee}</label>
            <input id="op-fee" type="number" placeholder="0.00" step="any" value={opFee} onChange={e => setOpFee(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="op-platform">{t.history_form_platform}</label>
            <input id="op-platform" type="text" placeholder="Binance, MetaMask..." value={opPlatform} onChange={e => setOpPlatform(e.target.value)} />
          </div>
          <div className="field-btn">
            <button className="btn-sm" onClick={handleAddOp}>
              <i className={`ti ${isEditing ? 'ti-check' : 'ti-plus'}`} /> {isEditing ? t.history_form_save : t.trade_form_save}
            </button>
            {isEditing && (
              <button className="btn-sm" onClick={resetOpForm} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                <i className="ti ti-x" /> {t.history_form_cancel}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="trade-card">
        <div className="sec-title" style={{ marginBottom: '.75rem' }}>
          <i className="ti ti-arrows-exchange" style={{ fontSize: 13, verticalAlign: 'middle', marginRight: 4 }} />
          {t.trade_form_title}
        </div>
        <div className="trade-fields">
          <div className="field">
            <label htmlFor="tr-date">{t.history_form_date}</label>
            <input id="tr-date" type="date" value={trDate} onChange={e => setTrDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tr-from">{t.trade_form_from}</label>
            <select id="tr-from" value={trFromCoinId} onChange={e => { setTrFromCoinId(e.target.value); syncTradeTotal(e.target.value, trFromQty, trToCoin, trTotal); }}>
              {assets.length ? assets.map(a => <option key={a.coinId} value={a.coinId}>{a.symbol} · {mask(fmtQty(a.qty, locale))}</option>) : <option value="">{t.trade_form_noAssets}</option>}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tr-from-qty">{t.trade_form_qty}</label>
            <input id="tr-from-qty" type="number" placeholder="0" step="any" value={trFromQty} onChange={e => { setTrFromQty(e.target.value); syncTradeTotal(trFromCoinId, e.target.value, trToCoin, trTotal); }} />
          </div>
          <div className="field" style={{ position: 'relative' }}>
            <label htmlFor="tr-to-search">{t.trade_form_to}</label>
            <CoinSearch id="tr-to-search" placeholder="Bitcoin, BTC..." apiKey={apiKey}
              value={trToCoinText} onChange={setTrToCoinText}
              onSelect={handleTrToCoinSelect} />
          </div>
          <div className="field">
            <label htmlFor="tr-to-qty">{t.trade_form_toQty}</label>
            <input id="tr-to-qty" type="number" placeholder="0" step="any" value={trToQty} onChange={e => setTrToQty(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tr-total">{t.trade_form_price} <span className="trade-hint">{trTotalHint}</span></label>
            <input id="tr-total" type="number" placeholder="0.00" step="any" value={trTotal} onChange={e => setTrTotal(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tr-fee">{t.trade_form_fee}</label>
            <input id="tr-fee" type="number" placeholder="0.00" step="any" value={trFee} onChange={e => setTrFee(e.target.value)} />
          </div>
          <div className="field-btn">
            <button className="btn-sm" onClick={handleAddTrade}>
              <i className="ti ti-arrows-exchange" /> {t.trade_form_save}
            </button>
          </div>
        </div>
      </div>

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
                <button className="icon-btn" onClick={() => handleEditOp(o)} title={t.history_form_editOp}><i className="ti ti-pencil" /></button>
                <button className="icon-btn" onClick={() => handleRemoveOp(o.id)} title={t.history_form_delete} style={{ color: 'var(--danger)' }}><i className="ti ti-trash" /></button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

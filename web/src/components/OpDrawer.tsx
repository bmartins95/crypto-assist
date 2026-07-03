'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Op, NewOp, Asset, Prices } from '@/lib/types';
import { searchCoins, fetchSinglePrice, CoinSearchResult } from '@/lib/coingecko';
import { useLocale } from '@/context/LocaleContext';
import NumericField from '@/components/NumericField';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (op: NewOp) => void | Promise<void>;
  onSubmitTrade: (sell: NewOp, buy: NewOp) => void | Promise<void>;
  editingOp?: Op;
  assets: Asset[];
  prices: Prices;
  apiKey?: string;
}

interface CoinSelection { coinId: string; symbol: string; name: string }

type Phase = 'idle' | 'loading' | 'done';

const FOCUSABLE_SELECTOR = 'input, select, button, textarea, [tabindex]:not([tabindex="-1"])';

function CoinSearch({ id, placeholder, apiKey, onSelect, value, onChange, inputRef }: {
  id: string; placeholder: string; apiKey: string;
  onSelect: (c: CoinSelection) => void;
  value: string; onChange: (v: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
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
      <input ref={inputRef} type="text" id={id} placeholder={placeholder} autoComplete="off"
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

function CheckIcon() {
  return (
    <svg className="ck" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const DONE_DISPLAY_MS = 1300;

export default function OpDrawer({ open, onClose, onSubmit, onSubmitTrade, editingOp, assets, prices, apiKey = '' }: Props) {
  const { t } = useLocale();
  const [opType, setOpType] = useState<'buy' | 'sell' | 'trade'>('buy');
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');

  const [date, setDate] = useState(today());
  const [platform, setPlatform] = useState('');
  const [coin, setCoin] = useState<CoinSelection | null>(null);
  const [coinText, setCoinText] = useState('');
  const [qty, setQty] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [priceSource, setPriceSource] = useState<'auto' | 'manual' | null>(null);
  const [fee, setFee] = useState('');

  const [fromCoinId, setFromCoinId] = useState('');
  const [fromQty, setFromQty] = useState('');
  const [toCoin, setToCoin] = useState<CoinSelection | null>(null);
  const [toCoinText, setToCoinText] = useState('');
  const [toQty, setToQty] = useState('');
  const [total, setTotal] = useState('');
  const [tradeFee, setTradeFee] = useState('');
  const [totalHint, setTotalHint] = useState('');

  const drawerRef = useRef<HTMLElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const priorOverflow = useRef('');

  const resetBuySell = () => {
    setDate(today()); setPlatform(''); setCoin(null); setCoinText('');
    setQty(''); setUnitPrice(''); setPriceSource(null); setFee('');
  };

  const resetTrade = () => {
    setFromCoinId(''); setFromQty(''); setToCoin(null); setToCoinText('');
    setToQty(''); setTotal(''); setTradeFee(''); setTotalHint('');
  };

  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      priorOverflow.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      setError(null);
      setPhase('idle');
      if (editingOp) {
        setOpType(editingOp.type === 'Buy' ? 'buy' : 'sell');
        setDate(editingOp.date);
        setPlatform(editingOp.platform || '');
        setCoin({ coinId: editingOp.coinId, symbol: editingOp.symbol, name: editingOp.name });
        setCoinText(`${editingOp.name} (${editingOp.symbol})`);
        setQty(String(editingOp.qty));
        setUnitPrice(String(editingOp.price));
        setPriceSource(null);
        setFee(String(editingOp.fee));
      } else {
        setOpType('buy');
        resetBuySell();
        resetTrade();
      }
      requestAnimationFrame(() => firstFieldRef.current?.focus());
    } else {
      document.body.style.overflow = priorOverflow.current;
      previouslyFocused.current?.focus();
    }
  }, [open, editingOp]);

  const requestClose = () => { if (phase === 'idle') onClose(); };

  const handleTypeChange = (next: 'buy' | 'sell' | 'trade') => {
    if (phase !== 'idle') return;
    if (opType === 'trade' && next !== 'trade') resetTrade();
    setOpType(next);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { requestClose(); return; }
    if (e.key !== 'Tab' || !drawerRef.current) return;
    const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter(el => !el.hasAttribute('disabled'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  };

  const qtyNum = parseFloat(qty) || 0;
  const priceNum = parseFloat(unitPrice) || 0;
  const feeNum = parseFloat(fee) || 0;
  const computedTotal = opType === 'sell' ? qtyNum * priceNum - feeNum : qtyNum * priceNum + feeNum;

  const handleCoinSelect = async (c: CoinSelection) => {
    setCoin(c);
    let p = prices[c.coinId];
    if (!p) {
      try {
        const fetched = await fetchSinglePrice(c.coinId, apiKey);
        if (fetched) { p = fetched; prices[c.coinId] = fetched; }
      } catch { /* price stays unavailable; user enters it manually */ }
    }
    if (p) { setUnitPrice(p.toFixed(2)); setPriceSource('auto'); }
  };

  const finishAfterSave = () => {
    setPhase('done');
    setTimeout(() => { setPhase('idle'); onClose(); }, DONE_DISPLAY_MS);
  };

  const handleSubmit = async () => {
    if (phase !== 'idle') return;
    if (opType === 'trade') { await submitTrade(); return; }
    if (!coin || qtyNum <= 0 || priceNum <= 0) {
      setError(t.history_form_validationRequired);
      return;
    }
    const op: NewOp = {
      date, coinId: coin.coinId, symbol: coin.symbol, name: coin.name,
      type: opType === 'buy' ? 'Buy' : 'Sell',
      qty: qtyNum, price: priceNum, fee: feeNum, total: computedTotal,
      platform: platform.trim(),
    };
    setPhase('loading');
    try {
      await onSubmit(op);
      finishAfterSave();
    } catch {
      setPhase('idle');
    }
  };

  const syncTradeTotal = useCallback((fromId: string, fromQtyStr: string, toC: CoinSelection | null, totalStr: string) => {
    const fQty = parseFloat(fromQtyStr) || 0;
    let amount = 0;
    if (fromId && fQty && prices[fromId]) {
      amount = fQty * prices[fromId];
      setTotal(amount.toFixed(2));
      setTotalHint('≈ atual');
    } else {
      amount = parseFloat(totalStr) || 0;
      setTotalHint('');
    }
    if (amount > 0 && toC && prices[toC.coinId]) {
      setToQty((amount / prices[toC.coinId]).toFixed(8).replace(/\.?0+$/, ''));
    }
  }, [prices]);

  const handleToCoinSelect = async (c: CoinSelection) => {
    setToCoin(c);
    if (!prices[c.coinId]) {
      try {
        const p = await fetchSinglePrice(c.coinId, apiKey);
        if (p) prices[c.coinId] = p;
      } catch { /* price stays unavailable; total sync falls back to manual entry */ }
    }
    syncTradeTotal(fromCoinId, fromQty, c, total);
  };

  const submitTrade = async () => {
    const fromQtyNum = parseFloat(fromQty) || 0;
    const toQtyNum = parseFloat(toQty) || 0;
    const totalNum = parseFloat(total) || 0;
    const tradeFeeNum = parseFloat(tradeFee) || 0;
    if (!fromCoinId || !toCoin || fromQtyNum <= 0 || toQtyNum <= 0 || totalNum <= 0) {
      setError(t.history_form_validationRequired);
      return;
    }
    if (fromCoinId === toCoin.coinId) {
      setError(t.trade_form_sameAsset);
      return;
    }
    const fromAsset = assets.find(a => a.coinId === fromCoinId);
    const sellOp: NewOp = {
      date, coinId: fromCoinId, symbol: fromAsset?.symbol || '', name: fromAsset?.name || '',
      type: 'Sell', qty: fromQtyNum, price: totalNum / fromQtyNum, fee: 0, total: totalNum,
      platform: platform.trim(),
    };
    const buyOp: NewOp = {
      date, coinId: toCoin.coinId, symbol: toCoin.symbol, name: toCoin.name,
      type: 'Buy', qty: toQtyNum, price: (totalNum + tradeFeeNum) / toQtyNum, fee: tradeFeeNum,
      total: totalNum + tradeFeeNum, platform: platform.trim(),
    };
    setPhase('loading');
    try {
      await onSubmitTrade(sellOp, buyOp);
      finishAfterSave();
    } catch {
      setPhase('idle');
    }
  };

  const titleId = 'drawer-title';
  const busy = phase !== 'idle';
  const priceBadge = priceSource && !editingOp
    ? { text: priceSource === 'auto' ? t.history_form_priceAuto : t.history_form_priceManual, variant: priceSource }
    : undefined;

  return (
    <>
      <div className={`drawer-backdrop${open ? ' open' : ''}`} onClick={requestClose} />
      <aside ref={drawerRef} className={`drawer${open ? ' open' : ''}`} aria-hidden={!open}
        role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={handleKeyDown}>
        <div className="drawer-head">
          <div className="drawer-title" id={titleId}>
            {editingOp ? t.history_form_editOp : t.history_form_addOp}
          </div>
          <button type="button" className="icon-btn" onClick={requestClose} disabled={busy} aria-label={t.history_form_cancel}>
            <i className="ti ti-x" />
          </button>
        </div>

        <div className="drawer-body">
          <div className="fld">
            <label htmlFor="drawer-type">{t.history_form_type}</label>
            <div className="seg-ctrl seg-tipo" id="drawer-type">
              <button type="button" className={opType === 'buy' ? 'seg-btn active' : 'seg-btn'} onClick={() => handleTypeChange('buy')} disabled={busy}>{t.history_opType_buy}</button>
              <button type="button" className={opType === 'sell' ? 'seg-btn active' : 'seg-btn'} onClick={() => handleTypeChange('sell')} disabled={busy}>{t.history_opType_sell}</button>
              <button type="button" className={opType === 'trade' ? 'seg-btn active' : 'seg-btn'} onClick={() => handleTypeChange('trade')} disabled={busy || !!editingOp}>{t.history_form_trade}</button>
            </div>
          </div>

          {opType !== 'trade' ? (
            <>
              <div className="drawer-grid">
                <div className="fld">
                  <label htmlFor="drawer-date">{t.history_form_date}</label>
                  <input ref={firstFieldRef} id="drawer-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="fld">
                  <label htmlFor="drawer-platform">{t.history_form_platform}</label>
                  <input id="drawer-platform" type="text" placeholder="Binance, MetaMask..." value={platform} onChange={e => setPlatform(e.target.value)} />
                </div>
              </div>
              <div className="fld">
                <label htmlFor="drawer-coin">{opType === 'sell' ? t.history_form_assetSold : t.history_form_assetBought}</label>
                <CoinSearch id="drawer-coin" placeholder="Bitcoin, BTC..." apiKey={apiKey}
                  value={coinText} onChange={setCoinText} onSelect={handleCoinSelect} />
              </div>
              <div className="drawer-grid">
                <NumericField id="drawer-qty" label={t.history_form_qty} placeholder="0"
                  value={qty} onChange={setQty} suffix={coin?.symbol} />
                <NumericField id="drawer-price" label={t.history_form_price} placeholder="0.00"
                  value={unitPrice} onChange={v => { setUnitPrice(v); setPriceSource('manual'); }} prefix="R$" badge={priceBadge} />
              </div>
              <div className="drawer-grid">
                <NumericField id="drawer-fee" label={t.history_form_fee} placeholder="0.00"
                  value={fee} onChange={setFee} prefix="R$" />
                <NumericField id="drawer-total" label={t.history_form_total} prefix="R$" readOnly
                  value={computedTotal.toFixed(2)} onChange={() => {}} hint={t.history_form_calculatedAutomatically} />
              </div>
            </>
          ) : (
            <>
              <div className="drawer-grid">
                <div className="fld">
                  <label htmlFor="drawer-tr-date">{t.history_form_date}</label>
                  <input ref={firstFieldRef} id="drawer-tr-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="fld">
                  <label htmlFor="drawer-tr-platform">{t.history_form_platform}</label>
                  <input id="drawer-tr-platform" type="text" placeholder="Binance, MetaMask..." value={platform} onChange={e => setPlatform(e.target.value)} />
                </div>
              </div>

              <div className="trade-block out">
                <div className="trade-hd"><span className="dot" />{t.trade_form_from}</div>
                <div className="drawer-grid">
                  <div className="fld">
                    <label htmlFor="drawer-tr-from">{t.wallet_col_asset}</label>
                    <select id="drawer-tr-from" className="settings-select" value={fromCoinId} onChange={e => { setFromCoinId(e.target.value); syncTradeTotal(e.target.value, fromQty, toCoin, total); }}>
                      <option value="">{t.trade_form_noAssets}</option>
                      {assets.map(a => <option key={a.coinId} value={a.coinId}>{a.symbol}</option>)}
                    </select>
                  </div>
                  <NumericField id="drawer-tr-from-qty" label={t.history_form_qty} placeholder="0"
                    value={fromQty} suffix={assets.find(a => a.coinId === fromCoinId)?.symbol}
                    onChange={v => { setFromQty(v); syncTradeTotal(fromCoinId, v, toCoin, total); }} />
                </div>
              </div>

              <div className="trade-arrow"><span className="badge"><i className="ti ti-arrow-down" /></span></div>

              <div className="trade-block in">
                <div className="trade-hd"><span className="dot" />{t.trade_form_to}</div>
                <div className="drawer-grid">
                  <div className="fld">
                    <label htmlFor="drawer-tr-to">{t.wallet_col_asset}</label>
                    <CoinSearch id="drawer-tr-to" placeholder="Bitcoin, BTC..." apiKey={apiKey}
                      value={toCoinText} onChange={setToCoinText} onSelect={handleToCoinSelect} />
                  </div>
                  <NumericField id="drawer-tr-to-qty" label={t.history_form_qty} placeholder="0"
                    value={toQty} onChange={setToQty} suffix={toCoin?.symbol} />
                </div>
              </div>

              <div className="drawer-grid">
                <NumericField id="drawer-tr-fee" label={t.trade_form_fee} placeholder="0.00"
                  value={tradeFee} onChange={setTradeFee} prefix="R$" />
                <NumericField id="drawer-tr-total" label={t.trade_form_price} placeholder="0.00" prefix="R$"
                  value={total} onChange={setTotal} hint={totalHint || t.trade_form_totalHint} />
              </div>
            </>
          )}

          {error && <div className="fhint" style={{ color: 'var(--danger)' }}>{error}</div>}
        </div>

        <div className="drawer-foot">
          <button type="button" className="btn" onClick={requestClose} disabled={busy}>{t.history_form_cancel}</button>
          <button type="button" className={`btn-submit${phase === 'done' ? ' done' : ''}`} onClick={handleSubmit} disabled={busy}>
            <span className="lbl">
              {phase === 'idle' && (editingOp ? t.history_form_save : t.history_form_addOp)}
              {phase === 'loading' && (<><span className="spinner" /><span>{editingOp ? t.history_form_saving : t.history_form_registering}</span></>)}
              {phase === 'done' && (<><CheckIcon /><span>{editingOp ? t.history_form_saved : t.history_form_registered}</span></>)}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

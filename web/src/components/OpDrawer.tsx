'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Op, NewOp, OpClosure, Asset, AssetWithPlatform, AvatarCache, Prices, Platform, Leverage } from '@/lib/types';
import { api, CoinSearchResult } from '@/lib/api/client';
import { fmtQty } from '@/lib/format';
import { openQtyRemaining, estimateClosePnl } from '@/lib/portfolio';
import { useLocale } from '@/context/LocaleContext';
import { useCurrency } from '@/context/CurrencyContext';
import NumericField from '@/components/NumericField';
import PlatformSelect from '@/components/platform/PlatformSelect';
import PlatformLogo from '@/components/platform/PlatformLogo';
import DatePicker from '@/components/DatePicker/DatePicker';
import { usePlatformCatalog } from '@/components/platform/usePlatformCatalog';
import CoinLogo from '@/components/CoinLogo';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (op: NewOp) => void | Promise<void>;
  onSubmitTrade: (sell: NewOp, buy: NewOp) => void | Promise<void>;
  // Only relevant when closingOp is set: closes the position via a simple Buy/Sell.
  onSubmitClose?: (op: NewOp, qtyToClose: number) => void | Promise<void>;
  // Only relevant when closingOp is set and the user picks Trade: the leg matching
  // closingOp's opposite type closes it; the other leg is a brand-new, independently
  // open operation (see specs/023-position-closing/contracts/close-endpoint.md).
  onSubmitTradeClose?: (closingLeg: NewOp, qtyToClose: number, newLeg: NewOp) => void | Promise<void>;
  editingOp?: Op;
  // The open/partial position being closed. Mutually exclusive with editingOp.
  closingOp?: Op;
  closures?: OpClosure[];
  assets: Asset[];
  platformAssets: AssetWithPlatform[];
  avatarCache: AvatarCache;
  prices: Prices;
}

interface CoinSelection { coinId: string; symbol: string; name: string; image?: string | null }

type Phase = 'idle' | 'loading' | 'done';
type PriceState = 'idle' | 'fetching' | 'auto' | 'manual';

const FOCUSABLE_SELECTOR = 'input, select, button, textarea, [tabindex]:not([tabindex="-1"])';
const DEBOUNCE_MS = 300;

// Ranks exact symbol match > symbol prefix > name prefix > substring, used to filter
// the small in-memory `restrictTo`/`seed` lists (the user's own assets) locally —
// unrelated to the network search, which the backend already ranks by relevance.
function filterSeed(list: CoinSearchResult[], query: string): CoinSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const scored: { c: CoinSearchResult; score: number }[] = [];
  for (const c of list) {
    const sym = c.symbol.toLowerCase();
    const name = c.name.toLowerCase();
    let score = -1;
    if (sym === q) score = 0;
    else if (sym.startsWith(q)) score = 1;
    else if (name.startsWith(q)) score = 2;
    else if (sym.includes(q) || name.includes(q)) score = 3;
    if (score >= 0) scored.push({ c, score });
  }
  scored.sort((a, b) => a.score - b.score || a.c.name.length - b.c.name.length);
  return scored.map(({ c }) => c);
}

// `restrictTo`, when provided, disables network search entirely — the field only
// ever searches/shows that fixed list (used for "assets you already own" fields).
function CoinSearch({ id, placeholder, onSelect, onClear, value, onChange, inputRef, seed, restrictTo, emptyLabel, selected, disabled, groupLabel, qtyLabel }: {
  id: string; placeholder: string;
  onSelect: (c: CoinSelection) => void;
  onClear: () => void;
  value: string; onChange: (v: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  seed?: CoinSearchResult[];
  restrictTo?: CoinSearchResult[];
  emptyLabel?: string;
  selected?: CoinSelection | null;
  disabled?: boolean;
  groupLabel?: string;
  qtyLabel?: (coinId: string) => string | undefined;
}) {
  const [results, setResults] = useState<CoinSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchSeq = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setResults([]);
        onChange('');
        onClear();
      }
    };
    document.addEventListener('mousedown', onDocPointerDown);
    return () => document.removeEventListener('mousedown', onDocPointerDown);
  }, [open]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const runSearch = (q: string) => {
    const seq = ++searchSeq.current;
    const applyIfCurrent = (list: CoinSearchResult[]) => { if (seq === searchSeq.current) setResults(list); };
    api.searchCoins(q)
      .then(applyIfCurrent)
      .catch(() => applyIfCurrent([]));
  };

  // Debounced so a fast typist doesn't fire one request per keystroke — only
  // once input pauses for DEBOUNCE_MS. Any pending search is cancelled outright
  // when the query is cleared/restricted, not just left to resolve and get
  // discarded, so a stale request never reaches the network at all.
  const handleInput = (v: string) => {
    onChange(v);
    setOpen(true);
    const q = v.trim();
    clearTimeout(debounceRef.current);
    if (restrictTo) { setResults(q ? filterSeed(restrictTo, q) : restrictTo); return; }
    if (q.length === 0) { setResults(seed ?? []); return; }
    setResults([]);
    debounceRef.current = setTimeout(() => runSearch(q), DEBOUNCE_MS);
  };

  const handleFocus = () => {
    onChange('');
    onClear();
    setResults(restrictTo ?? seed ?? []);
    setOpen(true);
  };

  const select = (c: CoinSearchResult) => {
    onChange(c.name + ' (' + c.symbol.toUpperCase() + ')');
    setResults([]);
    setOpen(false);
    onSelect({ coinId: c.id, symbol: c.symbol.toUpperCase(), name: c.name, image: c.image });
  };

  const showInlineLogo = !open && !!selected;

  return (
    <div className="search-wrap" ref={wrapRef}>
      {showInlineLogo && selected && (
        <span className="sel-logo"><CoinLogo image={selected.image} symbol={selected.symbol} size="sm" /></span>
      )}
      <input ref={inputRef} type="text" id={id} placeholder={placeholder} autoComplete="off" disabled={disabled}
        className={`inp${showInlineLogo ? ' withcoin' : ''}`}
        value={value} onChange={e => handleInput(e.target.value)} onFocus={handleFocus} style={{ width: '100%' }} />
      {open && (results.length > 0 || (restrictTo && restrictTo.length === 0 && emptyLabel)) && (
        <div className="search-dropdown">
          {results.length === 0 && emptyLabel ? (
            <div className="search-item" style={{ color: 'var(--text3)', cursor: 'default' }}>{emptyLabel}</div>
          ) : (
            <>
              {groupLabel && <div className="dd-grp">{groupLabel}</div>}
              {results.map(c => (
                <div key={c.id} className="search-item" onClick={() => select(c)}>
                  <CoinLogo image={c.image} symbol={c.symbol} size="sm" />
                  <span className="meta">{c.name} <span style={{ color: 'var(--text2)', fontSize: 12 }}>{c.symbol.toUpperCase()}</span></span>
                  <span className="search-item-rank">{qtyLabel?.(c.id) ?? (c.market_cap_rank ? '#' + c.market_cap_rank : '')}</span>
                </div>
              ))}
            </>
          )}
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
const LEVERAGE_OPTIONS: (Leverage | null)[] = [null, 2, 3, 5, 10];

type OpTypeOption = 'buy' | 'sell' | 'trade';
const TYPE_ORDER: OpTypeOption[] = ['buy', 'sell', 'trade'];

export default function OpDrawer({
  open, onClose, onSubmit, onSubmitTrade, onSubmitClose, onSubmitTradeClose,
  editingOp, closingOp, closures = [], assets, platformAssets, avatarCache, prices,
}: Props) {
  const { t, locale } = useLocale();
  const { currency, rates, fmtFromCurrency } = useCurrency();
  const { resolveOpPlatform } = usePlatformCatalog();
  // Monetary inputs are denominated in the display currency; market prices are USD.
  const toDisplay = (usd: number): number => usd * (rates ? rates[currency] : 0);
  const [opType, setOpType] = useState<OpTypeOption>('buy');
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');

  const [date, setDate] = useState(today());
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [coin, setCoin] = useState<CoinSelection | null>(null);
  const [coinText, setCoinText] = useState('');
  const [qty, setQty] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [priceState, setPriceState] = useState<PriceState>('idle');
  const [fee, setFee] = useState('');
  const [leverage, setLeverage] = useState<Leverage | null>(null);

  const [originPlatform, setOriginPlatform] = useState<Platform | null>(null);
  const [destPlatform, setDestPlatform] = useState<Platform | null>(null);
  const [fromCoinId, setFromCoinId] = useState('');
  const [fromCoinText, setFromCoinText] = useState('');
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
  const panelRef = useRef<HTMLDivElement>(null);
  const slideDirRef = useRef<'fwd' | 'back'>('fwd');
  const pendingSlideRef = useRef(false);

  const resetBuySell = () => {
    setDate(today()); setPlatform(null); setCoin(null); setCoinText('');
    setQty(''); setUnitPrice(''); setPriceState('idle'); setFee('');
  };

  const resetTrade = () => {
    setOriginPlatform(null); setDestPlatform(null);
    setFromCoinId(''); setFromCoinText(''); setFromQty(''); setToCoin(null); setToCoinText('');
    setToQty(''); setTotal(''); setTradeFee(''); setTotalHint('');
  };

  const handleOriginPlatformChange = (p: Platform | null) => {
    setOriginPlatform(p);
    setFromCoinId(''); setFromCoinText(''); setFromQty('');
  };

  const originHoldings = useMemo(
    () => originPlatform ? platformAssets.filter(a => a.platformId === originPlatform.id) : [],
    [platformAssets, originPlatform]
  );
  // Platforms you can actually sell from — anything with no current balance
  // anywhere (including the legacy blank platformId from pre-catalog ops) isn't
  // a valid "from" choice.
  const heldPlatforms = useMemo(() => {
    const seen = new Map<string, Platform>();
    for (const a of platformAssets) {
      if (!a.platformId || seen.has(a.platformId)) continue;
      const p = resolveOpPlatform(a.platformId, a.platformName);
      if (p) seen.set(a.platformId, p);
    }
    return [...seen.values()];
  }, [platformAssets, resolveOpPlatform]);
  const fromHolding = originHoldings.find(a => a.coinId === fromCoinId);
  const fromOverBalance = !!fromHolding && (parseFloat(fromQty) || 0) > fromHolding.qty;
  const showTransferWarning = !!originPlatform && !!destPlatform && destPlatform.id !== originPlatform.id;

  // Which type(s) can legally close closingOp — the row's own type is never offered
  // (FR-006). Undefined (no closingOp) means every type is available, as today.
  const allowedTypes: OpTypeOption[] = closingOp
    ? closingOp.type === 'Buy' ? ['sell', 'trade'] : ['buy', 'trade']
    : ['buy', 'sell', 'trade'];
  // When closing via Trade, this is the leg that must match closingOp (and therefore
  // calls onSubmitTradeClose's closing-leg path) — 'sell' closes an open Buy, 'buy'
  // closes an open Sell.
  const closeRole: 'sell' | 'buy' | null = closingOp ? (closingOp.type === 'Buy' ? 'sell' : 'buy') : null;
  const remainingQty = closingOp ? openQtyRemaining(closingOp, closures) : 0;
  const closingPlatform = closingOp ? resolveOpPlatform(closingOp.platformId, closingOp.platformName) : null;
  const closingName = closingOp?.name ?? '';
  const closingSymbol = closingOp?.symbol ?? '';
  const closingCoinId = closingOp?.coinId ?? '';

  const renderStaticPlatform = (p: typeof closingPlatform) => (
    <div className="static-field">
      {p && <PlatformLogo platform={p} size="sm" />}
      <span className="static-field-text">{p?.name ?? '—'}</span>
    </div>
  );
  const renderStaticCoin = (coinId: string, symbol: string, name: string) => (
    <div className="static-field">
      <CoinLogo image={avatarCache[coinId]?.url} symbol={symbol} size="sm" />
      <span className="static-field-text">{name} ({symbol})</span>
    </div>
  );

  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      priorOverflow.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      setError(null);
      setPhase('idle');
      setLeverage(null);
      if (editingOp) {
        setOpType(editingOp.type === 'Buy' ? 'buy' : 'sell');
        setDate(editingOp.date);
        setPlatform(resolveOpPlatform(editingOp.platformId, editingOp.platformName));
        setCoin({ coinId: editingOp.coinId, symbol: editingOp.symbol, name: editingOp.name });
        setCoinText(`${editingOp.name} (${editingOp.symbol})`);
        setQty(String(editingOp.qty));
        setUnitPrice(String(editingOp.price));
        setPriceState('idle');
        setFee(String(editingOp.fee));
        resetTrade();
      } else if (closingOp) {
        const remaining = openQtyRemaining(closingOp, closures);
        const p = resolveOpPlatform(closingOp.platformId, closingOp.platformName);
        const closingCoin = { coinId: closingOp.coinId, symbol: closingOp.symbol, name: closingOp.name };
        setOpType(closingOp.type === 'Buy' ? 'sell' : 'buy');
        setDate(today());
        setPlatform(p);
        setCoin(closingCoin);
        setCoinText(`${closingOp.name} (${closingOp.symbol})`);
        setQty(String(remaining));
        setUnitPrice('');
        setPriceState('idle');
        setFee('');
        resetTrade();
        // Pre-fill the Trade side matching closeRole too, so switching tabs keeps continuity.
        if (closingOp.type === 'Buy') {
          setOriginPlatform(p);
          setFromCoinId(closingOp.coinId);
          setFromCoinText(`${closingOp.name} (${closingOp.symbol})`);
          setFromQty(String(remaining));
        } else {
          setDestPlatform(p);
          setToCoin(closingCoin);
          setToCoinText(`${closingOp.name} (${closingOp.symbol})`);
          setToQty(String(remaining));
        }
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
  }, [open, editingOp, closingOp]);

  // Re-fetches whenever the selected coin (or Buy/Sell type) changes; the cleanup's
  // `cancelled` flag discards a stale response if the user picks another coin before
  // this one's fetch resolves, which is what caused the price to freeze on the wrong asset.
  useEffect(() => {
    if (!coin || editingOp || (opType !== 'buy' && opType !== 'sell')) return;
    let cancelled = false;
    setPriceState('fetching');
    (async () => {
      let p = prices[coin.coinId];
      if (!p) {
        try { p = (await api.getPrices([coin.coinId]))[coin.coinId]?.price; }
        catch { p = undefined; }
      }
      if (cancelled) return;
      if (p && rates) {
        prices[coin.coinId] = p;
        setUnitPrice(toDisplay(p).toFixed(2));
        setPriceState('auto');
      } else {
        setPriceState('idle');
      }
    })();
    return () => { cancelled = true; };
  }, [coin, opType]);

  const requestClose = () => { if (phase === 'idle') onClose(); };

  const handleTypeChange = (next: OpTypeOption) => {
    if (phase !== 'idle' || !allowedTypes.includes(next) || next === opType) return;
    slideDirRef.current = TYPE_ORDER.indexOf(next) > TYPE_ORDER.indexOf(opType) ? 'fwd' : 'back';
    pendingSlideRef.current = true;
    setOpType(next);
    setError(null);
  };

  // Restart the directional slide keyframe on each user-initiated tab switch. The
  // panel content swaps synchronously (no remount), so the class is toggled
  // imperatively and a reflow is forced to replay the animation even when the
  // direction is unchanged. Prefill/open changes don't set the flag, so they don't slide.
  useEffect(() => {
    const el = panelRef.current;
    if (!el || !pendingSlideRef.current) return;
    pendingSlideRef.current = false;
    el.classList.remove('slide-fwd', 'slide-back');
    void el.offsetWidth;
    el.classList.add(slideDirRef.current === 'fwd' ? 'slide-fwd' : 'slide-back');
  }, [opType]);

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

  // A normal create/edit shows the inline "done" checkmark and keeps the drawer open
  // with the just-submitted values still filled in, so registering several similar ops
  // in a row doesn't require reopening and re-filling the form. Closing a position is a
  // one-shot action with nothing to repeat, so it dismisses the drawer at once (no
  // checkmark) — the parent surfaces a success toast instead.
  const finishAfterSave = () => {
    if (closingOp) { onClose(); return; }
    setPhase('done');
    setTimeout(() => setPhase('idle'), DONE_DISPLAY_MS);
  };

  const handleSubmit = async () => {
    if (phase !== 'idle') return;
    if (opType === 'trade') { await submitTrade(); return; }
    if (!coin || qtyNum <= 0 || priceNum <= 0) {
      setError(t.history_form_validationRequired);
      return;
    }
    if (closingOp && qtyNum > remainingQty + 1e-9) {
      setError(t.history_form_validationRequired);
      return;
    }
    const op: NewOp = {
      date, coinId: coin.coinId, symbol: coin.symbol, name: coin.name,
      type: opType === 'buy' ? 'Buy' : 'Sell',
      qty: qtyNum, price: priceNum, fee: feeNum, total: computedTotal,
      platformId: platform?.id, platformName: platform?.name,
      currency: editingOp?.currency ?? closingOp?.currency ?? currency,
      leverage: !editingOp && !closingOp ? (leverage ?? undefined) : undefined,
    };
    setPhase('loading');
    try {
      if (closingOp) {
        await onSubmitClose?.(op, qtyNum);
      } else {
        await onSubmit(op);
      }
      finishAfterSave();
    } catch {
      setPhase('idle');
    }
  };

  const syncTradeTotal = useCallback((fromId: string, fromQtyStr: string, toC: CoinSelection | null, totalStr: string) => {
    const fQty = parseFloat(fromQtyStr) || 0;
    let amount = 0;
    if (fromId && fQty && prices[fromId] && rates) {
      amount = fQty * toDisplay(prices[fromId]);
      setTotal(amount.toFixed(2));
      setTotalHint('≈ atual');
    } else {
      amount = parseFloat(totalStr) || 0;
      setTotalHint('');
    }
    if (amount > 0 && toC && prices[toC.coinId] && rates) {
      setToQty((amount / toDisplay(prices[toC.coinId])).toFixed(8).replace(/\.?0+$/, ''));
    }
  }, [prices, rates, currency]);

  const handleFromCoinSelect = (c: CoinSelection) => {
    setFromCoinId(c.coinId);
    syncTradeTotal(c.coinId, fromQty, toCoin, total);
  };

  // Same stale-response guard as the Buy/Sell price effect above, for the Trade
  // "receive" side's live price lookup.
  useEffect(() => {
    if (!toCoin || opType !== 'trade') return;
    if (prices[toCoin.coinId]) { syncTradeTotal(fromCoinId, fromQty, toCoin, total); return; }
    let cancelled = false;
    (async () => {
      try {
        const p = (await api.getPrices([toCoin.coinId]))[toCoin.coinId]?.price;
        if (cancelled || !p) return;
        prices[toCoin.coinId] = p;
        syncTradeTotal(fromCoinId, fromQty, toCoin, total);
      } catch { /* price stays unavailable; total sync falls back to manual entry */ }
    })();
    return () => { cancelled = true; };
  }, [toCoin, opType]);

  const submitTrade = async () => {
    const fromQtyNum = parseFloat(fromQty) || 0;
    const toQtyNum = parseFloat(toQty) || 0;
    const totalNum = parseFloat(total) || 0;
    const tradeFeeNum = parseFloat(tradeFee) || 0;
    if (!originPlatform || !fromCoinId || !toCoin || fromQtyNum <= 0 || toQtyNum <= 0 || totalNum <= 0) {
      setError(t.history_form_validationRequired);
      return;
    }
    const effectiveDest = destPlatform ?? originPlatform;
    if (fromCoinId === toCoin.coinId && effectiveDest.id === originPlatform.id) {
      setError(t.trade_form_sameAsset);
      return;
    }
    if (closingOp && closeRole === 'sell' && fromQtyNum > remainingQty + 1e-9) {
      setError(t.history_form_validationRequired);
      return;
    }
    if (closingOp && closeRole === 'buy' && toQtyNum > remainingQty + 1e-9) {
      setError(t.history_form_validationRequired);
      return;
    }
    const fromAsset = originHoldings.find(a => a.coinId === fromCoinId);
    const tradeCurrency = closingOp?.currency ?? currency;
    const sellOp: NewOp = {
      date, coinId: fromCoinId,
      symbol: (closingOp && closeRole === 'sell') ? closingOp.symbol : (fromAsset?.symbol || ''),
      name: (closingOp && closeRole === 'sell') ? closingOp.name : (fromAsset?.name || ''),
      type: 'Sell', qty: fromQtyNum, price: totalNum / fromQtyNum, fee: 0, total: totalNum,
      platformId: originPlatform.id, platformName: originPlatform.name,
      currency: tradeCurrency,
    };
    const buyOp: NewOp = {
      date, coinId: toCoin.coinId, symbol: toCoin.symbol, name: toCoin.name,
      type: 'Buy', qty: toQtyNum, price: (totalNum + tradeFeeNum) / toQtyNum, fee: tradeFeeNum,
      total: totalNum + tradeFeeNum, platformId: effectiveDest.id, platformName: effectiveDest.name,
      currency: tradeCurrency,
    };
    setPhase('loading');
    try {
      if (closingOp && closeRole === 'sell') {
        await onSubmitTradeClose?.(sellOp, fromQtyNum, buyOp);
      } else if (closingOp && closeRole === 'buy') {
        await onSubmitTradeClose?.(buyOp, toQtyNum, sellOp);
      } else {
        await onSubmitTrade(sellOp, buyOp);
      }
      finishAfterSave();
    } catch {
      setPhase('idle');
    }
  };

  const titleId = 'drawer-title';
  const busy = phase !== 'idle';
  const assetSeed: CoinSearchResult[] = assets.map(a => ({ id: a.coinId, symbol: a.symbol, name: a.name, image: avatarCache[a.coinId]?.url }));
  const priceBadge = editingOp || priceState === 'idle'
    ? undefined
    : priceState === 'fetching'
      ? { variant: 'fetching' as const, content: <span className="mini-spin" /> }
      : priceState === 'auto'
        ? { variant: 'auto' as const, content: t.history_form_priceAuto }
        : { variant: 'manual' as const, content: t.history_form_priceManual };

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
          {closingOp && (
            <div className="closing-banner">
              {t.history_closing_banner
                .replace('{coin}', closingOp.symbol)
                .replace('{platform}', closingPlatform?.name ?? '—')
                .replace('{qty}', fmtQty(remainingQty, locale))}
            </div>
          )}

          <div className="fld drawer-type-fld">
            <label htmlFor="drawer-type">{t.history_form_type}</label>
            <div className="seg-ctrl seg-tipo" id="drawer-type">
              {allowedTypes.includes('buy') && (
                <button type="button" className={opType === 'buy' ? 'seg-btn active' : 'seg-btn'} onClick={() => handleTypeChange('buy')} disabled={busy}>{t.history_opType_buy}</button>
              )}
              {allowedTypes.includes('sell') && (
                <button type="button" className={opType === 'sell' ? 'seg-btn active' : 'seg-btn'} onClick={() => handleTypeChange('sell')} disabled={busy}>{t.history_opType_sell}</button>
              )}
              <button type="button" className={opType === 'trade' ? 'seg-btn active' : 'seg-btn'} onClick={() => handleTypeChange('trade')} disabled={busy || !!editingOp}>{t.history_form_trade}</button>
            </div>
          </div>

          <div className="type-panel" ref={panelRef}>
          {opType !== 'trade' ? (
            <>
              <div className="drawer-grid">
                <div className="fld">
                  <label htmlFor="drawer-date">{t.history_form_date}</label>
                  <DatePicker id="drawer-date" value={date} onChange={setDate} maxDate={today()} inputRef={firstFieldRef} />
                </div>
                <div className="fld">
                  <label htmlFor="drawer-platform">{t.history_form_platform}</label>
                  {closingOp ? (
                    renderStaticPlatform(closingPlatform)
                  ) : (
                    <PlatformSelect id="drawer-platform" value={platform} onChange={setPlatform} />
                  )}
                </div>
              </div>
              <div className="fld">
                <label htmlFor="drawer-coin">{opType === 'sell' ? t.history_form_assetSold : t.history_form_assetBought}</label>
                {closingOp ? (
                  renderStaticCoin(closingOp.coinId, closingOp.symbol, closingOp.name)
                ) : (
                  <CoinSearch id="drawer-coin" placeholder="Bitcoin, BTC..." seed={assetSeed}
                    value={coinText} onChange={setCoinText} onSelect={setCoin} selected={coin}
                    onClear={() => { setCoin(null); setUnitPrice(''); setPriceState('idle'); }} />
                )}
              </div>
              <div className="drawer-grid">
                <NumericField id="drawer-qty" label={t.history_form_qty} placeholder="0"
                  value={qty} onChange={setQty} suffix={coin?.symbol} />
                <NumericField id="drawer-price" label={t.history_form_price} placeholder="0.00"
                  value={unitPrice} onChange={v => { setUnitPrice(v); setPriceState('manual'); }} prefix="R$" badge={priceBadge} />
              </div>
              {!editingOp && !closingOp && (
                <div className="fld">
                  <label>{t.op_leverage_label}</label>
                  <div className="leverage-chips">
                    {LEVERAGE_OPTIONS.map(v => (
                      <button key={String(v)} type="button"
                        className={leverage === v ? 'lev-chip active' : 'lev-chip'}
                        aria-label={`${v ?? 1}x`}
                        onClick={() => setLeverage(prev => (prev === v ? null : v))}>
                        {v ?? 1}x
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="drawer-grid">
                <NumericField id="drawer-fee" label={t.history_form_fee} placeholder="0.00"
                  value={fee} onChange={setFee} prefix="R$" />
                <NumericField id="drawer-total" label={t.history_form_total} prefix="R$" readOnly
                  value={computedTotal.toFixed(2)} onChange={() => {}} hint={t.history_form_calculatedAutomatically} />
              </div>
              {closingOp && (() => {
                const estimatedPnl = estimateClosePnl(closingOp, { price: priceNum }, Math.min(qtyNum, remainingQty));
                return (
                  <div className="pnl-preview">
                    <span>{t.history_pnl_estimated}</span>
                    <span className={estimatedPnl >= 0 ? 'pnl-pos' : 'pnl-neg'}>
                      {fmtFromCurrency(estimatedPnl, closingOp.currency ?? 'BRL')}
                    </span>
                  </div>
                );
              })()}
            </>
          ) : (
            <>
              <div className="fld tr-date">
                <label htmlFor="drawer-tr-date">{t.history_form_date}</label>
                <DatePicker id="drawer-tr-date" value={date} onChange={setDate} maxDate={today()} inputRef={firstFieldRef} />
              </div>

              <div className="trade-block out">
                <div className="trade-hd"><span className="dot" />{t.trade_form_from}</div>
                <div className="fld">
                  <label htmlFor="drawer-tr-platform-from">{t.trade_form_platformFrom}</label>
                  {closeRole === 'sell' ? (
                    renderStaticPlatform(closingPlatform)
                  ) : (
                    <PlatformSelect id="drawer-tr-platform-from" value={originPlatform} onChange={handleOriginPlatformChange}
                      options={heldPlatforms} />
                  )}
                </div>
                <div className="drawer-grid">
                  <div className="fld">
                    <label htmlFor="drawer-tr-from">{t.wallet_col_asset}</label>
                    {closeRole === 'sell' ? (
                      renderStaticCoin(closingCoinId, closingSymbol, closingName)
                    ) : (
                      <CoinSearch id="drawer-tr-from"
                        placeholder={!originPlatform ? t.trade_form_choosePlatformFirst : (originHoldings.length === 0 ? t.trade_form_noAssetsInPlatform : 'ETH, BTC...')}
                        disabled={!originPlatform}
                        restrictTo={originHoldings.map(a => ({ id: a.coinId, symbol: a.symbol, name: a.name, image: avatarCache[a.coinId]?.url }))}
                        emptyLabel={originPlatform ? t.trade_form_noAssetsOnPlatform.replace('{platform}', originPlatform.name) : undefined}
                        groupLabel={originPlatform ? t.trade_form_yourAssetsOn.replace('{platform}', originPlatform.name) : undefined}
                        qtyLabel={coinId => { const h = originHoldings.find(a => a.coinId === coinId); return h ? fmtQty(h.qty, locale) : undefined; }}
                        value={fromCoinText} onChange={setFromCoinText} onSelect={handleFromCoinSelect}
                        selected={fromCoinId ? { coinId: fromCoinId, symbol: fromHolding?.symbol || '', name: '' } : null}
                        onClear={() => setFromCoinId('')} />
                    )}
                  </div>
                  <NumericField id="drawer-tr-from-qty" label={t.history_form_qty} placeholder="0"
                    value={fromQty} suffix={closeRole === 'sell' ? closingSymbol : fromHolding?.symbol}
                    error={closeRole === 'sell' ? (parseFloat(fromQty) || 0) > remainingQty : fromOverBalance}
                    onChange={v => { setFromQty(v); syncTradeTotal(fromCoinId, v, toCoin, total); }}
                    hint={closeRole === 'sell' ? (
                      <span className={`bal-row${(parseFloat(fromQty) || 0) > remainingQty ? ' err' : ''}`}>
                        <span>{((parseFloat(fromQty) || 0) > remainingQty ? t.trade_form_balanceExceeded : t.trade_form_balance)
                          .replace('{qty}', fmtQty(remainingQty, locale)).replace('{symbol}', closingSymbol)}</span>
                      </span>
                    ) : fromHolding && (
                      <span className={`bal-row${fromOverBalance ? ' err' : ''}`}>
                        <span>{(fromOverBalance ? t.trade_form_balanceExceeded : t.trade_form_balance)
                          .replace('{qty}', fmtQty(fromHolding.qty, locale)).replace('{symbol}', fromHolding.symbol)}</span>
                        <button type="button" className="max"
                          onClick={() => { const q = String(fromHolding.qty); setFromQty(q); syncTradeTotal(fromCoinId, q, toCoin, total); }}>
                          {t.trade_form_max}
                        </button>
                      </span>
                    )} />
                </div>
              </div>

              <div className="trade-arrow"><span className="badge"><i className="ti ti-arrow-down" /></span></div>
              {showTransferWarning && <div className="xfer-warn"><i className="ti ti-arrows-exchange" /> {t.trade_form_transferWarning}</div>}

              <div className="trade-block in">
                <div className="trade-hd"><span className="dot" />{t.trade_form_to}</div>
                <div className="fld">
                  <label htmlFor="drawer-tr-platform-to">{t.trade_form_platformTo}</label>
                  {closeRole === 'buy' ? (
                    renderStaticPlatform(closingPlatform)
                  ) : (
                    <>
                      <PlatformSelect id="drawer-tr-platform-to" value={destPlatform} onChange={setDestPlatform} />
                      <span className="fhint">{t.trade_form_platformToHint}</span>
                    </>
                  )}
                </div>
                <div className="drawer-grid">
                  <div className="fld">
                    <label htmlFor="drawer-tr-to">{t.wallet_col_asset}</label>
                    {closeRole === 'buy' ? (
                      renderStaticCoin(closingCoinId, closingSymbol, closingName)
                    ) : (
                      <CoinSearch id="drawer-tr-to" placeholder="Bitcoin, BTC..." seed={assetSeed}
                        value={toCoinText} onChange={setToCoinText} onSelect={setToCoin} selected={toCoin}
                        onClear={() => { setToCoin(null); setToQty(''); }} />
                    )}
                  </div>
                  <NumericField id="drawer-tr-to-qty" label={t.history_form_qty} placeholder="0"
                    value={toQty} onChange={setToQty} suffix={closeRole === 'buy' ? closingSymbol : toCoin?.symbol}
                    error={closeRole === 'buy' ? (parseFloat(toQty) || 0) > remainingQty : false} />
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
          </div>

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

'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Op, NewOp, OpClosure, Asset, AssetWithPlatform, AvatarCache, Prices, Platform, Leverage } from '@/lib/types';
import { api, CoinSearchResult } from '@/lib/api/client';
import { fmtQty } from '@/lib/format';
import { openQtyRemaining, estimateClosePnl, computeWalletBalance, computeWalletRealizedPnl } from '@/lib/portfolio';
import { useLocale } from '@/context/LocaleContext';
import { useCurrency } from '@/context/CurrencyContext';
import NumericField from '@/components/NumericField';
import BalanceHint from '@/components/BalanceHint';
import PlatformSelect from '@/components/platform/PlatformSelect';
import PlatformLogo from '@/components/platform/PlatformLogo';
import DatePicker from '@/components/DatePicker/DatePicker';
import { usePlatformCatalog } from '@/components/platform/usePlatformCatalog';
import CoinLogo from '@/components/CoinLogo';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (op: NewOp) => void | Promise<void>;
  // Wallet Swap only — a trade position can never be closed via swap (item 28 removes
  // that path; see contracts/close-endpoint-delta.md's "Removed capability").
  onSubmitTrade: (sell: NewOp, buy: NewOp) => void | Promise<void>;
  // Only relevant when closingOp is set: closes the trade position via a locked-type
  // Buy/Sell (spec FR-015).
  onSubmitClose?: (op: NewOp, qtyToClose: number) => void | Promise<void>;
  editingOp?: Op;
  // The open/partial trade position being closed. Mutually exclusive with editingOp.
  closingOp?: Op;
  // Which button opened the drawer for a brand-new operation ('wallet' via "Move
  // wallet", 'trade' via "New trade"). Ignored when editingOp/closingOp is set — their
  // own kind/side determine the mode instead.
  newOpKind?: 'wallet' | 'trade';
  ops: Op[];
  closures?: OpClosure[];
  assets: Asset[];
  platformAssets: AssetWithPlatform[];
  avatarCache: AvatarCache;
  prices: Prices;
}

interface CoinSelection { coinId: string; symbol: string; name: string; image?: string | null }

type Phase = 'idle' | 'loading';
type PriceState = 'idle' | 'fetching' | 'auto' | 'manual';

const FOCUSABLE_SELECTOR = 'input, select, button, textarea, [tabindex]:not([tabindex="-1"])';
const DEBOUNCE_MS = 300;
const BROWSE_LIMIT = 50;

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
function CoinSearch({ id, placeholder, onSelect, onClear, value, onChange, inputRef, seed, restrictTo, emptyLabel, selected, disabled, groupLabel, qtyLabel, error }: {
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
  error?: boolean;
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

  // A browse-mode `seed` (or `restrictTo`) can still be loading when the field
  // is first focused with an empty query — without this, a dropdown opened
  // before that load finishes would show nothing until the user blurs and
  // refocuses. Re-syncs the open, still-empty dropdown once the data arrives.
  useEffect(() => {
    if (!open || value.trim().length > 0) return;
    setResults(restrictTo ?? seed ?? []);
  }, [restrictTo, seed]);

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
        className={['inp', showInlineLogo && 'withcoin', error && 'err'].filter(Boolean).join(' ')}
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

const today = () => new Date().toISOString().slice(0, 10);
const LEVERAGE_OPTIONS: (Leverage | null)[] = [null, 2, 3, 5, 10];
const CUSTOM_LEVERAGE_MIN = 2;
const CUSTOM_LEVERAGE_MAX = 125;
const CUSTOM_LEVERAGE_STORAGE_KEY = 'crypto-assist:custom-leverage';

function readLastCustomLeverage(): number | null {
  const raw = localStorage.getItem(CUSTOM_LEVERAGE_STORAGE_KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isInteger(n) && n >= CUSTOM_LEVERAGE_MIN && n <= CUSTOM_LEVERAGE_MAX ? n : null;
}

type OpTypeOption = 'buy' | 'sell' | 'swap';
const TYPE_ORDER: OpTypeOption[] = ['buy', 'sell', 'swap'];
type DrawerMode = 'wallet' | 'trade' | 'close';

export default function OpDrawer({
  open, onClose, onSubmit, onSubmitTrade, onSubmitClose,
  editingOp, closingOp, newOpKind, ops, closures = [], assets, platformAssets, avatarCache, prices,
}: Props) {
  const { t, locale } = useLocale();
  const { currency, rates, fmtFromCurrency } = useCurrency();
  const { resolveOpPlatform } = usePlatformCatalog();
  // Monetary inputs are denominated in the display currency; market prices are USD.
  const toDisplay = (usd: number): number => usd * (rates ? rates[currency] : 0);
  const mode: DrawerMode = closingOp
    ? 'close'
    : editingOp
      ? (editingOp.kind === 'trade' ? 'trade' : 'wallet')
      : (newOpKind === 'trade' ? 'trade' : 'wallet');
  const [opType, setOpType] = useState<OpTypeOption>('buy');
  // Field-level validity is derived fresh on every render (see e.g. `coinMissing`,
  // `qtyInvalid` below) rather than stored as messages — `submitAttempted` just
  // gates whether those derived flags are actually displayed, so a first submit
  // click lights up every currently-invalid field at once (not just the first one
  // found), each with its own message positioned right next to that field.
  const [submitAttempted, setSubmitAttempted] = useState(false);
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
  const [customLevMode, setCustomLevMode] = useState<'idle' | 'editing'>('idle');
  const [customLevDraft, setCustomLevDraft] = useState('');
  const [lastCustomLeverage, setLastCustomLeverage] = useState<number | null>(readLastCustomLeverage);
  const [defaultCoins, setDefaultCoins] = useState<CoinSearchResult[]>([]);

  const [originPlatform, setOriginPlatform] = useState<Platform | null>(null);
  const [destPlatform, setDestPlatform] = useState<Platform | null>(null);
  const [fromCoinId, setFromCoinId] = useState('');
  // Symbol/name captured at selection time, independent of `originHoldings` — a
  // filtered "currently held" list drops the asset entirely once its balance hits
  // zero, which must not erase what's needed to display/submit the sell leg.
  const [fromCoinMeta, setFromCoinMeta] = useState<{ symbol: string; name: string } | null>(null);
  const [fromCoinText, setFromCoinText] = useState('');
  const [fromQty, setFromQty] = useState('');
  const [fromUnitPrice, setFromUnitPrice] = useState('');
  const [fromPriceState, setFromPriceState] = useState<PriceState>('idle');
  const [toCoin, setToCoin] = useState<CoinSelection | null>(null);
  const [toCoinText, setToCoinText] = useState('');
  const [toQty, setToQty] = useState('');
  const [toUnitPrice, setToUnitPrice] = useState('');
  const [toPriceState, setToPriceState] = useState<PriceState>('idle');
  const [tradeFee, setTradeFee] = useState('');

  const drawerRef = useRef<HTMLElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const priorOverflow = useRef('');
  const panelRef = useRef<HTMLDivElement>(null);
  const slideDirRef = useRef<'fwd' | 'back'>('fwd');
  const customLevInputRef = useRef<HTMLInputElement>(null);
  // Set right before an Escape-driven mode change so the blur the browser fires
  // when the input unmounts doesn't also commit the draft (see handoff state 5b/5c).
  const skipCustomLevBlurRef = useRef(false);
  const pendingSlideRef = useRef(false);

  const resetBuySell = () => {
    setDate(today()); setPlatform(null); setCoin(null); setCoinText('');
    setQty(''); setUnitPrice(''); setPriceState('idle'); setFee('');
  };

  const resetTrade = () => {
    setOriginPlatform(null); setDestPlatform(null);
    setFromCoinId(''); setFromCoinMeta(null); setFromCoinText(''); setFromQty(''); setFromUnitPrice(''); setFromPriceState('idle');
    setToCoin(null); setToCoinText(''); setToQty(''); setToUnitPrice(''); setToPriceState('idle'); setTradeFee('');
  };

  const isFixedLeverage = (v: number | null) => LEVERAGE_OPTIONS.includes(v);

  const openCustomLevEditor = (prefill: string) => {
    setCustomLevDraft(prefill);
    setCustomLevMode('editing');
    requestAnimationFrame(() => customLevInputRef.current?.focus());
  };

  const commitCustomLeverage = () => {
    const n = Math.trunc(Number(customLevDraft));
    if (Number.isFinite(n) && n >= CUSTOM_LEVERAGE_MIN && n <= CUSTOM_LEVERAGE_MAX) {
      setLeverage(n);
      setLastCustomLeverage(n);
      localStorage.setItem(CUSTOM_LEVERAGE_STORAGE_KEY, String(n));
    }
    setCustomLevMode('idle');
    setCustomLevDraft('');
  };

  // The browser can fire a real blur event when the input unmounts as a side
  // effect of the Escape handler's own state update — this guard keeps that
  // stray blur from re-committing a draft the user just cancelled.
  const handleCustomLevBlur = () => {
    if (skipCustomLevBlurRef.current) { skipCustomLevBlurRef.current = false; return; }
    commitCustomLeverage();
  };

  const cancelCustomLevEditor = () => {
    skipCustomLevBlurRef.current = true;
    setCustomLevMode('idle');
    setCustomLevDraft('');
  };

  const handleOriginPlatformChange = (p: Platform | null) => {
    setOriginPlatform(p);
    setFromCoinId(''); setFromCoinMeta(null); setFromCoinText(''); setFromQty(''); setFromUnitPrice(''); setFromPriceState('idle');
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
  // `originHoldings` only lists assets with a *current* nonzero balance, so once this
  // coin's balance reaches zero (e.g. a prior swap in this same drawer session already
  // sold all of it) `.find` returns undefined — defaulting to 0 here instead of leaving
  // the qty (and the over-balance check below) undefined is what makes a second attempt
  // to sell the same now-empty position actually get caught instead of silently passing.
  const fromAvailableQty = originHoldings.find(a => a.coinId === fromCoinId)?.qty ?? 0;
  const fromOverBalance = !!fromCoinId && (parseFloat(fromQty) || 0) > fromAvailableQty + 1e-9;
  const showTransferWarning = !!originPlatform && !!destPlatform && destPlatform.id !== originPlatform.id;

  // Closing a trade position locks the type to whichever side resolves it — a short
  // closes only via Buy, a long only via Sell (spec FR-015); never a swap. A brand-new
  // trade offers Buy/Sell (Long/Short) with no swap; a wallet op offers all three.
  const allowedTypes: OpTypeOption[] = closingOp
    ? [closingOp.side === 'short' ? 'buy' : 'sell']
    : mode === 'trade' ? ['buy', 'sell'] : ['buy', 'sell', 'swap'];
  const remainingQty = closingOp ? openQtyRemaining(closingOp, closures) : 0;
  const closingPlatform = closingOp ? resolveOpPlatform(closingOp.platformId, closingOp.platformName) : null;

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

  // Fetched on mount, not gated on `open` — the drawer stays mounted (just
  // hidden) between opens, so this has almost always already resolved by the
  // time the user clicks "+ Add operation", matching PlatformSelect's
  // always-available seed instead of racing a network call against the click.
  useEffect(() => {
    api.searchCoins('', BROWSE_LIMIT).then(setDefaultCoins).catch(() => { /* falls back to per-query search */ });
  }, []);

  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      priorOverflow.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      setSubmitAttempted(false);
      setPhase('idle');
      setLeverage(null);
      setCustomLevMode('idle');
      setCustomLevDraft('');
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
        setOpType(closingOp.side === 'short' ? 'buy' : 'sell');
        setDate(today());
        setPlatform(p);
        setCoin({ coinId: closingOp.coinId, symbol: closingOp.symbol, name: closingOp.name });
        setCoinText(`${closingOp.name} (${closingOp.symbol})`);
        setQty(String(remaining));
        setUnitPrice('');
        setPriceState('idle');
        setFee('');
        resetTrade();
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
    setSubmitAttempted(false);
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

  // Excludes the op being edited so the preview reflects the balance available before
  // this edit, not a figure that already double-counts it.
  const opsForWalletPreview = useMemo(
    () => (editingOp ? ops.filter(o => o.id !== editingOp.id) : ops),
    [ops, editingOp],
  );
  const walletBalance = useMemo(
    () => (mode === 'wallet' && opType === 'sell' && coin && platform)
      ? computeWalletBalance(opsForWalletPreview, coin.coinId, platform.id, editingOp?.currency ?? currency)
      : null,
    [mode, opType, coin, platform, opsForWalletPreview, editingOp, currency],
  );
  const walletOverBalance = !!walletBalance && qtyNum > walletBalance.availableQty + 1e-9;
  // Each condition maps to exactly one field's own inline message below — `coin` is
  // always pre-set for a close (renderStaticCoin), so it's never the missing one there.
  const coinMissing = !closingOp && !coin;
  const qtyExceedsRemaining = !!closingOp && qtyNum > 0 && qtyNum > remainingQty + 1e-9;
  const qtyInvalid = qtyNum <= 0;
  const priceInvalid = priceNum <= 0;
  const walletEstimatedPnl = (mode === 'wallet' && opType === 'sell' && coin && platform && qtyNum > 0 && priceNum > 0)
    ? (() => {
        const preview: Op = {
          id: '__wallet_preview__', date, coinId: coin.coinId, symbol: coin.symbol, name: coin.name,
          type: 'Sell', qty: qtyNum, price: priceNum, fee: feeNum, total: computedTotal,
          platformId: platform.id, platformName: platform.name,
          currency: editingOp?.currency ?? currency, kind: 'wallet',
          // Sorts after every real op on the same day (a preview always represents
          // "right now") without needing a fallback to the `__wallet_preview__` id,
          // whose sort position relative to a real UUID would otherwise be arbitrary.
          createdAt: new Date().toISOString(),
        };
        return computeWalletRealizedPnl(preview, [...opsForWalletPreview, preview]);
      })()
    : null;

  const fromQtyNum = parseFloat(fromQty) || 0;
  const toQtyNum = parseFloat(toQty) || 0;
  const fromPriceNum = parseFloat(fromUnitPrice) || 0;
  const toPriceNum = parseFloat(toUnitPrice) || 0;
  const tradeFeeNum = parseFloat(tradeFee) || 0;
  // The bottom "Total" reflects the amount received (destination qty × its unit price);
  // the sell leg's own value is separate so unequal-value swaps still book correctly.
  const receivedTotal = toQtyNum * toPriceNum;
  const soldValue = fromQtyNum * fromPriceNum;
  // One flag per swap field, each surfaced right next to that field below.
  const originPlatformMissing = !originPlatform;
  const fromCoinMissing = !fromCoinId;
  const fromQtyInvalid = fromQtyNum <= 0;
  const fromPriceInvalid = fromPriceNum <= 0;
  const toCoinMissing = !toCoin;
  const toQtyInvalid = toQtyNum <= 0;
  const toPriceInvalid = toPriceNum <= 0;
  // Shown live (not gated by submitAttempted), matching `showTransferWarning` above —
  // both describe the relationship between the two blocks, not a single field's own
  // value, so waiting for a submit attempt would just hide useful feedback the user
  // could otherwise catch immediately after picking the second asset.
  const sameAssetSelected = !!originPlatform && !!toCoin && fromCoinId === toCoin.coinId
    && (destPlatform ?? originPlatform).id === originPlatform.id;

  // A normal create/edit keeps the drawer open with the just-submitted values still
  // filled in, so registering several similar ops in a row doesn't require reopening
  // and re-filling the form — the parent surfaces a success toast. Closing a position
  // is a one-shot action with nothing to repeat, so it dismisses the drawer at once.
  const finishAfterSave = () => {
    if (closingOp) { onClose(); return; }
    setPhase('idle');
  };

  const handleSubmit = async () => {
    if (phase !== 'idle') return;
    if (opType === 'swap') { await submitTrade(); return; }
    setSubmitAttempted(true);
    if (coinMissing || qtyInvalid || priceInvalid || qtyExceedsRemaining || (!closingOp && mode === 'wallet' && opType === 'sell' && walletOverBalance)) {
      return;
    }
    if (!coin) return;
    const op: NewOp = {
      date, coinId: coin.coinId, symbol: coin.symbol, name: coin.name,
      type: opType === 'buy' ? 'Buy' : 'Sell',
      qty: qtyNum, price: priceNum, fee: feeNum, total: computedTotal,
      platformId: platform?.id, platformName: platform?.name,
      currency: editingOp?.currency ?? closingOp?.currency ?? currency,
      leverage: mode === 'trade' && !editingOp && !closingOp ? (leverage ?? undefined) : undefined,
      // Classification is fixed at creation (spec FR-025) — an edit must echo the
      // stored op's kind/side exactly, never re-derive it from the current mode.
      kind: editingOp ? editingOp.kind : closingOp ? closingOp.kind : (mode === 'trade' ? 'trade' : 'wallet'),
      side: editingOp ? editingOp.side : undefined,
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

  const handleFromCoinSelect = (c: CoinSelection) => {
    setFromCoinId(c.coinId);
    setFromCoinMeta({ symbol: c.symbol, name: c.name });
  };

  // Auto-fills each side's unit price from the live market price (display currency),
  // mirroring the Buy/Sell price effect. The `cancelled` flag drops a stale response if
  // the coin changes before this fetch resolves; a manual edit flips the badge to
  // 'manual' and this effect won't clobber it (it only re-runs on coin/type change).
  useEffect(() => {
    if (!fromCoinId || opType !== 'swap') return;
    let cancelled = false;
    setFromPriceState('fetching');
    (async () => {
      let p = prices[fromCoinId];
      if (!p) { try { p = (await api.getPrices([fromCoinId]))[fromCoinId]?.price; } catch { p = undefined; } }
      if (cancelled) return;
      if (p && rates) { prices[fromCoinId] = p; setFromUnitPrice(toDisplay(p).toFixed(2)); setFromPriceState('auto'); }
      else setFromPriceState('idle');
    })();
    return () => { cancelled = true; };
  }, [fromCoinId, opType]);

  useEffect(() => {
    if (!toCoin || opType !== 'swap') return;
    let cancelled = false;
    setToPriceState('fetching');
    (async () => {
      let p = prices[toCoin.coinId];
      if (!p) { try { p = (await api.getPrices([toCoin.coinId]))[toCoin.coinId]?.price; } catch { p = undefined; } }
      if (cancelled) return;
      if (p && rates) { prices[toCoin.coinId] = p; setToUnitPrice(toDisplay(p).toFixed(2)); setToPriceState('auto'); }
      else setToPriceState('idle');
    })();
    return () => { cancelled = true; };
  }, [toCoin, opType]);

  // Derives the received quantity from an equal-value swap: the value sold
  // (fromQty × fromUnitPrice) buys as much of the destination as its unit price allows.
  // Keyed off the sell side and both unit prices, never off toQty, so a manual toQty
  // edit isn't overwritten unless an upstream value changes.
  useEffect(() => {
    if (opType !== 'swap') return;
    const sold = (parseFloat(fromQty) || 0) * (parseFloat(fromUnitPrice) || 0);
    const tPrice = parseFloat(toUnitPrice) || 0;
    if (sold > 0 && tPrice > 0) setToQty((sold / tPrice).toFixed(8).replace(/\.?0+$/, ''));
  }, [fromQty, fromUnitPrice, toUnitPrice, opType]);

  // Wallet Swap only — a trade position never closes via swap (allowedTypes excludes
  // 'swap' whenever closingOp is set, so this is unreachable in close mode).
  const submitTrade = async () => {
    setSubmitAttempted(true);
    // Re-checks fromOverBalance here (not just relied on for the field's error
    // styling) — the drawer can stay open and pre-filled after a prior successful
    // swap already spent this same balance, so the value computed at render time
    // must still be re-validated at submit time rather than assuming it's accurate.
    if (originPlatformMissing || fromCoinMissing || fromQtyInvalid || fromPriceInvalid
      || toCoinMissing || toQtyInvalid || toPriceInvalid || fromOverBalance || sameAssetSelected) {
      return;
    }
    if (!originPlatform || !toCoin) return;
    const effectiveDest = destPlatform ?? originPlatform;
    const sellOp: NewOp = {
      date, coinId: fromCoinId, symbol: fromCoinMeta?.symbol || '', name: fromCoinMeta?.name || '',
      type: 'Sell', qty: fromQtyNum, price: fromPriceNum, fee: 0, total: soldValue,
      platformId: originPlatform.id, platformName: originPlatform.name,
      currency, kind: 'wallet',
    };
    const buyOp: NewOp = {
      date, coinId: toCoin.coinId, symbol: toCoin.symbol, name: toCoin.name,
      type: 'Buy', qty: toQtyNum, price: toPriceNum, fee: tradeFeeNum,
      total: receivedTotal + tradeFeeNum, platformId: effectiveDest.id, platformName: effectiveDest.name,
      currency, kind: 'wallet',
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
  const assetSeed: CoinSearchResult[] = assets.map(a => ({ id: a.coinId, symbol: a.symbol, name: a.name, image: avatarCache[a.coinId]?.url }));
  const badgeFor = (state: PriceState) => state === 'fetching'
    ? { variant: 'fetching' as const, content: <span className="mini-spin" /> }
    : state === 'auto'
      ? { variant: 'auto' as const, content: t.history_form_priceAuto }
      : state === 'manual'
        ? { variant: 'manual' as const, content: t.history_form_priceManual }
        : undefined;
  const priceBadge = editingOp ? undefined : badgeFor(priceState);

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
                <button type="button" className={opType === 'buy' ? 'seg-btn active' : 'seg-btn'} onClick={() => handleTypeChange('buy')} disabled={busy || !!closingOp}>
                  {mode === 'trade' ? t.history_opType_buyLong : t.history_opType_buy}
                </button>
              )}
              {allowedTypes.includes('sell') && (
                <button type="button" className={opType === 'sell' ? 'seg-btn active' : 'seg-btn'} onClick={() => handleTypeChange('sell')} disabled={busy || !!closingOp}>
                  {mode === 'trade' ? t.history_opType_sellShort : t.history_opType_sell}
                </button>
              )}
              {allowedTypes.includes('swap') && (
                <button type="button" className={opType === 'swap' ? 'seg-btn active' : 'seg-btn'} onClick={() => handleTypeChange('swap')} disabled={busy || !!editingOp}>{t.history_form_swap}</button>
              )}
            </div>
            {closingOp && (
              <div className="fhint">{closingOp.side === 'short' ? t.trade_close_locked_hint_short : t.trade_close_locked_hint_long}</div>
            )}
          </div>

          <div className="type-panel" ref={panelRef}>
          {opType !== 'swap' ? (
            <>
              <div className="fld">
                <label htmlFor="drawer-date">{t.history_form_date}</label>
                <DatePicker id="drawer-date" value={date} onChange={setDate} maxDate={today()} inputRef={firstFieldRef} />
              </div>
              <div className="drawer-grid">
                <div className="fld">
                  <label htmlFor="drawer-platform">{t.history_form_platform}</label>
                  {closingOp ? (
                    renderStaticPlatform(closingPlatform)
                  ) : (
                    <PlatformSelect id="drawer-platform" value={platform} onChange={setPlatform} />
                  )}
                </div>
                <div className="fld">
                  <label htmlFor="drawer-coin">{opType === 'sell' ? t.history_form_assetSold : t.history_form_assetBought}</label>
                  {closingOp ? (
                    renderStaticCoin(closingOp.coinId, closingOp.symbol, closingOp.name)
                  ) : (
                    <>
                      <CoinSearch id="drawer-coin" placeholder="Bitcoin, BTC..."
                        seed={mode === 'wallet' && opType === 'sell' ? assetSeed : defaultCoins}
                        value={coinText} onChange={setCoinText} onSelect={setCoin} selected={coin}
                        error={submitAttempted && coinMissing}
                        onClear={() => { setCoin(null); setUnitPrice(''); setPriceState('idle'); }} />
                      {submitAttempted && coinMissing && <span className="fhint field-error">{t.history_form_selectAsset}</span>}
                    </>
                  )}
                </div>
              </div>
              <div className="drawer-grid">
                <NumericField id="drawer-qty" label={t.history_form_qty} placeholder="0"
                  value={qty} onChange={setQty} suffix={coin?.symbol}
                  error={walletOverBalance || (submitAttempted && (qtyExceedsRemaining || qtyInvalid))}
                  hint={
                    submitAttempted && qtyInvalid ? (
                      <span className="field-error">{t.history_form_enterQuantity}</span>
                    ) : submitAttempted && qtyExceedsRemaining ? (
                      <span className="field-error">{t.history_form_qtyExceedsRemaining.replace('{qty}', fmtQty(remainingQty, locale))}</span>
                    ) : walletBalance ? (
                      <BalanceHint qty={walletBalance.availableQty} symbol={coin?.symbol ?? ''} over={walletOverBalance}
                        onMax={() => setQty(String(walletBalance.availableQty))} />
                    ) : undefined
                  } />
                <NumericField id="drawer-price" label={t.history_form_price} placeholder="0.00"
                  value={unitPrice} onChange={v => { setUnitPrice(v); setPriceState('manual'); }} prefix="R$" badge={priceBadge}
                  error={submitAttempted && priceInvalid}
                  hint={submitAttempted && priceInvalid ? <span className="field-error">{t.history_form_enterPrice}</span> : undefined} />
              </div>
              {mode === 'trade' && !editingOp && !closingOp && (
                <div className="fld">
                  <label>{t.op_leverage_label}</label>
                  <div className="leverage-chips">
                    {LEVERAGE_OPTIONS.map(v => (
                      <button key={String(v)} type="button"
                        className={leverage === v ? 'lev-chip active' : 'lev-chip'}
                        aria-label={`${v ?? 1}x`}
                        onClick={() => { setLeverage(prev => (prev === v ? null : v)); setCustomLevMode('idle'); }}>
                        {v ?? 1}x
                      </button>
                    ))}
                    {customLevMode === 'editing' ? (
                      <div className="nf lev-chip-custom-input">
                        <input
                          ref={customLevInputRef}
                          type="number" inputMode="numeric"
                          min={CUSTOM_LEVERAGE_MIN} max={CUSTOM_LEVERAGE_MAX} step={1}
                          className="inp has-suf"
                          value={customLevDraft}
                          onChange={e => setCustomLevDraft(e.target.value)}
                          onBlur={handleCustomLevBlur}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitCustomLeverage(); }
                            else if (e.key === 'Escape') { e.preventDefault(); cancelCustomLevEditor(); }
                          }}
                          aria-label={t.op_leverage_custom_label} />
                        <span className="affix suf">x</span>
                      </div>
                    ) : leverage !== null && !isFixedLeverage(leverage) ? (
                      <button type="button" className="lev-chip active"
                        aria-label={`${leverage}x`}
                        onClick={() => setLeverage(null)}>
                        {leverage}x
                      </button>
                    ) : lastCustomLeverage !== null ? (
                      <div className="lev-chip lev-chip-remembered">
                        <button type="button" className="lev-chip-remembered-body"
                          aria-label={`${lastCustomLeverage}x`}
                          onClick={() => setLeverage(lastCustomLeverage)}>
                          <span className="lev-chip-remembered-value">{lastCustomLeverage}x</span>
                          <span className="lev-chip-remembered-caption">{t.op_leverage_custom_lastUsed}</span>
                        </button>
                        <button type="button" className="lev-chip-edit"
                          aria-label={t.op_leverage_custom_edit}
                          onClick={() => openCustomLevEditor(String(lastCustomLeverage))}>
                          <i className="ti ti-pencil" />
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="lev-chip lev-chip-custom-idle"
                        onClick={() => openCustomLevEditor('')}>
                        {t.op_leverage_custom_label}
                      </button>
                    )}
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
              {walletEstimatedPnl !== null && (
                <div className="pnl-preview">
                  <span>{t.wallet_estimated_pnl}</span>
                  <span className={walletEstimatedPnl >= 0 ? 'pnl-pos' : 'pnl-neg'}>
                    {fmtFromCurrency(walletEstimatedPnl, editingOp?.currency ?? currency)}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="fld tr-date">
                <label htmlFor="drawer-tr-date">{t.history_form_date}</label>
                <DatePicker id="drawer-tr-date" value={date} onChange={setDate} maxDate={today()} inputRef={firstFieldRef} />
              </div>

              <div className="trade-block out">
                <div className="trade-hd"><span className="dot" />{t.trade_form_from}</div>
                <div className="drawer-grid">
                  <div className="fld">
                    <label htmlFor="drawer-tr-platform-from">{t.trade_form_platformFrom}</label>
                    <PlatformSelect id="drawer-tr-platform-from" value={originPlatform} onChange={handleOriginPlatformChange}
                      options={heldPlatforms} error={submitAttempted && originPlatformMissing} />
                    {submitAttempted && originPlatformMissing && <span className="fhint field-error">{t.history_form_selectPlatform}</span>}
                  </div>
                  <div className="fld">
                    <label htmlFor="drawer-tr-from">{t.wallet_col_asset}</label>
                    <CoinSearch id="drawer-tr-from"
                      placeholder={!originPlatform ? t.trade_form_choosePlatformFirst : (originHoldings.length === 0 ? t.trade_form_noAssetsInPlatform : 'ETH, BTC...')}
                      disabled={!originPlatform}
                      restrictTo={originHoldings.map(a => ({ id: a.coinId, symbol: a.symbol, name: a.name, image: avatarCache[a.coinId]?.url }))}
                      emptyLabel={originPlatform ? t.trade_form_noAssetsOnPlatform.replace('{platform}', originPlatform.name) : undefined}
                      groupLabel={originPlatform ? t.trade_form_yourAssetsOn.replace('{platform}', originPlatform.name) : undefined}
                      qtyLabel={coinId => { const h = originHoldings.find(a => a.coinId === coinId); return h ? fmtQty(h.qty, locale) : undefined; }}
                      value={fromCoinText} onChange={setFromCoinText} onSelect={handleFromCoinSelect}
                      selected={fromCoinId ? { coinId: fromCoinId, symbol: fromCoinMeta?.symbol || '', name: '' } : null}
                      error={submitAttempted && fromCoinMissing}
                      onClear={() => { setFromCoinId(''); setFromCoinMeta(null); }} />
                    {submitAttempted && fromCoinMissing && <span className="fhint field-error">{t.history_form_selectAsset}</span>}
                  </div>
                </div>
                <div className="drawer-grid">
                  <NumericField id="drawer-tr-from-qty" label={t.history_form_qty} placeholder="0"
                    value={fromQty} suffix={fromCoinMeta?.symbol}
                    error={fromOverBalance || (submitAttempted && fromQtyInvalid)}
                    onChange={setFromQty}
                    hint={
                      submitAttempted && fromQtyInvalid ? (
                        <span className="field-error">{t.history_form_enterQuantity}</span>
                      ) : fromCoinId ? (
                        <BalanceHint qty={fromAvailableQty} symbol={fromCoinMeta?.symbol ?? ''} over={fromOverBalance}
                          onMax={() => setFromQty(String(fromAvailableQty))} />
                      ) : undefined
                    } />
                  <NumericField id="drawer-tr-from-price" label={t.history_form_price} placeholder="0.00"
                    value={fromUnitPrice} onChange={v => { setFromUnitPrice(v); setFromPriceState('manual'); }}
                    prefix="R$" badge={badgeFor(fromPriceState)}
                    error={submitAttempted && fromPriceInvalid}
                    hint={submitAttempted && fromPriceInvalid ? <span className="field-error">{t.history_form_enterPrice}</span> : undefined} />
                </div>
              </div>

              <div className="trade-arrow"><span className="badge"><i className="ti ti-arrow-down" /></span></div>
              {showTransferWarning && <div className="xfer-warn"><i className="ti ti-arrows-exchange" /> {t.trade_form_transferWarning}</div>}

              <div className="trade-block in">
                <div className="trade-hd"><span className="dot" />{t.trade_form_to}</div>
                <div className="drawer-grid">
                  <div className="fld">
                    <label htmlFor="drawer-tr-platform-to">{t.trade_form_platformTo}</label>
                    <PlatformSelect id="drawer-tr-platform-to" value={destPlatform} onChange={setDestPlatform} />
                    <span className="fhint">{t.trade_form_platformToHint}</span>
                  </div>
                  <div className="fld">
                    <label htmlFor="drawer-tr-to">{t.wallet_col_asset}</label>
                    <CoinSearch id="drawer-tr-to" placeholder="Bitcoin, BTC..." seed={defaultCoins}
                      value={toCoinText} onChange={setToCoinText} onSelect={setToCoin} selected={toCoin}
                      error={submitAttempted && toCoinMissing}
                      onClear={() => { setToCoin(null); setToQty(''); }} />
                    {submitAttempted && toCoinMissing && <span className="fhint field-error">{t.history_form_selectAsset}</span>}
                    {sameAssetSelected && <span className="fhint field-error">{t.trade_form_sameAsset}</span>}
                  </div>
                </div>
                <div className="drawer-grid">
                  <NumericField id="drawer-tr-to-qty" label={t.history_form_qty} placeholder="0"
                    value={toQty} onChange={setToQty} suffix={toCoin?.symbol}
                    error={submitAttempted && toQtyInvalid}
                    hint={submitAttempted && toQtyInvalid ? <span className="field-error">{t.history_form_enterQuantity}</span> : undefined} />
                  <NumericField id="drawer-tr-to-price" label={t.history_form_price} placeholder="0.00"
                    value={toUnitPrice} onChange={v => { setToUnitPrice(v); setToPriceState('manual'); }}
                    prefix="R$" badge={badgeFor(toPriceState)}
                    error={submitAttempted && toPriceInvalid}
                    hint={submitAttempted && toPriceInvalid ? <span className="field-error">{t.history_form_enterPrice}</span> : undefined} />
                </div>
              </div>

              <div className="drawer-grid">
                <NumericField id="drawer-tr-fee" label={t.trade_form_fee} placeholder="0.00"
                  value={tradeFee} onChange={setTradeFee} prefix="R$" />
                <NumericField id="drawer-tr-total" label={t.trade_form_price} prefix="R$" readOnly
                  value={receivedTotal.toFixed(2)} onChange={() => {}} hint={t.trade_form_totalHint} />
              </div>
            </>
          )}
          </div>
        </div>

        <div className="drawer-foot">
          <button type="button" className="btn" onClick={requestClose} disabled={busy}>{t.history_form_cancel}</button>
          <button type="button" className="btn-submit" onClick={handleSubmit} disabled={busy}>
            {phase === 'loading' ? (
              <span className="spinner" />
            ) : (
              <span className="lbl">{editingOp ? t.history_form_save : t.history_form_addOp}</span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

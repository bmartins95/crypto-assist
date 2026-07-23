import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '@/context/LocaleContext';
import { fmtPct } from '@/lib/format';

export interface CompareAssetOption {
  coinId: string;
  symbol: string;
  name: string;
  color: string;
  pctChange: number;
  allocationPct: number;
}

interface Props {
  options: CompareAssetOption[];
  value: string | null;
  onChange: (coinId: string | null) => void;
}

interface MenuPosition {
  left: number;
  flipUp: boolean;
  anchorTop: number;
  anchorBottom: number;
}

const PINNED_COUNT = 3;

// Fixed set of chips that never scales with wallet size — sorted by biggest
// |period movement| first, allocation then alphabetical as tie-breakers.
function rankByMovement(options: CompareAssetOption[]): CompareAssetOption[] {
  return [...options].sort((a, b) => {
    const byMovement = Math.abs(b.pctChange) - Math.abs(a.pctChange);
    if (Math.abs(byMovement) > 1e-9) return byMovement;
    const byAllocation = b.allocationPct - a.allocationPct;
    if (Math.abs(byAllocation) > 1e-9) return byAllocation;
    return a.symbol.localeCompare(b.symbol);
  });
}

export default function AssetCompareControl({ options, value, onChange }: Props) {
  const { t } = useLocale();
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const ranked = useMemo(() => rankByMovement(options), [options]);
  // The active asset is always shown as a pinned chip even when it isn't a top mover,
  // so the user can always see & one-tap-deselect what's currently plotted.
  const pinned = useMemo(() => {
    const top = ranked.slice(0, PINNED_COUNT);
    if (!value || top.some(o => o.coinId === value)) return top;
    const selected = ranked.find(o => o.coinId === value);
    return selected ? [...top.slice(0, PINNED_COUNT - 1), selected] : top;
  }, [ranked, value]);
  const overflowCount = options.length - pinned.length;

  const trimmedQuery = query.trim().toLowerCase();
  const menuItems = useMemo(
    () => (trimmedQuery
      ? ranked.filter(o => o.symbol.toLowerCase().includes(trimmedQuery) || o.name.toLowerCase().includes(trimmedQuery))
      : ranked),
    [ranked, trimmedQuery],
  );

  const open = position !== null;

  function openMenu(): void {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ left: rect.left, flipUp: rect.top > window.innerHeight / 2, anchorTop: rect.top, anchorBottom: rect.bottom });
    setQuery('');
    setActiveIndex(0);
  }

  function closeMenu(): void {
    setPosition(null);
    setQuery('');
  }

  function selectFromMenu(coinId: string): void {
    onChange(coinId);
    closeMenu();
  }

  function togglePinned(choice: CompareAssetOption | null): void {
    if (!choice) { onChange(null); return; }
    onChange(value === choice.coinId ? null : choice.coinId);
  }

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onDocPointerDown(e: MouseEvent): void {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) closeMenu();
    }
    document.addEventListener('mousedown', onDocPointerDown);
    return () => document.removeEventListener('mousedown', onDocPointerDown);
  }, [open]);

  useEffect(() => {
    if (activeIndex >= menuItems.length) setActiveIndex(Math.max(0, menuItems.length - 1));
  }, [menuItems.length, activeIndex]);

  function handleMenuKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape') { closeMenu(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, menuItems.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (menuItems[activeIndex]) selectFromMenu(menuItems[activeIndex].coinId); }
  }

  const pinnedChoices: (CompareAssetOption | null)[] = [null, ...pinned];
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleChipKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number): void {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= pinnedChoices.length) return;
    e.preventDefault();
    togglePinned(pinnedChoices[nextIndex]);
    chipRefs.current[nextIndex]?.focus();
  }

  if (options.length < 2) return null;

  return (
    <div className="compare-control" ref={wrapRef}>
      <span className="compare-control-label">{t.profit_compareWith}</span>
      <div role="radiogroup" aria-label={t.profit_compareWith} className="compare-control-chips">
        {pinnedChoices.map((choice, i) => {
          const selected = choice ? value === choice.coinId : value === null;
          return (
            <button
              key={choice?.coinId ?? 'none'}
              ref={el => { chipRefs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={choice ? choice.symbol : t.profit_compareNone}
              className={`compare-chip${choice ? '' : ' compare-chip-none'}${selected ? ' on' : ''}`}
              onClick={() => togglePinned(choice)}
              onKeyDown={e => handleChipKeyDown(e, i)}
            >
              {choice && <span className="compare-chip-dot" style={{ background: choice.color }} />}
              {choice ? choice.symbol : t.profit_compareNone}
            </button>
          );
        })}
        {overflowCount > 0 && (
          <button
            ref={triggerRef}
            type="button"
            className="compare-chip compare-chip-more"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => (open ? closeMenu() : openMenu())}
          >
            {t.profit_compareMore.replace('{count}', String(overflowCount))} <span className="compare-chip-caret">▾</span>
          </button>
        )}
      </div>
      {open && position && createPortal(
        <div
          className={`compare-menu${position.flipUp ? ' flip-up' : ''}`}
          style={{
            left: position.left,
            top: position.flipUp ? undefined : position.anchorBottom + 6,
            bottom: position.flipUp ? window.innerHeight - position.anchorTop + 6 : undefined,
          }}
        >
          <div className="compare-menu-search">
            <i className="ti ti-search" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              placeholder={t.profit_assetsList_searchPlaceholder}
              aria-label={t.profit_assetsList_searchAriaLabel}
              onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
              onKeyDown={handleMenuKeyDown}
            />
          </div>
          <div className="compare-menu-rows" role="listbox" aria-label={t.profit_compareWith}>
            {menuItems.length === 0 && <div className="compare-menu-empty">{t.profit_assetsList_emptySearch}</div>}
            {menuItems.map((o, i) => (
              <div
                key={o.coinId}
                role="option"
                aria-selected={o.coinId === value}
                className={`compare-menu-row${i === activeIndex ? ' active' : ''}${o.coinId === value ? ' selected' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => selectFromMenu(o.coinId)}
              >
                <span className="compare-menu-dot" style={{ background: o.color }} />
                <span className="compare-menu-symbol">{o.symbol}</span>
                <span className={o.pctChange >= 0 ? 'pos' : 'neg'}>{fmtPct(o.pctChange)}</span>
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

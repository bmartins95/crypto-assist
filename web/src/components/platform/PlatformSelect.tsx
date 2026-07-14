import { useEffect, useMemo, useRef, useState } from 'react';
import type { Platform, PlatformKind } from '@/lib/types';
import { useLocale } from '@/context/LocaleContext';
import { usePlatformCatalog } from './usePlatformCatalog';
import PlatformLogo from './PlatformLogo';
import { slugify } from './platformAvatar';

interface Props {
  id: string;
  value: Platform | null;
  onChange: (platform: Platform | null) => void;
  // Restricts the picker to this fixed list (e.g. only platforms the user holds
  // assets on, for the Trade "from" side) instead of the full catalog — also
  // disables the "add as custom" row, since a platform outside this list can't
  // be a valid choice regardless of what the user types.
  options?: Platform[];
}

// 'custom' only ever shows up via a restricted `options` list (a held platform
// the user typed in freehand before it existed in the catalog) — the
// unrestricted catalog from usePlatformCatalog() never contains one.
const CATEGORY_ORDER: PlatformKind[] = ['exchange', 'wallet', 'defi', 'custom'];

export default function PlatformSelect({ id, value, onChange, options }: Props) {
  const { t } = useLocale();
  const { catalog: fullCatalog, recent: allRecent, addRecent } = usePlatformCatalog();
  const catalog = options ?? fullCatalog;
  const recent = options ? allRecent.filter(p => options.some(o => o.id === p.id)) : allRecent;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDocPointerDown);
    return () => document.removeEventListener('mousedown', onDocPointerDown);
  }, [open]);

  const categoryLabel: Record<PlatformKind, string> = {
    exchange: t.platform_group_exchanges,
    wallet: t.platform_group_wallets,
    defi: t.platform_group_defi,
    custom: t.platform_kind_custom,
  };

  const trimmedQuery = query.trim();
  const filtered = useMemo(
    () => (trimmedQuery ? catalog.filter(p => p.name.toLowerCase().includes(trimmedQuery.toLowerCase())) : catalog),
    [catalog, trimmedQuery]
  );
  const exactMatch = filtered.some(p => p.name.toLowerCase() === trimmedQuery.toLowerCase());
  const showCustomRow = !options && trimmedQuery.length > 0 && !exactMatch;

  const groups = useMemo(() => {
    const g: { key: string; label: string; items: Platform[] }[] = [];
    if (!trimmedQuery && recent.length > 0) {
      g.push({ key: 'recent', label: t.platform_group_recent, items: recent });
    }
    for (const kind of CATEGORY_ORDER) {
      const items = filtered.filter(p => p.kind === kind);
      if (items.length > 0) g.push({ key: kind, label: categoryLabel[kind], items });
    }
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, trimmedQuery, recent, t]);

  const flatItems = useMemo(() => groups.flatMap(g => g.items), [groups]);
  const totalItems = flatItems.length + (showCustomRow ? 1 : 0);

  useEffect(() => {
    if (highlighted >= totalItems) setHighlighted(Math.max(0, totalItems - 1));
  }, [totalItems, highlighted]);

  function openDropdown(): void {
    setOpen(true);
    setHighlighted(0);
  }

  function selectPlatform(p: Platform): void {
    onChange(p);
    addRecent(p.id);
    setQuery('');
    setOpen(false);
  }

  function selectCustom(): void {
    if (!trimmedQuery) return;
    const custom: Platform = { id: `custom:${slugify(trimmedQuery)}`, name: trimmedQuery, kind: 'custom' };
    onChange(custom);
    setQuery('');
    setOpen(false);
  }

  function clearSelection(): void {
    onChange(null);
    setQuery('');
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted < flatItems.length) selectPlatform(flatItems[highlighted]);
      else if (showCustomRow) selectCustom();
    }
  }

  const displayValue = open ? query : (value?.name ?? query);
  const showInlineLogo = !open && !!value;
  const activeDescendant = open && highlighted < totalItems ? `${id}-opt-${highlighted}` : undefined;

  return (
    <div className="search-wrap" ref={wrapRef}>
      {showInlineLogo && value && (
        <span className="sel-logo"><PlatformLogo platform={value} size="sm" /></span>
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={activeDescendant}
        className={showInlineLogo ? 'inp withlogo' : 'inp'}
        placeholder={t.platform_search_placeholder}
        value={displayValue}
        onFocus={openDropdown}
        onChange={e => { setQuery(e.target.value); setOpen(true); setHighlighted(0); }}
        onKeyDown={handleKeyDown}
      />
      {value && !open && (
        <button
          type="button"
          className="icon-btn plat-clear"
          aria-label={t.common_clear}
          onClick={clearSelection}
        >
          <i className="ti ti-x" />
        </button>
      )}
      {open && (
        <div className="dd" id={`${id}-listbox`} role="listbox">
          {options && flatItems.length === 0 && (
            <div className="search-item" style={{ color: 'var(--text3)', cursor: 'default' }}>
              {t.trade_form_noAssets}
            </div>
          )}
          {groups.map(g => {
            let indexOffset = 0;
            for (const prior of groups) {
              if (prior.key === g.key) break;
              indexOffset += prior.items.length;
            }
            return (
              <div key={g.key}>
                <div className="dd-grp">{g.label}</div>
                {g.items.map((p, i) => {
                  const flatIndex = indexOffset + i;
                  return (
                    <div
                      key={`${g.key}-${p.id}`}
                      id={`${id}-opt-${flatIndex}`}
                      role="option"
                      aria-selected={flatIndex === highlighted}
                      className="dd-item"
                      style={flatIndex === highlighted ? { background: 'var(--s-surface-hover)' } : undefined}
                      onMouseEnter={() => setHighlighted(flatIndex)}
                      onClick={() => selectPlatform(p)}
                    >
                      <PlatformLogo platform={p} size="sm" />
                      <span className="meta">
                        <div className="n">{p.name}</div>
                        {p.subtitle && <div className="s">{p.subtitle}</div>}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {showCustomRow && (
            <div
              id={`${id}-opt-${flatItems.length}`}
              role="option"
              aria-selected={flatItems.length === highlighted}
              className="dd-custom"
              style={flatItems.length === highlighted ? { background: 'var(--s-surface-hover)' } : undefined}
              onMouseEnter={() => setHighlighted(flatItems.length)}
              onClick={selectCustom}
            >
              <span className="plus">+</span>
              <span className="n">{t.platform_use_custom.replace('{text}', trimmedQuery)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

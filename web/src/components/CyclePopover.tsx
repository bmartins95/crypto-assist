'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Cycle } from '@/lib/types';
import { fmtQty } from '@/lib/format';
import { useLocale } from '@/context/LocaleContext';
import { useCurrency } from '@/context/CurrencyContext';

interface Props {
  cycle: Cycle;
  coinSymbol: string;
}

interface Position {
  left: number;
  flipUp: boolean;
  anchorTop: number;
  anchorBottom: number;
}

// Rendered via a portal to document.body, positioned with `fixed` coordinates computed
// from the trigger's own bounding rect — the History table scrolls horizontally
// (overflow-x: auto), which would otherwise clip a popover confined to its ancestor.
export default function CyclePopover({ cycle, coinSymbol }: Props) {
  const { t, locale } = useLocale();
  const { fmtFromCurrency } = useCurrency();
  const [position, setPosition] = useState<Position | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  const show = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      left: rect.left,
      flipUp: rect.top > window.innerHeight / 2,
      anchorTop: rect.top,
      anchorBottom: rect.bottom,
    });
  };
  const hide = () => setPosition(null);

  useEffect(() => {
    if (!position) return;
    const onDocPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) hide();
    };
    document.addEventListener('mousedown', onDocPointerDown);
    return () => document.removeEventListener('mousedown', onDocPointerDown);
  }, [position]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') hide();
  };

  const currency = cycle.entries[0]?.currency ?? 'BRL';
  const priceOf = (o: Cycle['entries'][number]) => `${fmtQty(o.qty, locale)} @ ${fmtFromCurrency(o.price, o.currency ?? 'BRL')}`;
  const headerText = t.cycle_header.replace('{coin}', coinSymbol).replace('{cycleLabel}', cycle.cycleLabel);

  return (
    <span
      className="cycle-wrap"
      ref={wrapRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onClick={(e) => { e.stopPropagation(); position ? hide() : show(); }}
    >
      <button
        type="button"
        className="cycle-tag"
        aria-label={t.cycle_tag_aria.replace('{cycleLabel}', cycle.cycleLabel)}
        onFocus={show}
        onBlur={hide}
        onKeyDown={handleKeyDown}
      >
        <i className="ti ti-link" /> {cycle.cycleLabel}
      </button>
      {position && createPortal(
        <div
          className={`cycle-popover${position.flipUp ? ' flip-up' : ''}`}
          role="dialog"
          aria-label={headerText}
          style={{
            left: position.left,
            top: position.flipUp ? undefined : position.anchorBottom + 6,
            bottom: position.flipUp ? window.innerHeight - position.anchorTop + 6 : undefined,
          }}
        >
          <div className="cycle-popover-head">
            <span>{headerText}</span>
            <span className={`cycle-badge ${cycle.status}`}>
              {cycle.status === 'partial' ? t.cycle_status_partial : t.cycle_status_closed}
            </span>
          </div>
          {cycle.entries.map(e => (
            <div className="cycle-row" key={e.id}>
              <span>{t.cycle_entry_label}</span>
              <span>{priceOf(e)}</span>
            </div>
          ))}
          {cycle.exits.map(e => (
            <div className="cycle-row" key={e.id}>
              <span>{cycle.exits.length > 1 ? t.cycle_exit_partial_label : t.cycle_exit_label}</span>
              <span>{priceOf(e)}</span>
            </div>
          ))}
          {cycle.qtyRemaining > 0 && (
            <div className="cycle-row">
              <span>{t.cycle_remaining_label}</span>
              <span>{fmtQty(cycle.qtyRemaining, locale)}</span>
            </div>
          )}
          <div className="cycle-row cycle-footer">
            <span>{t.cycle_realized_label}</span>
            <span className={cycle.realizedPnl >= 0 ? 'pnl-pos' : 'pnl-neg'}>{fmtFromCurrency(cycle.realizedPnl, currency)}</span>
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}

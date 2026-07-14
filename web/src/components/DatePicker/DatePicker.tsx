'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/context/LocaleContext';
import { fmtDate } from '@/lib/format';

interface Props {
  id: string;
  value: string; // ISO yyyy-mm-dd, or '' for no date
  onChange: (value: string) => void;
  maxDate?: string; // ISO yyyy-mm-dd — days after this are disabled
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

type FieldPart = 'day' | 'month' | 'year';

const pad = (n: number): string => String(n).padStart(2, '0');
const toISO = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date | null, b: Date | null): boolean => !!a && !!b && a.toDateString() === b.toDateString();

function parseISO(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Field order (day/month/year) and separator for the active locale, derived from
// Intl rather than a hardcoded pt-BR format — so typing and the placeholder match
// each locale's natural date order without a per-locale translation table.
function getFieldOrder(locale: string): FieldPart[] {
  return new Intl.DateTimeFormat(locale)
    .formatToParts(new Date(2000, 0, 2))
    .filter((p): p is Intl.DateTimeFormatPart & { type: FieldPart } => p.type === 'day' || p.type === 'month' || p.type === 'year')
    .map(p => p.type);
}

function getSeparator(locale: string): string {
  const literal = new Intl.DateTimeFormat(locale).formatToParts(new Date(2000, 0, 2)).find(p => p.type === 'literal');
  return literal?.value ?? '/';
}

function buildPlaceholder(order: FieldPart[], sep: string): string {
  return order.map(p => (p === 'day' ? 'dd' : p === 'month' ? 'mm' : 'yyyy')).join(sep);
}

// Parses free-typed text against the locale's field order; rejects anything that
// doesn't round-trip to a real calendar date (e.g. 31/02) rather than silently
// clamping it.
function parseTyped(text: string, order: FieldPart[]): string | null {
  const groups = text.split(/\D+/).filter(Boolean);
  if (groups.length !== 3) return null;
  const map: Partial<Record<FieldPart, number>> = {};
  order.forEach((part, i) => { map[part] = parseInt(groups[i], 10); });
  const { day, month, year } = map;
  if (!day || !month || !year) return null;
  const fullYear = year < 100 ? 2000 + year : year;
  const date = new Date(fullYear, month - 1, day);
  if (date.getFullYear() !== fullYear || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return toISO(date);
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  );
}

function ChevronLeft() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>;
}

function ChevronRight() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>;
}

export default function DatePicker({ id, value, onChange, maxDate, inputRef }: Props) {
  const { locale, t } = useLocale();
  const selected = parseISO(value);
  const max = maxDate ? parseISO(maxDate) : null;
  const today = startOfDay(new Date());

  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => selected ?? today);
  const [focusedDay, setFocusedDay] = useState(() => selected ?? today);
  const [text, setText] = useState(() => (selected ? fmtDate(value, locale) : ''));

  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const ownInputRef = useRef<HTMLInputElement>(null);
  const resolvedInputRef = inputRef ?? ownInputRef;
  const pendingGridFocus = useRef(false);

  const order = getFieldOrder(locale);
  const sep = getSeparator(locale);
  const placeholder = buildPlaceholder(order, sep);

  useEffect(() => {
    setText(selected ? fmtDate(value, locale) : '');
  }, [value, locale]);

  // Outside click both closes the panel and commits whatever was typed — routed
  // through a ref so the listener (subscribed once per `open` toggle) always sees
  // the latest typed text instead of a stale closure from when it was attached.
  const commitTextRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        commitTextRef.current();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocPointerDown);
    return () => document.removeEventListener('mousedown', onDocPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || !pendingGridFocus.current) return;
    pendingGridFocus.current = false;
    const iso = toISO(focusedDay);
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${iso}"]`)?.focus();
  }, [open, focusedDay]);

  const openPanel = () => {
    setView(selected ?? today);
    setFocusedDay(selected ?? today);
    setOpen(true);
  };

  const closePanel = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) resolvedInputRef.current?.focus();
  };

  const commitText = () => {
    if (!text.trim()) {
      if (value) onChange('');
      return;
    }
    const parsed = parseTyped(text, order);
    if (parsed && (!max || parseISO(parsed)! <= max)) {
      onChange(parsed);
      setText(fmtDate(parsed, locale));
    } else {
      setText(selected ? fmtDate(value, locale) : '');
    }
  };
  useEffect(() => { commitTextRef.current = commitText; });

  const selectDate = (d: Date) => {
    if (max && startOfDay(d) > max) return;
    const iso = toISO(d);
    onChange(iso);
    setText(fmtDate(iso, locale));
    closePanel();
  };

  const clear = () => {
    onChange('');
    setText('');
    closePanel();
  };

  const goToday = () => selectDate(today);

  const moveFocus = (deltaDays: number) => {
    const next = new Date(focusedDay);
    next.setDate(next.getDate() + deltaDays);
    setFocusedDay(next);
    if (next.getMonth() !== view.getMonth() || next.getFullYear() !== view.getFullYear()) {
      setView(new Date(next.getFullYear(), next.getMonth(), 1));
    }
    pendingGridFocus.current = true;
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (!open) {
        setView(selected ?? today);
        setFocusedDay(selected ?? today);
        pendingGridFocus.current = true;
        setOpen(true);
      } else {
        moveFocus(e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' ? -7 : 7);
      }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      closePanel(false);
    } else if (e.key === 'Enter' && !open) {
      e.preventDefault();
      commitText();
    }
  };

  const handlePanelKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft': e.preventDefault(); moveFocus(-1); break;
      case 'ArrowRight': e.preventDefault(); moveFocus(1); break;
      case 'ArrowUp': e.preventDefault(); moveFocus(-7); break;
      case 'ArrowDown': e.preventDefault(); moveFocus(7); break;
      case 'PageUp': e.preventDefault(); setView(v => new Date(v.getFullYear(), v.getMonth() - 1, 1)); break;
      case 'PageDown': e.preventDefault(); setView(v => new Date(v.getFullYear(), v.getMonth() + 1, 1)); break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!max || startOfDay(focusedDay) <= max) selectDate(focusedDay);
        break;
      case 'Escape':
        e.preventDefault();
        closePanel();
        break;
      case 'Tab': {
        const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])
          .filter(el => el.tabIndex !== -1);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        break;
      }
    }
  };

  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const daysInPrevMonth = new Date(view.getFullYear(), view.getMonth(), 0).getDate();

  const cells: { date: Date; outside: boolean }[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(view.getFullYear(), view.getMonth() - 1, daysInPrevMonth - i), outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(view.getFullYear(), view.getMonth(), d), outside: false });
  }
  const remainder = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remainder; d++) {
    cells.push({ date: new Date(view.getFullYear(), view.getMonth() + 1, d), outside: true });
  }

  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(view);
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2023, 0, 1 + i)) // Jan 1 2023 was a Sunday
  );

  const titleId = `${id}-cal-title`;

  return (
    <div className={`date-wrap${open ? ' open' : ''}`} ref={wrapRef}>
      <input
        ref={resolvedInputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="inp"
        placeholder={placeholder}
        value={text}
        aria-haspopup="dialog"
        aria-expanded={open}
        onChange={e => setText(e.target.value)}
        onClick={openPanel}
        onBlur={() => { if (!open) commitText(); }}
        onKeyDown={handleInputKeyDown}
      />
      <span className="date-icon" aria-hidden="true">
        <CalendarIcon />
      </span>

      {open && (
        <div
          ref={panelRef}
          className="cal-pop"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          onKeyDown={handlePanelKeyDown}
        >
          <div className="cal-hd">
            <span className="mon" id={titleId}>{monthLabel}</span>
            <div className="navb">
              <button type="button" aria-label={t.date_prevMonth} onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() - 1, 1))}><ChevronLeft /></button>
              <button type="button" aria-label={t.date_nextMonth} onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() + 1, 1))}><ChevronRight /></button>
            </div>
          </div>
          <div className="dows" aria-hidden="true">
            {weekdayLabels.map((w, i) => <span key={i}>{w}</span>)}
          </div>
          <div className="days" role="grid" ref={gridRef}>
            {cells.map(({ date, outside }) => {
              const disabled = outside || (!!max && startOfDay(date) > max);
              const isToday = sameDay(date, today);
              const isSelected = sameDay(date, selected);
              const isFocused = sameDay(date, focusedDay);
              const cls = ['day'];
              if (outside) cls.push('out');
              if (isToday) cls.push('today');
              if (isSelected) cls.push('selected');
              return (
                <button
                  key={toISO(date)}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  data-date={toISO(date)}
                  className={cls.join(' ')}
                  disabled={disabled}
                  tabIndex={isFocused ? 0 : -1}
                  onClick={() => selectDate(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="cal-ft">
            <button type="button" className="lnk" onClick={clear}>{t.date_clear}</button>
            <button type="button" className="lnk accent" onClick={goToday}>{t.date_today}</button>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useLocale } from '@/context/LocaleContext';

interface Badge {
  content: React.ReactNode;
  variant: 'fetching' | 'auto' | 'manual';
}

interface Props {
  id: string;
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  readOnly?: boolean;
  showStepper?: boolean;
  step?: number;
  min?: number;
  max?: number;
  hint?: React.ReactNode;
  badge?: Badge;
  error?: boolean;
}

export default function NumericField({
  id, value, onChange, label, placeholder,
  prefix, suffix, readOnly = false,
  showStepper = false, step = 1, min, max, hint, badge, error = false,
}: Props) {
  const { t } = useLocale();

  const clamp = (n: number): number => {
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    return n;
  };
  const bump = (dir: 1 | -1) => {
    const n = clamp((parseFloat(value) || 0) + dir * step);
    onChange(String(n));
  };

  const inpClass = ['inp', prefix && 'has-pre', suffix && 'has-suf', badge && 'has-badge', error && 'err'].filter(Boolean).join(' ');
  const affixRef = useRef<HTMLSpanElement>(null);
  const [prefixPadding, setPrefixPadding] = useState<number>();
  // Measures the affix's actual rendered width (real font, weight, locale symbol —
  // "US$" vs "€" vs "R$") rather than estimating from character count. A per-char
  // pixel guess matched a generic fallback font in isolated testing but was too
  // narrow for the app's real font (Inter), so "US$" still clipped into the
  // digits in production despite passing that check.
  useLayoutEffect(() => {
    const measure = () => setPrefixPadding(prefix && affixRef.current ? affixRef.current.offsetWidth + 12 + 6 : undefined);
    measure();
    // Inter loads asynchronously (Google Fonts, `index.html`) — the very first
    // measurement above often runs against the browser's fallback font, which
    // rendered "US$" narrower than Inter does. Without this, that first
    // (too-narrow) measurement stuck permanently once Inter swapped in, still
    // clipping the digits despite the measurement approach in principle being
    // correct.
    if (prefix && typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(measure);
    }
  }, [prefix]);

  return (
    <div className="fld">
      {label && <label htmlFor={id}>{label}</label>}
      <div className={`nf${showStepper ? ' has-step' : ''}`}>
        {prefix && <span ref={affixRef} className="affix pre">{prefix}</span>}
        <input
          id={id} type="number" inputMode="decimal" className={inpClass}
          style={prefixPadding !== undefined ? { paddingLeft: `${prefixPadding}px` } : undefined}
          value={value} placeholder={placeholder} readOnly={readOnly}
          onChange={e => onChange(e.target.value)}
        />
        {suffix && <span className="affix suf">{suffix}</span>}
        {badge && <span className={`badge ${badge.variant}`}>{badge.content}</span>}
        {showStepper && (
          <div className="steps">
            <button type="button" aria-label={t.common_increase} onClick={() => bump(1)}><i className="ti ti-chevron-up" /></button>
            <button type="button" aria-label={t.common_decrease} onClick={() => bump(-1)}><i className="ti ti-chevron-down" /></button>
          </div>
        )}
      </div>
      {hint && <span className="fhint">{hint}</span>}
    </div>
  );
}

'use client';

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
  // Sized to the actual prefix text (currency symbols vary from 1 char, "€", to 3,
  // "US$") instead of one fixed padding — a constant wide enough for "US$" left an
  // awkward gap after "R$" (the app's default currency), and one tight enough for
  // "R$" clipped into "US$"'s digits.
  const prefixPadding = prefix ? `${12 + prefix.length * 7.5 + 6}px` : undefined;

  return (
    <div className="fld">
      {label && <label htmlFor={id}>{label}</label>}
      <div className={`nf${showStepper ? ' has-step' : ''}`}>
        {prefix && <span className="affix pre">{prefix}</span>}
        <input
          id={id} type="number" inputMode="decimal" className={inpClass}
          style={prefixPadding ? { paddingLeft: prefixPadding } : undefined}
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

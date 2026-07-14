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

  return (
    <div className="fld">
      {label && <label htmlFor={id}>{label}</label>}
      <div className={`nf${showStepper ? ' has-step' : ''}`}>
        {prefix && <span className="affix pre">{prefix}</span>}
        <input
          id={id} type="number" inputMode="decimal" className={inpClass}
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

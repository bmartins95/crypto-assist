import { useId, useRef } from 'react';
import { useLocale } from '@/context/LocaleContext';

export interface CompareAssetOption {
  coinId: string;
  symbol: string;
  color: string;
}

interface Props {
  options: CompareAssetOption[];
  value: string | null;
  onChange: (coinId: string | null) => void;
  dayContribution?: Record<string, string>;
}

export default function AssetCompareControl({ options, value, onChange, dayContribution }: Props) {
  const { t } = useLocale();
  const labelId = useId();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const choices: (CompareAssetOption | null)[] = [null, ...options];

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number): void {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= choices.length) return;
    e.preventDefault();
    onChange(choices[nextIndex]?.coinId ?? null);
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="compare-control">
      <span id={labelId} className="compare-control-label">{t.profit_compareWith}</span>
      <div role="radiogroup" aria-labelledby={labelId} className="compare-control-options">
        {choices.map((choice, i) => {
          const selected = choice ? value === choice.coinId : value === null;
          const contribution = choice ? dayContribution?.[choice.coinId] : undefined;
          return (
            <button
              key={choice?.coinId ?? 'none'}
              ref={el => { buttonRefs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={choice ? choice.symbol : t.profit_compareNone}
              className={`${selected ? 'on' : ''}${contribution ? ' compare-control-highlighted' : ''}`}
              style={selected && choice ? { color: choice.color, borderColor: choice.color } : undefined}
              onClick={() => onChange(choice?.coinId ?? null)}
              onKeyDown={e => handleKeyDown(e, i)}
            >
              {choice ? choice.symbol : t.profit_compareNone}
              {contribution && <span className="compare-control-delta">{contribution}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

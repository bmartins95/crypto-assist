import { useRef } from 'react';

export type Timeframe = '1d' | '1w' | '1m' | '1y' | 'all';

const OPTIONS: Timeframe[] = ['1d', '1w', '1m', '1y', 'all'];

interface Props {
  value: Timeframe;
  onChange: (value: Timeframe) => void;
  labels: Record<Timeframe, string>;
}

export default function TimeframeSelector({ value, onChange, labels }: Props) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number): void {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= OPTIONS.length) return;
    e.preventDefault();
    onChange(OPTIONS[nextIndex]);
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="tf">
      {OPTIONS.map((tf, i) => (
        <button
          key={tf}
          ref={el => { buttonRefs.current[i] = el; }}
          type="button"
          className={value === tf ? 'on' : undefined}
          aria-pressed={value === tf}
          onClick={() => onChange(tf)}
          onKeyDown={e => handleKeyDown(e, i)}
        >
          {labels[tf]}
        </button>
      ))}
    </div>
  );
}

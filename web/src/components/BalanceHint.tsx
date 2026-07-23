import { fmtQty } from '@/lib/format';
import { useLocale } from '@/context/LocaleContext';

interface Props {
  qty: number;
  symbol: string;
  over?: boolean;
  onMax: () => void;
  label?: string;
}

export default function BalanceHint({ qty, symbol, over = false, onMax, label }: Props) {
  const { t, locale } = useLocale();
  const text = (label ?? t.balance_available).replace('{qty}', fmtQty(qty, locale)).replace('{symbol}', symbol);
  return (
    <span className={`bal-row${over ? ' err' : ''}`}>
      <span>{text}</span>
      <button type="button" className="max" onClick={onMax}>{t.balance_max}</button>
    </span>
  );
}

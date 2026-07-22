import { fmtQty } from '@/lib/format';
import { useLocale } from '@/context/LocaleContext';

interface Props {
  qty: number;
  symbol: string;
  over?: boolean;
  onMax: () => void;
}

export default function BalanceHint({ qty, symbol, over = false, onMax }: Props) {
  const { t, locale } = useLocale();
  return (
    <span className={`bal-row${over ? ' err' : ''}`}>
      <span>{t.balance_available.replace('{qty}', fmtQty(qty, locale)).replace('{symbol}', symbol)}</span>
      <button type="button" className="max" onClick={onMax}>{t.balance_max}</button>
    </span>
  );
}

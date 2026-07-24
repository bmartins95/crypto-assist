'use client';

import type { Currency } from '@crypto-assist/shared';
import { currencySymbol } from '@crypto-assist/shared';
import { useCurrency } from '@/context/CurrencyContext';
import { useLocale } from '@/context/LocaleContext';
import NumericField from './NumericField';

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
  readOnly?: boolean;
  showStepper?: boolean;
  step?: number;
  min?: number;
  max?: number;
  hint?: React.ReactNode;
  badge?: Badge;
  error?: boolean;
  // Overrides the app's currently-selected display currency — for a value already
  // fixed in a specific currency (e.g. editing a past operation), where the prefix
  // must reflect that value's own currency, not whatever Settings has since switched
  // to. Defaults to the ambient CurrencyContext currency when omitted.
  currency?: Currency;
}

export default function MoneyField({ currency, ...props }: Props): React.ReactElement {
  const { currency: selectedCurrency } = useCurrency();
  const { locale } = useLocale();
  const prefix = currencySymbol(currency ?? selectedCurrency, locale);
  return <NumericField {...props} prefix={prefix} />;
}

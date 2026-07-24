import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WalletSkeleton from './WalletSkeleton';
import { LocaleProvider } from '@/context/LocaleContext';
import { CurrencyProvider } from '@/context/CurrencyContext';

function renderSkeleton() {
  return render(<LocaleProvider><CurrencyProvider><WalletSkeleton /></CurrencyProvider></LocaleProvider>);
}

describe('WalletSkeleton', () => {
  it('shows a currency symbol next to the exit-price placeholder, matching WalletTab\'s real cell', () => {
    // Reproduces a real bug: WalletTab's exit-price cell was given a currency
    // symbol (fix: "label the exit-price input with the selected currency"),
    // but this skeleton was never updated to match — its placeholder cell had
    // no symbol at all, so the loading state visibly differed from real content.
    renderSkeleton();
    expect(screen.getAllByText('R$').length).toBeGreaterThan(0);
  });
});

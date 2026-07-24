import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MoneyField from './MoneyField';
import { LocaleProvider } from '@/context/LocaleContext';
import { CurrencyProvider } from '@/context/CurrencyContext';

beforeEach(() => {
  localStorage.setItem('crypto-assist:exchange-rates', JSON.stringify({ BRL: 1, USD: 1, EUR: 1, GBP: 1, JPY: 1 }));
});

function renderField(ui: React.ReactElement, currency: string) {
  localStorage.setItem('crypto-assist:currency', currency);
  return render(<LocaleProvider><CurrencyProvider>{ui}</CurrencyProvider></LocaleProvider>);
}

describe('MoneyField', () => {
  it('prefixes with the app-wide selected currency symbol by default', () => {
    renderField(<MoneyField id="price" label="Preço" value="" onChange={vi.fn()} />, 'BRL');
    const affix = document.querySelector('.affix.pre');
    expect(affix).toHaveTextContent('R$');
  });

  it('reflects a switch to USD without any other prop changing', () => {
    renderField(<MoneyField id="price" label="Preço" value="" onChange={vi.fn()} />, 'USD');
    const affix = document.querySelector('.affix.pre');
    expect(affix).toHaveTextContent('US$');
  });

  it('overrides the ambient currency when an explicit currency prop is given', () => {
    // Editing a past operation must show the symbol of the currency it was actually
    // recorded in, not whatever the user has since switched Settings to.
    renderField(<MoneyField id="price" label="Preço" value="" onChange={vi.fn()} currency="EUR" />, 'USD');
    const affix = document.querySelector('.affix.pre');
    expect(affix).toHaveTextContent('€');
  });

  it('forwards value changes like a plain NumericField', () => {
    const onChange = vi.fn();
    renderField(<MoneyField id="price" label="Preço" value="" onChange={onChange} />, 'BRL');
    fireEvent.change(screen.getByLabelText('Preço'), { target: { value: '42' } });
    expect(onChange).toHaveBeenCalledWith('42');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NumericField from './NumericField';
import { LocaleProvider } from '@/context/LocaleContext';

function renderField(ui: React.ReactElement) {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

describe('NumericField', () => {
  it('renders a labeled number input with no native spinner class hooks needed', () => {
    renderField(<NumericField id="qty" label="Quantidade" value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText('Quantidade');
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('inputmode', 'decimal');
  });

  it('calls onChange with the new value when typed into', () => {
    const onChange = vi.fn();
    renderField(<NumericField id="qty" label="Quantidade" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith('3');
  });

  it('renders no affix by default', () => {
    renderField(<NumericField id="qty" label="Quantidade" value="" onChange={vi.fn()} />);
    expect(document.querySelector('.affix')).not.toBeInTheDocument();
  });

  it('renders a prefix affix when provided', () => {
    renderField(<NumericField id="price" label="Preço" value="" onChange={vi.fn()} prefix="R$" />);
    const affix = document.querySelector('.affix.pre');
    expect(affix).toHaveTextContent('R$');
    expect(screen.getByLabelText('Preço')).toHaveClass('has-pre');
  });

  it('widens the input\'s left padding to match the affix\'s actual rendered width', () => {
    // Reproduces a real bug found live on prod: a per-character pixel estimate
    // ("US$".length * 7.5px) matched a generic fallback font in isolated
    // testing but was too narrow for the app's real font (Inter) — "US$" still
    // clipped into the digits in production despite passing that estimate.
    // Padding must be measured from the affix's real rendered width, not guessed.
    const offsetWidthSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
      .mockImplementation(function (this: HTMLElement) { return (this.textContent?.length ?? 0) * 10; });
    renderField(<NumericField id="short" label="Curto" value="" onChange={vi.fn()} prefix="R$" />);
    renderField(<NumericField id="long" label="Longo" value="" onChange={vi.fn()} prefix="US$" />);
    const shortPadding = parseFloat((screen.getByLabelText('Curto') as HTMLElement).style.paddingLeft);
    const longPadding = parseFloat((screen.getByLabelText('Longo') as HTMLElement).style.paddingLeft);
    expect(longPadding).toBeGreaterThan(shortPadding);
    expect(longPadding).toBe(3 * 10 + 12 + 6);
    offsetWidthSpy.mockRestore();
  });

  it('renders a suffix affix when provided', () => {
    renderField(<NumericField id="qty" label="Quantidade" value="" onChange={vi.fn()} suffix="SOL" />);
    const affix = document.querySelector('.affix.suf');
    expect(affix).toHaveTextContent('SOL');
    expect(screen.getByLabelText('Quantidade')).toHaveClass('has-suf');
  });

  it('renders no suffix affix when the suffix is undefined (e.g. no asset picked yet)', () => {
    renderField(<NumericField id="qty" label="Quantidade" value="" onChange={vi.fn()} suffix={undefined} />);
    expect(document.querySelector('.affix.suf')).not.toBeInTheDocument();
  });

  it('marks the input readOnly when readOnly is set', () => {
    renderField(<NumericField id="total" label="Total" value="0.00" onChange={vi.fn()} readOnly />);
    expect(screen.getByLabelText('Total')).toHaveAttribute('readonly');
  });

  it('renders a hint below the field when provided', () => {
    renderField(<NumericField id="total" label="Total" value="0.00" onChange={vi.fn()} hint="Calculado automaticamente" />);
    expect(screen.getByText('Calculado automaticamente')).toBeInTheDocument();
  });

  it('does not render the stepper by default', () => {
    renderField(<NumericField id="qty" label="Quantidade" value="1" onChange={vi.fn()} />);
    expect(document.querySelector('.steps')).not.toBeInTheDocument();
    expect(document.querySelector('.nf')).not.toHaveClass('has-step');
  });

  it('renders and steps correctly when showStepper is enabled', () => {
    const onChange = vi.fn();
    renderField(<NumericField id="qty" label="Quantidade" value="1" onChange={onChange} showStepper step={1} />);
    expect(document.querySelector('.nf')).toHaveClass('has-step');
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar' }));
    expect(onChange).toHaveBeenCalledWith('2');
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir' }));
    expect(onChange).toHaveBeenCalledWith('0');
  });

  it('clamps the stepper to min/max when enabled', () => {
    const onChange = vi.fn();
    renderField(<NumericField id="qty" label="Quantidade" value="10" onChange={onChange} showStepper step={1} max={10} min={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar' }));
    expect(onChange).toHaveBeenCalledWith('10');
  });
});

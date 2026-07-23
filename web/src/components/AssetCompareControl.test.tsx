import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AssetCompareControl from './AssetCompareControl';
import { LocaleProvider } from '@/context/LocaleContext';

const OPTIONS = [
  { coinId: 'bitcoin', symbol: 'BTC', color: '#f97316' },
  { coinId: 'ethereum', symbol: 'ETH', color: '#7c6cf0' },
];

function renderControl(value: string | null, onChange = vi.fn()) {
  render(
    <LocaleProvider>
      <AssetCompareControl options={OPTIONS} value={value} onChange={onChange} />
    </LocaleProvider>
  );
  return onChange;
}

describe('AssetCompareControl', () => {
  it('renders "Nenhum" plus one option per held asset', () => {
    renderControl(null);
    expect(screen.getByRole('radio', { name: 'Nenhum' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'BTC' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'ETH' })).toBeInTheDocument();
  });

  it('defaults to "Nenhum" selected when value is null', () => {
    renderControl(null);
    expect(screen.getByRole('radio', { name: 'Nenhum' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'BTC' })).toHaveAttribute('aria-checked', 'false');
  });

  it('fires onChange with the selected coinId when an option is clicked', () => {
    const onChange = renderControl(null);
    fireEvent.click(screen.getByRole('radio', { name: 'BTC' }));
    expect(onChange).toHaveBeenCalledWith('bitcoin');
  });

  it('fires onChange with null when "Nenhum" is clicked', () => {
    const onChange = renderControl('bitcoin');
    fireEvent.click(screen.getByRole('radio', { name: 'Nenhum' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('moves selection to the next option on ArrowRight and focuses it', () => {
    const onChange = renderControl(null);
    screen.getByRole('radio', { name: 'Nenhum' }).focus();
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Nenhum' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('bitcoin');
    expect(screen.getByRole('radio', { name: 'BTC' })).toHaveFocus();
  });

  it('moves selection to the previous option on ArrowLeft', () => {
    const onChange = renderControl(null);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'BTC' }), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('does nothing on ArrowLeft from the first option or ArrowRight from the last', () => {
    const onChange = renderControl(null);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Nenhum' }), { key: 'ArrowLeft' });
    fireEvent.keyDown(screen.getByRole('radio', { name: 'ETH' }), { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores keys other than the arrow keys', () => {
    const onChange = renderControl(null);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'BTC' }), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the day contribution badge and highlight class when a hovered-day value is provided for an option', () => {
    render(
      <LocaleProvider>
        <AssetCompareControl options={OPTIONS} value={null} onChange={vi.fn()} dayContribution={{ bitcoin: '+R$10,00' }} />
      </LocaleProvider>
    );
    const btc = screen.getByRole('radio', { name: 'BTC' });
    expect(btc.className).toContain('compare-control-highlighted');
    expect(btc.textContent).toContain('+R$10,00');
    expect(screen.getByRole('radio', { name: 'ETH' }).className).not.toContain('compare-control-highlighted');
  });

  it('replaces the prior selection rather than allowing multiple checked options', () => {
    const { rerender } = render(
      <LocaleProvider>
        <AssetCompareControl options={OPTIONS} value="bitcoin" onChange={vi.fn()} />
      </LocaleProvider>
    );
    expect(screen.getByRole('radio', { name: 'BTC' })).toHaveAttribute('aria-checked', 'true');
    rerender(
      <LocaleProvider>
        <AssetCompareControl options={OPTIONS} value="ethereum" onChange={vi.fn()} />
      </LocaleProvider>
    );
    expect(screen.getByRole('radio', { name: 'BTC' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'ETH' })).toHaveAttribute('aria-checked', 'true');
  });
});

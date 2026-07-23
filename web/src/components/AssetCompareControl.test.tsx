import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AssetCompareControl, { CompareAssetOption } from './AssetCompareControl';
import { LocaleProvider } from '@/context/LocaleContext';

const OPTIONS: CompareAssetOption[] = [
  { coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', color: '#f97316', pctChange: 5, allocationPct: 50 },
  { coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', color: '#7c6cf0', pctChange: -2, allocationPct: 50 },
];

// Ranked by |pctChange| desc: BTC(10) > ETH(-8) > SOL(5) > ADA(1) > DOGE(0.5)
// -> pinned = BTC, ETH, SOL; overflow = ADA, DOGE.
const MANY_OPTIONS: CompareAssetOption[] = [
  { coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', color: '#f97316', pctChange: 10, allocationPct: 40 },
  { coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum', color: '#7c6cf0', pctChange: -8, allocationPct: 20 },
  { coinId: 'solana', symbol: 'SOL', name: 'Solana', color: '#2dd4bf', pctChange: 5, allocationPct: 15 },
  { coinId: 'cardano', symbol: 'ADA', name: 'Cardano', color: '#eab308', pctChange: 1, allocationPct: 15 },
  { coinId: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', color: '#94a3b8', pctChange: 0.5, allocationPct: 10 },
];

function renderControl(options = OPTIONS, value: string | null = null, onChange = vi.fn()) {
  render(
    <LocaleProvider>
      <AssetCompareControl options={options} value={value} onChange={onChange} />
    </LocaleProvider>
  );
  return onChange;
}

describe('AssetCompareControl', () => {
  it('renders "Nenhum" plus one chip per held asset when everything fits (<= 3)', () => {
    renderControl();
    expect(screen.getByRole('radio', { name: 'Nenhum' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'BTC' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'ETH' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mais/ })).not.toBeInTheDocument();
  });

  it('renders nothing when there are fewer than 2 assets to compare', () => {
    const { container } = render(
      <LocaleProvider>
        <AssetCompareControl options={[OPTIONS[0]]} value={null} onChange={vi.fn()} />
      </LocaleProvider>
    );
    expect(container.firstChild).toBeNull();
  });

  it('pins only the top 3 movers and shows a "+N mais" chip with the remaining count', () => {
    renderControl(MANY_OPTIONS);
    expect(screen.getByRole('radio', { name: 'BTC' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'ETH' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'SOL' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'ADA' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'DOGE' })).not.toBeInTheDocument();
    expect(screen.getByText('+2 mais')).toBeInTheDocument();
  });

  it('promotes the active selection into the pinned row even when it is not a top mover', () => {
    renderControl(MANY_OPTIONS, 'dogecoin');
    expect(screen.getByRole('radio', { name: 'DOGE' })).toHaveAttribute('aria-checked', 'true');
    // Lowest-ranked pinned (SOL) is dropped to make room.
    expect(screen.queryByRole('radio', { name: 'SOL' })).not.toBeInTheDocument();
    expect(screen.getByText('+2 mais')).toBeInTheDocument();
  });

  it('defaults to "Nenhum" selected when value is null', () => {
    renderControl();
    expect(screen.getByRole('radio', { name: 'Nenhum' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'BTC' })).toHaveAttribute('aria-checked', 'false');
  });

  it('fires onChange with the selected coinId when a pinned chip is clicked', () => {
    const onChange = renderControl();
    fireEvent.click(screen.getByRole('radio', { name: 'BTC' }));
    expect(onChange).toHaveBeenCalledWith('bitcoin');
  });

  it('fires onChange with null when "Nenhum" is clicked', () => {
    const onChange = renderControl(OPTIONS, 'bitcoin');
    fireEvent.click(screen.getByRole('radio', { name: 'Nenhum' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('deselects (fires null) when clicking the already-active pinned chip', () => {
    const onChange = renderControl(OPTIONS, 'bitcoin');
    fireEvent.click(screen.getByRole('radio', { name: 'BTC' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('moves selection to the next chip on ArrowRight and focuses it', () => {
    const onChange = renderControl();
    screen.getByRole('radio', { name: 'Nenhum' }).focus();
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Nenhum' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('bitcoin');
    expect(screen.getByRole('radio', { name: 'BTC' })).toHaveFocus();
  });

  it('moves selection to the previous chip on ArrowLeft', () => {
    const onChange = renderControl();
    fireEvent.keyDown(screen.getByRole('radio', { name: 'BTC' }), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('does nothing on ArrowLeft from the first chip or ArrowRight from the last', () => {
    const onChange = renderControl();
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Nenhum' }), { key: 'ArrowLeft' });
    fireEvent.keyDown(screen.getByRole('radio', { name: 'ETH' }), { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  describe('overflow menu', () => {
    it('opens on "+N mais" click, listing every asset (including pinned ones) sorted by movement', () => {
      renderControl(MANY_OPTIONS);
      fireEvent.click(screen.getByText('+2 mais'));
      const listbox = screen.getByRole('listbox');
      const rows = screen.getAllByRole('option');
      expect(rows.map(r => r.textContent?.replace(/[+\-\d.%]/g, ''))).toEqual(['BTC', 'ETH', 'SOL', 'ADA', 'DOGE']);
      expect(listbox).toBeInTheDocument();
    });

    it('filters rows by ticker or name, case-insensitively', () => {
      renderControl(MANY_OPTIONS);
      fireEvent.click(screen.getByText('+2 mais'));
      fireEvent.change(screen.getByPlaceholderText('Buscar ativo…'), { target: { value: 'card' } });
      expect(screen.getAllByRole('option')).toHaveLength(1);
      expect(screen.getByRole('option').textContent).toContain('ADA');
    });

    it('shows the empty-state message when the search matches nothing', () => {
      renderControl(MANY_OPTIONS);
      fireEvent.click(screen.getByText('+2 mais'));
      fireEvent.change(screen.getByPlaceholderText('Buscar ativo…'), { target: { value: 'doesnotexist' } });
      expect(screen.getByText('Nenhum ativo encontrado')).toBeInTheDocument();
    });

    it('selects a menu row, closes the menu, and promotes it into the pinned row', () => {
      const onChange = renderControl(MANY_OPTIONS);
      fireEvent.click(screen.getByText('+2 mais'));
      fireEvent.click(screen.getByRole('option', { name: /ADA/ }));
      expect(onChange).toHaveBeenCalledWith('cardano');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('marks the currently-selected asset\'s row', () => {
      renderControl(MANY_OPTIONS, 'dogecoin');
      fireEvent.click(screen.getByText('+2 mais'));
      expect(screen.getByRole('option', { name: /DOGE/ })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('option', { name: /BTC/ })).toHaveAttribute('aria-selected', 'false');
    });

    it('closes on Escape without changing the selection', () => {
      const onChange = renderControl(MANY_OPTIONS);
      fireEvent.click(screen.getByText('+2 mais'));
      fireEvent.keyDown(screen.getByPlaceholderText('Buscar ativo…'), { key: 'Escape' });
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('closes on an outside click without changing the selection', () => {
      const onChange = renderControl(MANY_OPTIONS);
      fireEvent.click(screen.getByText('+2 mais'));
      fireEvent.mouseDown(document.body);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('moves the active row with ArrowDown/ArrowUp and selects it on Enter', () => {
      const onChange = renderControl(MANY_OPTIONS);
      fireEvent.click(screen.getByText('+2 mais'));
      const search = screen.getByPlaceholderText('Buscar ativo…');
      fireEvent.keyDown(search, { key: 'ArrowDown' });
      fireEvent.keyDown(search, { key: 'ArrowDown' });
      fireEvent.keyDown(search, { key: 'Enter' });
      // Row 0 = BTC, row 1 = ETH, row 2 = SOL -> two ArrowDowns lands on SOL.
      expect(onChange).toHaveBeenCalledWith('solana');
    });
  });
});

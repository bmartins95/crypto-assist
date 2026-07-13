import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlatformSelect from './PlatformSelect';
import type { Platform } from '@/lib/types';
import { LocaleProvider } from '@/context/LocaleContext';

vi.mock('@/lib/api/client', () => ({
  api: {
    getPlatformExchanges: vi.fn(async () => ({
      exchanges: [{ id: 'binance', name: 'Binance', kind: 'exchange' }],
      updatedAt: '2026-01-01T00:00:00Z',
    })),
  },
}));

function renderSelect(value: Platform | null = null, onChange = vi.fn()) {
  render(<LocaleProvider><PlatformSelect id="p" value={value} onChange={onChange} /></LocaleProvider>);
  return { onChange };
}

const input = () => screen.getByRole('combobox');

describe('PlatformSelect', () => {
  beforeEach(() => localStorage.clear());

  it('opens a grouped dropdown on focus, showing catalog + custom-eligible categories', async () => {
    renderSelect();
    fireEvent.focus(input());
    await waitFor(() => expect(screen.getByText('MetaMask')).toBeInTheDocument());
    expect(screen.getByText('Corretoras')).toBeInTheDocument();
    expect(screen.getByText('Carteiras')).toBeInTheDocument();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('filters results case-insensitively as the user types', async () => {
    renderSelect();
    fireEvent.focus(input());
    await waitFor(() => expect(screen.getByText('Binance')).toBeInTheDocument());
    fireEvent.change(input(), { target: { value: 'meta' } });
    expect(screen.getByText('MetaMask')).toBeInTheDocument();
    expect(screen.queryByText('Binance')).not.toBeInTheDocument();
  });

  it('offers a custom-platform row when no catalog entry matches, as part of the option list', async () => {
    renderSelect();
    fireEvent.focus(input());
    await waitFor(() => expect(screen.getByText('Binance')).toBeInTheDocument());
    fireEvent.change(input(), { target: { value: 'Sodex' } });
    const customRow = screen.getByText('Usar "Sodex" como personalizada');
    expect(customRow.closest('[role="option"]')).toBeInTheDocument();
  });

  it('selecting a catalog result calls onChange and shows the logo inline', async () => {
    const { onChange } = renderSelect();
    fireEvent.focus(input());
    await waitFor(() => expect(screen.getByText('MetaMask')).toBeInTheDocument());
    fireEvent.click(screen.getByText('MetaMask'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'metamask', name: 'MetaMask' }));
  });

  it('selecting the custom row calls onChange with a custom-kind platform', async () => {
    const { onChange } = renderSelect();
    fireEvent.focus(input());
    await waitFor(() => expect(screen.getByText('Binance')).toBeInTheDocument());
    fireEvent.change(input(), { target: { value: 'Sodex' } });
    fireEvent.click(screen.getByText('Usar "Sodex" como personalizada'));
    expect(onChange).toHaveBeenCalledWith({ id: 'custom:sodex', name: 'Sodex', kind: 'custom' });
  });

  it('supports arrow-key navigation and Enter to select, including the custom row', async () => {
    const { onChange } = renderSelect();
    fireEvent.focus(input());
    await waitFor(() => expect(screen.getByText('Binance')).toBeInTheDocument());
    fireEvent.change(input(), { target: { value: 'Sod' } });
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ id: 'custom:sod', name: 'Sod', kind: 'custom' });
  });

  it('closes on Escape without changing the current value', async () => {
    const { onChange } = renderSelect();
    fireEvent.focus(input());
    await waitFor(() => expect(screen.getByText('Binance')).toBeInTheDocument());
    fireEvent.change(input(), { target: { value: 'Sod' } });
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the selected platform name with an inline logo when not open', async () => {
    const metamask: Platform = { id: 'metamask', name: 'MetaMask', kind: 'wallet' };
    renderSelect(metamask);
    expect((input() as HTMLInputElement).value).toBe('MetaMask');
    expect(document.querySelector('.sel-logo')).toBeInTheDocument();
    expect(input()).toHaveClass('withlogo');
  });

  it('clears the field back to no-platform via the clear button', async () => {
    const metamask: Platform = { id: 'metamask', name: 'MetaMask', kind: 'wallet' };
    const { onChange } = renderSelect(metamask);
    fireEvent.click(screen.getByLabelText('Limpar'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('exposes combobox/listbox/option ARIA roles', async () => {
    renderSelect();
    expect(input()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.focus(input());
    await waitFor(() => expect(input()).toHaveAttribute('aria-expanded', 'true'));
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
  });
});

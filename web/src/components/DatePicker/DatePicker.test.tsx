import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DatePicker from './DatePicker';
import { LocaleProvider } from '@/context/LocaleContext';

function renderPicker(props: Partial<React.ComponentProps<typeof DatePicker>> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <LocaleProvider>
      <DatePicker id="drawer-date" value="" onChange={onChange} {...props} />
    </LocaleProvider>
  );
  return { onChange, ...utils };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 13)); // 13 Jul 2026, a Monday
});
afterEach(() => {
  vi.useRealTimers();
});

describe('DatePicker', () => {
  it('shows the dd/mm/yyyy placeholder when empty', () => {
    renderPicker();
    expect(screen.getByPlaceholderText('dd/mm/yyyy')).toBeTruthy();
  });

  it('shows the formatted date when a value is set', () => {
    renderPicker({ value: '2026-07-13' });
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('13/07/2026');
  });

  it('opens the calendar panel on click, closed by default', () => {
    renderPicker();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByPlaceholderText('dd/mm/yyyy'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows the current month with today marked, and selects a day on click', () => {
    const { onChange } = renderPicker({ value: '2026-07-13' });
    fireEvent.click(screen.getByRole('textbox'));
    expect(document.querySelector('.day.today')).toHaveTextContent('13');
    expect(document.querySelector('.day.selected')).toHaveTextContent('13');

    const day10 = screen.getByRole('gridcell', { name: '10' });
    fireEvent.click(day10);
    expect(onChange).toHaveBeenCalledWith('2026-07-10');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('disables future dates and does not select them on click', () => {
    const { onChange } = renderPicker({ value: '2026-07-13', maxDate: '2026-07-13' });
    fireEvent.click(screen.getByRole('textbox'));
    const day20 = screen.getByRole('gridcell', { name: '20' });
    expect(day20).toBeDisabled();
    fireEvent.click(day20);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('navigates months with the prev/next buttons', () => {
    renderPicker({ value: '2026-07-13' });
    fireEvent.click(screen.getByRole('textbox'));
    expect(screen.getByText(/julho de 2026/i)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Próximo mês'));
    expect(screen.getByText(/agosto de 2026/i)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Mês anterior'));
    fireEvent.click(screen.getByLabelText('Mês anterior'));
    expect(screen.getByText(/junho de 2026/i)).toBeTruthy();
  });

  it('clears the value via the "Limpar" footer button', () => {
    const { onChange } = renderPicker({ value: '2026-07-13' });
    fireEvent.click(screen.getByRole('textbox'));
    fireEvent.click(screen.getByText('Limpar'));
    expect(onChange).toHaveBeenCalledWith('');
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
  });

  it('jumps to today via the "Hoje" footer button', () => {
    const { onChange } = renderPicker({ value: '2026-06-01' });
    fireEvent.click(screen.getByRole('textbox'));
    fireEvent.click(screen.getByText('Hoje'));
    expect(onChange).toHaveBeenCalledWith('2026-07-13');
  });

  it('moves the focused day with arrow keys and selects it with Enter', () => {
    const { onChange } = renderPicker({ value: '2026-07-13' });
    const input = screen.getByRole('textbox');
    fireEvent.click(input);
    fireEvent.keyDown(document.querySelector('.cal-pop')!, { key: 'ArrowRight' });
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('2026-07-14');
  });

  it('opens and moves focus into the grid when an arrow key is pressed on the closed input', () => {
    renderPicker({ value: '2026-07-13' });
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(document.activeElement).toHaveAttribute('data-date', '2026-07-13');
  });

  it('closes on Escape and returns focus to the input', () => {
    renderPicker({ value: '2026-07-13' });
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.click(input);
    fireEvent.keyDown(document.querySelector('.cal-pop')!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it('closes on outside click and commits a validly typed date', () => {
    const { onChange } = renderPicker();
    const input = screen.getByRole('textbox');
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: '05/03/2026' } });
    fireEvent.mouseDown(document.body);
    expect(onChange).toHaveBeenCalledWith('2026-03-05');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reverts to the previous value when the typed text does not parse to a real date', () => {
    const { onChange } = renderPicker({ value: '2026-07-13' });
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: '31/02/2026' } });
    fireEvent.mouseDown(document.body);
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('13/07/2026');
  });

  it('rejects a typed date beyond maxDate on commit', () => {
    const { onChange } = renderPicker({ value: '2026-07-13', maxDate: '2026-07-13' });
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: '20/07/2026' } });
    fireEvent.mouseDown(document.body);
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('13/07/2026');
  });

  it('commits a typed date on Enter without opening the panel', () => {
    const { onChange } = renderPicker();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '01/01/2026' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('2026-01-01');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('traps Tab within the panel, wrapping at both ends', () => {
    renderPicker({ value: '2026-07-13' });
    fireEvent.click(screen.getByRole('textbox'));
    const panel = document.querySelector('.cal-pop')!;
    const focusable = Array.from(panel.querySelectorAll<HTMLButtonElement>('button:not([disabled])'))
      .filter(el => el.tabIndex !== -1);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    last.focus();
    fireEvent.keyDown(panel, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    first.focus();
    fireEvent.keyDown(panel, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('exposes dialog and grid ARIA roles', () => {
    renderPicker({ value: '2026-07-13' });
    fireEvent.click(screen.getByRole('textbox'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(screen.getByRole('grid')).toBeTruthy();
    expect(screen.getAllByRole('gridcell').length).toBeGreaterThan(27);
  });
});

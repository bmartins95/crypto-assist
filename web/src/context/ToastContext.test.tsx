import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LocaleProvider } from '@/context/LocaleContext';
import { ToastProvider, useToast } from './ToastContext';

function ToastTrigger() {
  const { showToast } = useToast();
  return (
    <div>
      <button onClick={() => showToast('success', 'First')}>show-first</button>
      <button onClick={() => showToast('error', 'Second')}>show-second</button>
    </div>
  );
}

function renderWithToast() {
  return render(<LocaleProvider><ToastProvider><ToastTrigger /></ToastProvider></LocaleProvider>);
}

describe('ToastContext', () => {
  it('renders nothing when no toast has been shown', () => {
    renderWithToast();
    expect(document.querySelectorAll('.toast')).toHaveLength(0);
  });

  it('shows a toast with the right kind and message', () => {
    renderWithToast();
    fireEvent.click(screen.getByText('show-first'));
    const toast = document.querySelector('.toast')!;
    expect(toast).toHaveClass('toast--success');
    expect(toast).toHaveTextContent('First');
  });

  it('piles a second toast on top of the first instead of replacing it', () => {
    renderWithToast();
    fireEvent.click(screen.getByText('show-first'));
    fireEvent.click(screen.getByText('show-second'));
    const toasts = document.querySelectorAll('.toast');
    expect(toasts).toHaveLength(2);
    expect(toasts[0]).toHaveTextContent('First');
    expect(toasts[1]).toHaveTextContent('Second');
  });

  it('dismissing one toast leaves the others in the stack', () => {
    renderWithToast();
    fireEvent.click(screen.getByText('show-first'));
    fireEvent.click(screen.getByText('show-second'));
    const closeButtons = screen.getAllByRole('button', { name: /fechar|close/i });
    fireEvent.click(closeButtons[0]);
    const remaining = document.querySelectorAll('.toast');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toHaveTextContent('Second');
  });

  it('auto-dismisses each toast independently after its own timeout', () => {
    vi.useFakeTimers();
    renderWithToast();
    fireEvent.click(screen.getByText('show-first'));
    act(() => { vi.advanceTimersByTime(4000); });
    fireEvent.click(screen.getByText('show-second'));
    // First toast's 5s window (started at t=0) has now elapsed (t=5500); the
    // second's (started at t=4000) has only had 1.5s.
    act(() => { vi.advanceTimersByTime(1500); });
    expect(document.querySelectorAll('.toast')).toHaveLength(1);
    expect(document.querySelector('.toast')).toHaveTextContent('Second');
    act(() => { vi.advanceTimersByTime(4000); });
    expect(document.querySelectorAll('.toast')).toHaveLength(0);
    vi.useRealTimers();
  });

  it('throws when useToast is called outside ToastProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ToastTrigger />)).toThrow('useToast must be used within ToastProvider');
    spy.mockRestore();
  });
});

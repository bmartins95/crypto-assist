import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Toast from './Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the message with a status role', () => {
    render(<Toast kind="success" message="Wallet imported successfully." onDismiss={() => {}} closeLabel="Fechar" />);
    const toast = screen.getByRole('status');
    expect(toast.textContent).toContain('Wallet imported successfully.');
  });

  it('applies the success/error kind as a class', () => {
    const { rerender } = render(<Toast kind="success" message="ok" onDismiss={() => {}} closeLabel="Fechar" />);
    expect(screen.getByRole('status').className).toContain('toast--success');

    rerender(<Toast kind="error" message="oops" onDismiss={() => {}} closeLabel="Fechar" />);
    expect(screen.getByRole('status').className).toContain('toast--error');
  });

  it('calls onDismiss when the close button is clicked', () => {
    const onDismiss = vi.fn();
    render(<Toast kind="success" message="ok" onDismiss={onDismiss} closeLabel="Fechar" />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after its timeout', () => {
    const onDismiss = vi.fn();
    render(<Toast kind="success" message="ok" onDismiss={onDismiss} closeLabel="Fechar" />);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('resets the auto-dismiss timer when the message changes', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<Toast kind="success" message="first" onDismiss={onDismiss} closeLabel="Fechar" />);
    vi.advanceTimersByTime(3000);
    rerender(<Toast kind="success" message="second" onDismiss={onDismiss} closeLabel="Fechar" />);
    vi.advanceTimersByTime(3000);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

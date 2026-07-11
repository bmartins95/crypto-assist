import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ErrorState from './ErrorState';

const props = {
  title: 'Não foi possível carregar',
  message: 'Isso está demorando mais que o esperado.',
  retryLabel: 'Tentar novamente',
  retryingLabel: 'Tentando…',
  exitLabel: 'Sair',
};

describe('ErrorState', () => {
  it('renders the title, message, and both actions', () => {
    render(<ErrorState {...props} onRetry={vi.fn()} onExit={vi.fn()} />);
    expect(screen.getByText(props.title)).toBeTruthy();
    expect(screen.getByText(props.message)).toBeTruthy();
    expect(screen.getByRole('button', { name: props.retryLabel })).toBeTruthy();
    expect(screen.getByRole('button', { name: props.exitLabel })).toBeTruthy();
  });

  it('hides the exit button when onExit is omitted', () => {
    render(<ErrorState {...props} onRetry={vi.fn()} />);
    expect(screen.queryByRole('button', { name: props.exitLabel })).toBeNull();
  });

  it('shows the retrying label and disables the button while onRetry is pending', async () => {
    let resolve: () => void = () => undefined;
    const onRetry = vi.fn(() => new Promise<void>(r => { resolve = r; }));
    render(<ErrorState {...props} onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: props.retryLabel }));
    const retryingButton = await screen.findByRole('button', { name: props.retryingLabel });
    expect(retryingButton.hasAttribute('disabled')).toBe(true);

    resolve();
    expect(await screen.findByRole('button', { name: props.retryLabel })).toBeTruthy();
  });

  it('ignores extra clicks while a retry is already in flight', async () => {
    let resolve: () => void = () => undefined;
    const onRetry = vi.fn(() => new Promise<void>(r => { resolve = r; }));
    render(<ErrorState {...props} onRetry={onRetry} />);

    const button = screen.getByRole('button', { name: props.retryLabel });
    fireEvent.click(button);
    await screen.findByRole('button', { name: props.retryingLabel });
    fireEvent.click(screen.getByRole('button', { name: props.retryingLabel }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    resolve();
  });

  it('resets to the idle label after onRetry fails, ready for another attempt', async () => {
    const onRetry = vi.fn(() => Promise.reject(new Error('still down')));
    render(<ErrorState {...props} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: props.retryLabel }));
    expect(await screen.findByRole('button', { name: props.retryLabel })).toBeTruthy();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('calls onExit when the exit button is clicked', () => {
    const onExit = vi.fn();
    render(<ErrorState {...props} onRetry={vi.fn()} onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: props.exitLabel }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('applies the shake class from the first retry onward, not on initial mount', async () => {
    const onRetry = vi.fn(() => Promise.resolve());
    const { container } = render(<ErrorState {...props} onRetry={onRetry} />);
    expect(container.querySelector('.auth-error-icon-shake')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: props.retryLabel }));
    await waitFor(() => expect(container.querySelector('.auth-error-icon-shake')).not.toBeNull());
  });
});

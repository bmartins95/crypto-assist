import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ConfirmSignUpCard from './ConfirmSignUpCard';
import { LocaleProvider } from '@/context/LocaleContext';

vi.mock('./useAuth', () => ({
  confirmSignUp: vi.fn(() => Promise.resolve()),
  resendSignUpCode: vi.fn(() => Promise.resolve()),
}));

function renderCard(props: { onConfirmed?: () => Promise<void>; resendOnMount?: boolean } = {}) {
  render(
    <LocaleProvider>
      <ConfirmSignUpCard
        email="bruno@example.com"
        onConfirmed={props.onConfirmed ?? (() => Promise.resolve())}
        resendOnMount={props.resendOnMount}
      />
    </LocaleProvider>
  );
}

async function elapseResendCooldown() {
  for (let i = 0; i < 40 && screen.queryByText(/reenviar código em \d+s/i); i++) {
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
  }
}

describe('ConfirmSignUpCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('confirms the code and invokes onConfirmed', async () => {
    const { confirmSignUp } = await import('./useAuth');
    const onConfirmed = vi.fn(() => Promise.resolve());
    renderCard({ onConfirmed });
    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await vi.waitFor(() => expect(confirmSignUp).toHaveBeenCalledWith('bruno@example.com', '123456'));
    await vi.waitFor(() => expect(onConfirmed).toHaveBeenCalled());
  });

  it('shows an error for an invalid code', async () => {
    const { confirmSignUp } = await import('./useAuth');
    vi.mocked(confirmSignUp).mockRejectedValueOnce(new Error('CodeMismatchException'));
    renderCard();
    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('shows an error when onConfirmed fails after a valid code', async () => {
    renderCard({ onConfirmed: () => Promise.reject(new Error('signin failed')) });
    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('starts with a countdown that blocks resending', async () => {
    const { resendSignUpCode } = await import('./useAuth');
    renderCard();
    const countdown = screen.getByText(/reenviar código em \d+s/i);
    fireEvent.click(countdown);
    expect(resendSignUpCode).not.toHaveBeenCalled();
  });

  it('resends after the cooldown elapses and restarts it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { resendSignUpCode } = await import('./useAuth');
    renderCard();
    await elapseResendCooldown();
    fireEvent.click(screen.getByText(/^reenviar código$/i));
    await vi.waitFor(() => expect(resendSignUpCode).toHaveBeenCalledWith('bruno@example.com'));
    expect(await screen.findByText(/reenviar código em \d+s/i)).toBeTruthy();
  });

  it('sends a fresh code on mount when resendOnMount is set', async () => {
    const { resendSignUpCode } = await import('./useAuth');
    renderCard({ resendOnMount: true });
    await vi.waitFor(() => expect(resendSignUpCode).toHaveBeenCalledWith('bruno@example.com'));
  });

  it('does not send a code on mount by default', async () => {
    const { resendSignUpCode } = await import('./useAuth');
    renderCard();
    await Promise.resolve();
    expect(resendSignUpCode).not.toHaveBeenCalled();
  });

  it('shows an error when the on-mount resend fails', async () => {
    const { resendSignUpCode } = await import('./useAuth');
    vi.mocked(resendSignUpCode).mockRejectedValueOnce(new Error('LimitExceededException'));
    renderCard({ resendOnMount: true });
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});

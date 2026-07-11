import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SignupScreen from './SignupScreen';
import { LocaleProvider } from '@/context/LocaleContext';

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../useAuth', () => ({
  signUp: vi.fn(() => Promise.resolve()),
  confirmSignUp: vi.fn(() => Promise.resolve()),
  resendSignUpCode: vi.fn(() => Promise.resolve()),
  signIn: vi.fn(() => Promise.resolve()),
}));

function renderScreen() {
  render(
    <LocaleProvider>
      <SignupScreen />
    </LocaleProvider>
  );
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Bruno' } });
  fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'bruno@example.com' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'password123' } });
  fireEvent.change(screen.getByLabelText(/confirmar senha/i), { target: { value: 'password123' } });
}

async function elapseResendCooldown() {
  // The countdown chains one setTimeout per second, each re-armed by a React
  // effect — advancing second by second (with effects flushed in between) is the
  // only way the chain actually progresses under fake timers.
  for (let i = 0; i < 40 && screen.queryByText(/reenviar código em \d+s/i); i++) {
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
  }
}

describe('SignupScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows validation errors for an empty submission', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });

  it('shows an error for an invalid email', () => {
    renderScreen();
    fillValidForm();
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    expect(screen.getByText(/e-mail válido/i)).toBeTruthy();
  });

  it('shows an error for a short password', () => {
    renderScreen();
    fillValidForm();
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    expect(screen.getByText(/pelo menos 8 caracteres/i)).toBeTruthy();
  });

  it('shows an error when passwords do not match', () => {
    renderScreen();
    fillValidForm();
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), { target: { value: 'different1' } });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    expect(screen.getByText(/não coincidem/i)).toBeTruthy();
  });

  it('submits a valid form and shows the confirmation-code step', async () => {
    const { signUp } = await import('../useAuth');
    renderScreen();
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    await vi.waitFor(() =>
      expect(signUp).toHaveBeenCalledWith('Bruno', 'bruno@example.com', 'password123')
    );
    expect(await screen.findByLabelText(/código/i)).toBeTruthy();
  });

  it('shows a specific error when the email is already registered', async () => {
    const { signUp } = await import('../useAuth');
    vi.mocked(signUp).mockRejectedValueOnce(Object.assign(new Error('taken'), { name: 'UsernameExistsException' }));
    renderScreen();
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    expect(await screen.findByText(/já possui uma conta/i)).toBeTruthy();
  });

  it('confirms the code, signs in, and navigates to /wallet', async () => {
    const { confirmSignUp, signIn } = await import('../useAuth');
    renderScreen();
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    await screen.findByLabelText(/código/i);
    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }));
    await vi.waitFor(() => expect(confirmSignUp).toHaveBeenCalledWith('bruno@example.com', '123456'));
    await vi.waitFor(() => expect(signIn).toHaveBeenCalledWith('bruno@example.com', 'password123'));
    await vi.waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/wallet' }));
  });

  it('shows an error for an invalid confirmation code', async () => {
    const { confirmSignUp } = await import('../useAuth');
    vi.mocked(confirmSignUp).mockRejectedValueOnce(new Error('CodeMismatchException'));
    renderScreen();
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    await screen.findByLabelText(/código/i);
    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('shows a countdown instead of the resend link right after signup', async () => {
    const { resendSignUpCode } = await import('../useAuth');
    renderScreen();
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    const countdown = await screen.findByText(/reenviar código em \d+s/i);
    fireEvent.click(countdown);
    expect(resendSignUpCode).not.toHaveBeenCalled();
  });

  it('resends the confirmation code after the cooldown and restarts it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { resendSignUpCode } = await import('../useAuth');
    renderScreen();
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    await screen.findByText(/reenviar código em \d+s/i);

    await elapseResendCooldown();
    fireEvent.click(screen.getByText(/^reenviar código$/i));
    await vi.waitFor(() => expect(resendSignUpCode).toHaveBeenCalledWith('bruno@example.com'));
    expect(await screen.findByText(/reenviar código em \d+s/i)).toBeTruthy();
  });

  it('shows an error when resending the code fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { resendSignUpCode } = await import('../useAuth');
    vi.mocked(resendSignUpCode).mockRejectedValueOnce(new Error('network'));
    renderScreen();
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    await screen.findByText(/reenviar código em \d+s/i);

    await elapseResendCooldown();
    fireEvent.click(screen.getByText(/^reenviar código$/i));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('navigates to /login/email when the back button is clicked', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(navigateMock).toHaveBeenCalledWith({ to: '/login/email' });
  });

  it('navigates to /login/email from the "already have an account" link', () => {
    renderScreen();
    fireEvent.click(screen.getByText(/^entrar$/i));
    expect(navigateMock).toHaveBeenCalledWith({ to: '/login/email' });
  });
});

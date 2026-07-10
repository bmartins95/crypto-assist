import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmailLoginScreen from './EmailLoginScreen';
import { LocaleProvider } from '@/context/LocaleContext';

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../useAuth', () => ({
  signIn: vi.fn(() => Promise.resolve()),
  resetPassword: vi.fn(() => Promise.resolve()),
  confirmResetPassword: vi.fn(() => Promise.resolve()),
}));

function renderScreen() {
  render(
    <LocaleProvider>
      <EmailLoginScreen />
    </LocaleProvider>
  );
}

describe('EmailLoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signs in with the entered email and password, then navigates to /wallet', async () => {
    const { signIn } = await import('../useAuth');
    renderScreen();
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await vi.waitFor(() => expect(signIn).toHaveBeenCalledWith('user@example.com', 'password123'));
    await vi.waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/wallet' }));
  });

  it('never navigates to the Cognito Hosted UI domain when signing in', async () => {
    renderScreen();
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'password123' } });
    const originalHref = window.location.href;
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await vi.waitFor(() => expect(window.location.href).toBe(originalHref));
  });

  it('shows a specific error and preserves the email on wrong password', async () => {
    const { signIn } = await import('../useAuth');
    vi.mocked(signIn).mockRejectedValueOnce(new Error('NotAuthorizedException'));
    renderScreen();
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect((screen.getByLabelText(/e-mail/i) as HTMLInputElement).value).toBe('user@example.com');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('requests a reset code, then confirms a new password', async () => {
    const { resetPassword, confirmResetPassword } = await import('../useAuth');
    renderScreen();
    fireEvent.click(screen.getByText(/esqueci a senha/i));
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar código/i }));
    await vi.waitFor(() => expect(resetPassword).toHaveBeenCalledWith('user@example.com'));

    await screen.findByLabelText(/código/i);
    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText(/nova senha/i), { target: { value: 'newPassword1' } });
    fireEvent.click(screen.getByRole('button', { name: /redefinir senha/i }));
    await vi.waitFor(() =>
      expect(confirmResetPassword).toHaveBeenCalledWith('user@example.com', '123456', 'newPassword1')
    );
    expect(await screen.findByText(/sucesso/i)).toBeTruthy();
  });

  it('shows an error when the reset code is invalid', async () => {
    const { confirmResetPassword } = await import('../useAuth');
    vi.mocked(confirmResetPassword).mockRejectedValueOnce(new Error('CodeMismatchException'));
    renderScreen();
    fireEvent.click(screen.getByText(/esqueci a senha/i));
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar código/i }));
    await screen.findByLabelText(/código/i);

    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: 'bad' } });
    fireEvent.change(screen.getByLabelText(/nova senha/i), { target: { value: 'newPassword1' } });
    fireEvent.click(screen.getByRole('button', { name: /redefinir senha/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('navigates to /signup from the create-account link', () => {
    renderScreen();
    fireEvent.click(screen.getByText(/criar conta/i));
    expect(navigateMock).toHaveBeenCalledWith({ to: '/signup' });
  });

  it('navigates to /login when the back button is clicked', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(navigateMock).toHaveBeenCalledWith({ to: '/login' });
  });

  it('shows a generic error when the reset code request fails', async () => {
    const { resetPassword } = await import('../useAuth');
    vi.mocked(resetPassword).mockRejectedValueOnce(new Error('network'));
    renderScreen();
    fireEvent.click(screen.getByText(/esqueci a senha/i));
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar código/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('returns to the login form from the forgot-confirm back button', async () => {
    renderScreen();
    fireEvent.click(screen.getByText(/esqueci a senha/i));
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar código/i }));
    await screen.findByLabelText(/código/i);
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(await screen.findByRole('button', { name: /^entrar$/i })).toBeTruthy();
  });

  it('returns to the login form after a successful reset', async () => {
    renderScreen();
    fireEvent.click(screen.getByText(/esqueci a senha/i));
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar código/i }));
    await screen.findByLabelText(/código/i);
    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText(/nova senha/i), { target: { value: 'newPassword1' } });
    fireEvent.click(screen.getByRole('button', { name: /redefinir senha/i }));
    await screen.findByText(/sucesso/i);
    fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }));
    expect(await screen.findByLabelText(/senha/i)).toBeTruthy();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginScreen from './LoginScreen';
import { LocaleProvider } from '@/context/LocaleContext';

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../useAuth', () => ({
  signInWithRedirect: vi.fn(() => Promise.resolve()),
}));

function renderScreen() {
  render(
    <LocaleProvider>
      <LoginScreen />
    </LocaleProvider>
  );
}

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Google, Facebook, and e-mail provider buttons', () => {
    renderScreen();
    expect(screen.getByRole('button', { name: /google/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /facebook/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /e-mail/i })).toBeTruthy();
  });

  it('routes to /login/email when the e-mail button is clicked', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /e-mail/i }));
    expect(navigateMock).toHaveBeenCalledWith({ to: '/login/email' });
  });

  it('calls signInWithRedirect("Google") when the Google button is clicked', async () => {
    const { signInWithRedirect } = await import('../useAuth');
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /google/i }));
    await vi.waitFor(() => expect(signInWithRedirect).toHaveBeenCalledWith('Google'));
  });

  it('calls signInWithRedirect("Facebook") when the Facebook button is clicked', async () => {
    const { signInWithRedirect } = await import('../useAuth');
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /facebook/i }));
    await vi.waitFor(() => expect(signInWithRedirect).toHaveBeenCalledWith('Facebook'));
  });

  it('shows an error message when the social redirect fails', async () => {
    const { signInWithRedirect } = await import('../useAuth');
    vi.mocked(signInWithRedirect).mockRejectedValueOnce(new Error('network'));
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /google/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('links the legal line to /terms and /privacy', () => {
    renderScreen();
    expect(screen.getByRole('link', { name: /termos/i }).getAttribute('href')).toBe('/terms');
    expect(screen.getByRole('link', { name: /privacidade/i }).getAttribute('href')).toBe('/privacy');
  });

  it('navigates home when the back button is clicked', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /início/i }));
    expect(navigateMock).toHaveBeenCalledWith({ to: '/' });
  });
});

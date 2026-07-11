import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from './Sidebar';
import { LocaleProvider, useLocale } from '@/context/LocaleContext';

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string } & Record<string, unknown>) => {
    const { activeProps, ...anchorProps } = rest;
    void activeProps;
    return <a href={to} {...anchorProps}>{children}</a>;
  },
  useNavigate: () => navigateMock,
}));

vi.mock('@/auth/useAuth', () => ({
  fetchUserAttributes: vi.fn(() => Promise.resolve({ email: 'user@example.com', name: 'User' })),
  signOut: vi.fn(() => Promise.resolve('done')),
}));

function LocaleSwitcher() {
  const { setLocale } = useLocale();
  return <button onClick={() => setLocale('en-US')}>switch-to-english</button>;
}

function renderSidebar(collapsed = false, onToggle = vi.fn()) {
  render(
    <LocaleProvider>
      <Sidebar collapsed={collapsed} onToggle={onToggle} />
      <LocaleSwitcher />
    </LocaleProvider>
  );
  return onToggle;
}

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the three navigation items with pt-BR labels and targets', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /carteira/i }).getAttribute('href')).toBe('/wallet');
    expect(screen.getByRole('link', { name: /lucro/i }).getAttribute('href')).toBe('/profit');
    expect(screen.getByRole('link', { name: /histórico/i }).getAttribute('href')).toBe('/history');
  });

  it('renders the footer with settings link, logout button, and user chip', async () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /configurações/i }).getAttribute('href')).toBe('/settings');
    expect(screen.getByRole('button', { name: /sair/i })).toBeTruthy();
    expect(await screen.findByText('user@example.com')).toBeTruthy();
    expect(screen.getByText('U')).toBeTruthy();
  });

  it('exposes tooltip labels via data-tip on every nav item', () => {
    renderSidebar();
    const tips = Array.from(document.querySelectorAll('[data-tip]')).map(el => el.getAttribute('data-tip'));
    expect(tips).toEqual(['Carteira', 'Lucro', 'Histórico', 'Configurações', 'Sair']);
  });

  it('reflects the collapsed state on the toggle button aria-expanded', () => {
    renderSidebar(true);
    const toggle = screen.getByRole('button', { name: /alternar barra lateral/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('reports expanded state when not collapsed', () => {
    renderSidebar(false);
    const toggle = screen.getByRole('button', { name: /alternar barra lateral/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('calls onToggle when the collapse button is clicked', () => {
    const onToggle = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /alternar barra lateral/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('signs out and navigates home after a local (email/password) logout', async () => {
    const { signOut } = await import('@/auth/useAuth');
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /sair/i }));
    await vi.waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/' }));
  });

  it('does not navigate when a federated logout is already redirecting', async () => {
    const { signOut } = await import('@/auth/useAuth');
    vi.mocked(signOut).mockResolvedValueOnce('redirecting');
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /sair/i }));
    await vi.waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('shows an error message when sign-out fails', async () => {
    const { signOut } = await import('@/auth/useAuth');
    vi.mocked(signOut).mockRejectedValueOnce(new Error('network'));
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /sair/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('updates all labels immediately when the locale changes', () => {
    renderSidebar();
    fireEvent.click(screen.getByText('switch-to-english'));
    expect(screen.getByRole('link', { name: /wallet/i }).getAttribute('href')).toBe('/wallet');
    expect(screen.getByRole('link', { name: /profit/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /history/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /settings/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /log out/i })).toBeTruthy();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HeroPage from './HeroPage';
import { LocaleProvider } from '@/context/LocaleContext';

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

function renderHero() {
  render(
    <LocaleProvider>
      <HeroPage />
    </LocaleProvider>
  );
}

describe('HeroPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the headline, product preview, and three feature cards', () => {
    renderHero();
    expect(screen.getByText(/clara como nunca/i)).toBeTruthy();
    expect(screen.getByText('Valor atual')).toBeTruthy();
    expect(screen.getByText('Tempo real')).toBeTruthy();
    expect(screen.getByText('Multiplataforma')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /lucro e histórico/i, level: 3 })).toBeTruthy();
  });

  it('routes the primary CTA to /login', () => {
    renderHero();
    fireEvent.click(screen.getByRole('button', { name: /começar agora/i }));
    expect(navigateMock).toHaveBeenCalledWith({ to: '/login' });
  });

  it('routes the secondary CTA to /login/email', () => {
    renderHero();
    fireEvent.click(screen.getByRole('button', { name: /já tenho conta/i }));
    expect(navigateMock).toHaveBeenCalledWith({ to: '/login/email' });
  });

  it('routes the topbar "Entrar" button to /login', () => {
    renderHero();
    fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }));
    expect(navigateMock).toHaveBeenCalledWith({ to: '/login' });
  });
});

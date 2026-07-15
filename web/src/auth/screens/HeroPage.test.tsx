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
    expect(screen.getByText('aqui.')).toHaveClass('auth-em');
    expect(screen.getByText('Valor atual')).toBeTruthy();
    expect(screen.getByText('Tempo real')).toBeTruthy();
    expect(screen.getByText('Multiplataforma')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /lucro e histórico/i, level: 3 })).toBeTruthy();
  });

  it('routes the primary CTA to /login with signup intent', () => {
    renderHero();
    fireEvent.click(screen.getByRole('button', { name: /começar agora/i }));
    expect(navigateMock).toHaveBeenCalledWith({ to: '/login', search: { intent: 'signup' } });
  });

  it('routes the secondary CTA to /login with signin intent', () => {
    renderHero();
    fireEvent.click(screen.getByRole('button', { name: /já tenho conta/i }));
    expect(navigateMock).toHaveBeenCalledWith({ to: '/login', search: { intent: 'signin' } });
  });

  it('routes the topbar "Entrar" button to /login with signin intent', () => {
    renderHero();
    fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }));
    expect(navigateMock).toHaveBeenCalledWith({ to: '/login', search: { intent: 'signin' } });
  });
});

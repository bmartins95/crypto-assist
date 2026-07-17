import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PasswordRequirements from './PasswordRequirements';
import { LocaleProvider } from '@/context/LocaleContext';

function renderWithLocale(password: string) {
  return render(
    <LocaleProvider>
      <PasswordRequirements password={password} />
    </LocaleProvider>
  );
}

describe('PasswordRequirements', () => {
  it('renders nothing for an empty password', () => {
    const { container } = renderWithLocale('');
    expect(container).toBeEmptyDOMElement();
  });

  it('shows all 5 rules with correct met/unmet state for a partially-valid password', () => {
    renderWithLocale('abcdefgh');
    expect(screen.getByText('Mínimo de 8 caracteres').closest('.auth-rule')).toHaveClass('auth-rule-met');
    expect(screen.getByText('Letra maiúscula (A-Z)').closest('.auth-rule')).not.toHaveClass('auth-rule-met');
    expect(screen.getByText('Letra minúscula (a-z)').closest('.auth-rule')).toHaveClass('auth-rule-met');
    expect(screen.getByText('Número (0-9)').closest('.auth-rule')).not.toHaveClass('auth-rule-met');
    expect(screen.getByText('Caractere especial (^ $ * . [ ] etc.)').closest('.auth-rule')).not.toHaveClass('auth-rule-met');
  });

  it('shows the strongest strength label for a fully-valid password', () => {
    renderWithLocale('Abcdefg1!');
    expect(screen.getByText('Forte')).toBeInTheDocument();
  });

  it('shows the weakest strength label for a password meeting few rules', () => {
    renderWithLocale('abc');
    expect(screen.getByText('Fraca')).toBeInTheDocument();
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ContentHeader from './ContentHeader';

describe('ContentHeader', () => {
  it('renders the title and subtitle', () => {
    render(<ContentHeader title="Carteira" subtitle="Cotações em tempo real" />);
    expect(screen.getByText('Carteira')).toBeTruthy();
    expect(screen.getByText('Cotações em tempo real')).toBeTruthy();
  });

  it('renders children in the actions area', () => {
    render(
      <ContentHeader title="Carteira" subtitle="sub">
        <button>Atualizar</button>
      </ContentHeader>
    );
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeTruthy();
  });

  it('renders with no children and no actions area', () => {
    render(<ContentHeader title="Carteira" subtitle="sub" />);
    expect(document.querySelector('.refresh')).toBeNull();
  });
});

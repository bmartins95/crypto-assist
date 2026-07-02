import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricCard from './MetricCard';

describe('MetricCard', () => {
  it('renders the label and value', () => {
    render(<MetricCard label="Investido" value="R$ 100,00" />);
    expect(screen.getByText('Investido')).toBeTruthy();
    expect(screen.getByText('R$ 100,00')).toBeTruthy();
  });

  it('applies the valueColor class when provided', () => {
    render(<MetricCard label="Retorno" value="-10%" valueColor="neg" />);
    expect(screen.getByText('-10%').className).toContain('neg');
  });

  it('omits color classes when not provided', () => {
    render(<MetricCard label="Investido" value="R$ 100,00" />);
    expect(screen.getByText('R$ 100,00').className).toBe('metric-value');
  });

  it('renders without a sub line when not provided', () => {
    render(<MetricCard label="Investido" value="R$ 100,00" />);
    expect(document.querySelector('.metric-sub')).toBeNull();
  });

  it('renders the sub line with its own color when provided', () => {
    render(<MetricCard label="Melhor ativo" value="SOL" sub="+8,52%" subColor="pos" />);
    expect(screen.getByText('+8,52%').className).toContain('pos');
  });
});

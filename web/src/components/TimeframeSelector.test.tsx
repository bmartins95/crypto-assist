import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TimeframeSelector from './TimeframeSelector';

const labels = { '1d': '1D', '1w': '1S', '1m': '1M', '1y': '1A', all: 'Tudo' };

describe('TimeframeSelector', () => {
  it('renders all 5 options with the given labels', () => {
    render(<TimeframeSelector value="1m" onChange={vi.fn()} labels={labels} />);
    expect(screen.getByText('1D')).toBeInTheDocument();
    expect(screen.getByText('1S')).toBeInTheDocument();
    expect(screen.getByText('1M')).toBeInTheDocument();
    expect(screen.getByText('1A')).toBeInTheDocument();
    expect(screen.getByText('Tudo')).toBeInTheDocument();
  });

  it('calls onChange with the clicked option value', () => {
    const onChange = vi.fn();
    render(<TimeframeSelector value="1m" onChange={onChange} labels={labels} />);
    fireEvent.click(screen.getByText('1A'));
    expect(onChange).toHaveBeenCalledWith('1y');
  });

  it('marks the option matching value as aria-pressed', () => {
    render(<TimeframeSelector value="1w" onChange={vi.fn()} labels={labels} />);
    expect(screen.getByText('1S')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('1D')).toHaveAttribute('aria-pressed', 'false');
  });

  it('moves selection to the next option on ArrowRight', () => {
    const onChange = vi.fn();
    render(<TimeframeSelector value="1d" onChange={onChange} labels={labels} />);
    fireEvent.keyDown(screen.getByText('1D'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('1w');
  });

  it('moves selection to the previous option on ArrowLeft', () => {
    const onChange = vi.fn();
    render(<TimeframeSelector value="1w" onChange={onChange} labels={labels} />);
    fireEvent.keyDown(screen.getByText('1S'), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('1d');
  });

  it('ignores keys other than ArrowLeft/ArrowRight', () => {
    const onChange = vi.fn();
    render(<TimeframeSelector value="1m" onChange={onChange} labels={labels} />);
    fireEvent.keyDown(screen.getByText('1M'), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not move past the first option on ArrowLeft', () => {
    const onChange = vi.fn();
    render(<TimeframeSelector value="1d" onChange={onChange} labels={labels} />);
    fireEvent.keyDown(screen.getByText('1D'), { key: 'ArrowLeft' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not move past the last option on ArrowRight', () => {
    const onChange = vi.fn();
    render(<TimeframeSelector value="all" onChange={onChange} labels={labels} />);
    fireEvent.keyDown(screen.getByText('Tudo'), { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });
});

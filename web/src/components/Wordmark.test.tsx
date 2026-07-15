import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Wordmark from './Wordmark';

describe('Wordmark', () => {
  it('renders the datum name with the trailing period', () => {
    render(<Wordmark />);
    const mark = screen.getByText('datum');
    expect(mark).toHaveClass('wordmark');
    expect(mark.querySelector('.wm-dot')).toHaveTextContent('.');
  });

  it('applies the size prop as font size', () => {
    render(<Wordmark size={34} />);
    expect(screen.getByText('datum')).toHaveStyle({ fontSize: '34px' });
  });
});

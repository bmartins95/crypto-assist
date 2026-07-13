import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PlatformLogo from './PlatformLogo';
import type { Platform } from '@/lib/types';

const withLogo: Platform = { id: 'binance', name: 'Binance', kind: 'exchange', logoUrl: 'https://backend/api/platforms/logo/binance' };
const withoutLogo: Platform = { id: 'metamask', name: 'MetaMask', kind: 'wallet' };

describe('PlatformLogo', () => {
  it('renders the logo image when logoUrl is present', () => {
    const { container } = render(<PlatformLogo platform={withLogo} />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', withLogo.logoUrl);
  });

  it('falls back to an initials avatar when logoUrl is absent', () => {
    const { container } = render(<PlatformLogo platform={withoutLogo} />);
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('ME')).toBeInTheDocument();
  });

  it('falls back to an initials avatar when the image fails to load', () => {
    const { container } = render(<PlatformLogo platform={withLogo} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    if (img) fireEvent.error(img);
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('BI')).toBeInTheDocument();
  });

  it('produces the same fallback color for the same name every time', () => {
    const { container: c1 } = render(<PlatformLogo platform={withoutLogo} />);
    const { container: c2 } = render(<PlatformLogo platform={{ ...withoutLogo, id: 'metamask-2' }} />);
    const style1 = c1.querySelector('.plogo')?.getAttribute('style');
    const style2 = c2.querySelector('.plogo')?.getAttribute('style');
    expect(style1).toBe(style2);
  });
});

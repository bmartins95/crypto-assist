import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformChip from './PlatformChip';
import type { Platform } from '@/lib/types';
import { LocaleProvider } from '@/context/LocaleContext';

function renderWithLocale(ui: React.ReactElement) {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

const catalogPlatform: Platform = { id: 'binance', name: 'Binance', kind: 'exchange' };
const customPlatform: Platform = { id: 'custom:sodex', name: 'Sodex', kind: 'custom' };

describe('PlatformChip', () => {
  it('renders the platform name and logo', () => {
    renderWithLocale(<PlatformChip platform={catalogPlatform} />);
    expect(screen.getByText('Binance')).toBeInTheDocument();
  });

  it('shows the custom tag only for custom platforms when requested', () => {
    renderWithLocale(<PlatformChip platform={customPlatform} showCustomTag />);
    expect(screen.getByText('Sodex')).toBeInTheDocument();
    expect(screen.getByText('Personalizada')).toBeInTheDocument();
  });

  it('does not show the custom tag for a catalog platform', () => {
    renderWithLocale(<PlatformChip platform={catalogPlatform} showCustomTag />);
    expect(screen.queryByText('Personalizada')).not.toBeInTheDocument();
  });

  it('does not show the custom tag when showCustomTag is false, even for a custom platform', () => {
    renderWithLocale(<PlatformChip platform={customPlatform} />);
    expect(screen.queryByText('Personalizada')).not.toBeInTheDocument();
  });

  it('applies bold font weight when bold is set', () => {
    renderWithLocale(<PlatformChip platform={catalogPlatform} bold />);
    expect(screen.getByText('Binance')).toHaveStyle({ fontWeight: 600 });
  });
});

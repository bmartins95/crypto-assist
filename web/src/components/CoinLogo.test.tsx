import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CoinLogo from './CoinLogo';

describe('CoinLogo', () => {
  it('renders the image when provided', () => {
    const { container } = render(<CoinLogo image="https://cg.example/bitcoin.png" symbol="BTC" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://cg.example/bitcoin.png');
  });

  it('falls back to the uppercased symbol when no image is given', () => {
    const { container } = render(<CoinLogo image={null} symbol="btc" />);
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('BTC')).toBeInTheDocument();
  });

  it('falls back to the symbol when the image fails to load', () => {
    const { container } = render(<CoinLogo image="https://cg.example/broken.png" symbol="eth" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    if (img) fireEvent.error(img);
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('ETH')).toBeInTheDocument();
  });

  it('applies the sm size class by default', () => {
    const { container } = render(<CoinLogo image={null} symbol="btc" />);
    expect(container.querySelector('.coin')).toHaveClass('coin-sm');
  });

  it('omits the sm class for the md size', () => {
    const { container } = render(<CoinLogo image={null} symbol="btc" size="md" />);
    expect(container.querySelector('.coin')).not.toHaveClass('coin-sm');
  });
});

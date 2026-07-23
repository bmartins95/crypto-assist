import { describe, it, expect } from 'vitest';
import { assetColor } from './assetColor';

describe('assetColor', () => {
  it('returns the same color for the same coinId given the same list', () => {
    const ids = ['bitcoin', 'ethereum', 'solana'];
    expect(assetColor('ethereum', ids)).toBe(assetColor('ethereum', ids));
  });

  it('assigns different colors to different positions in the list', () => {
    const ids = ['bitcoin', 'ethereum'];
    expect(assetColor('bitcoin', ids)).not.toBe(assetColor('ethereum', ids));
  });

  it('cycles the palette once the list is longer than the palette', () => {
    const ids = Array.from({ length: 11 }, (_, i) => `coin-${i}`);
    expect(assetColor('coin-0', ids)).toBe(assetColor('coin-10', ids));
  });

  it('falls back to the first palette color for a coinId not present in the list', () => {
    expect(assetColor('dogecoin', ['bitcoin', 'ethereum'])).toBe(assetColor('bitcoin', ['bitcoin', 'ethereum']));
  });
});

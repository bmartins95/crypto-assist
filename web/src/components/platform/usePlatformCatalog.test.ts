import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePlatformCatalog } from './usePlatformCatalog';

vi.mock('@/lib/api/client', () => ({
  api: { getPlatformExchanges: vi.fn() },
}));

describe('usePlatformCatalog', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('merges the curated seed with fetched exchanges, deduplicated by id', async () => {
    const { api } = await import('@/lib/api/client');
    vi.mocked(api.getPlatformExchanges).mockResolvedValue({
      exchanges: [{ id: 'binance', name: 'Binance', kind: 'exchange' }],
      updatedAt: '2026-01-01T00:00:00Z',
    });
    const { result } = renderHook(() => usePlatformCatalog());
    await waitFor(() => expect(result.current.catalog.some(p => p.id === 'binance')).toBe(true));
    expect(result.current.catalog.some(p => p.id === 'metamask')).toBe(true);
    const ids = result.current.catalog.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tolerates a failed exchange fetch and keeps the seed-only catalog usable', async () => {
    const { api } = await import('@/lib/api/client');
    vi.mocked(api.getPlatformExchanges).mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => usePlatformCatalog());
    await waitFor(() => expect(result.current.catalog.length).toBeGreaterThan(0));
    expect(result.current.catalog.some(p => p.id === 'metamask')).toBe(true);
  });

  it('persists and reads recent platform ids from localStorage', async () => {
    const { api } = await import('@/lib/api/client');
    vi.mocked(api.getPlatformExchanges).mockResolvedValue({ exchanges: [], updatedAt: '2026-01-01T00:00:00Z' });
    const { result } = renderHook(() => usePlatformCatalog());
    await waitFor(() => expect(result.current.catalog.length).toBeGreaterThan(0));

    act(() => result.current.addRecent('metamask'));
    expect(JSON.parse(localStorage.getItem('crypto-assist:recent-platforms') || '[]')).toEqual(['metamask']);

    const { result: result2 } = renderHook(() => usePlatformCatalog());
    await waitFor(() => expect(result2.current.recent.some(p => p.id === 'metamask')).toBe(true));
  });
});

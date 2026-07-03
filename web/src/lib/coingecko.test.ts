import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('coingecko caching', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('caches search results per query and does not refetch for a repeated query', async () => {
    const { searchCoins } = await import('./coingecko');
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue({ json: async () => ({ coins: [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }] }) } as Response);
    const first = await searchCoins('bit', 'key');
    const second = await searchCoins('bit', 'key');
    expect(first).toEqual(second);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('treats search queries as case/whitespace-insensitive for caching', async () => {
    const { searchCoins } = await import('./coingecko');
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue({ json: async () => ({ coins: [] }) } as Response);
    await searchCoins('Bit', 'key');
    await searchCoins(' bit ', 'key');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('fetches the coin list once and shares the in-flight promise across concurrent callers', async () => {
    const { getCoinList } = await import('./coingecko');
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue({ json: async () => ([{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }]) } as Response);
    const [a, b] = await Promise.all([getCoinList('key'), getCoinList('key')]);
    expect(a).toBe(b);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await getCoinList('key');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('allows retrying getCoinList after a failed fetch', async () => {
    const { getCoinList } = await import('./coingecko');
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockRejectedValueOnce(new Error('network down'));
    await expect(getCoinList('key')).rejects.toThrow('network down');
    mockFetch.mockResolvedValueOnce({ json: async () => ([]) } as Response);
    await expect(getCoinList('key')).resolves.toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('filterCoinList ranks an exact symbol match above prefix and substring matches', async () => {
    const { filterCoinList } = await import('./coingecko');
    const list = [
      { id: 'lethe', symbol: 'lth', name: 'Something with eth inside' },
      { id: 'ethereum-classic', symbol: 'etc', name: 'Ethereum Classic' },
      { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
    ];
    const results = filterCoinList(list, 'eth');
    expect(results[0].id).toBe('ethereum');
  });

  it('filterCoinList returns nothing for an empty query', async () => {
    const { filterCoinList } = await import('./coingecko');
    expect(filterCoinList([{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }], '')).toEqual([]);
  });

  it('caches a fetched price briefly, avoiding a duplicate request for the same coin', async () => {
    const { fetchSinglePrice } = await import('./coingecko');
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue({ json: async () => ([{ current_price: 50000 }]) } as Response);
    const first = await fetchSinglePrice('bitcoin', 'key');
    const second = await fetchSinglePrice('bitcoin', 'key');
    expect(first).toBe(50000);
    expect(second).toBe(50000);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not cache a missing price, so the next call retries', async () => {
    const { fetchSinglePrice } = await import('./coingecko');
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue({ json: async () => ([]) } as Response);
    await fetchSinglePrice('unknown-coin', 'key');
    await fetchSinglePrice('unknown-coin', 'key');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

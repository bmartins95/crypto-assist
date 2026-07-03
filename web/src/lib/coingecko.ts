export function cgKey(apiKey: string) {
  return apiKey ? '&x_cg_demo_api_key=' + apiKey : '';
}

export interface CoinSearchResult {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank?: number;
}

const searchCache = new Map<string, CoinSearchResult[]>();

export async function searchCoins(query: string, apiKey: string): Promise<CoinSearchResult[]> {
  const key = query.trim().toLowerCase();
  const cached = searchCache.get(key);
  if (cached) return cached;
  const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}${cgKey(apiKey)}`);
  const d = await r.json();
  const results = (d.coins || []).slice(0, 7);
  searchCache.set(key, results);
  return results;
}

export interface CoinListEntry {
  id: string;
  symbol: string;
  name: string;
}

let coinListPromise: Promise<CoinListEntry[]> | null = null;

// Lazily fetched once per browser session (first call wins); every caller shares
// the same in-flight promise so opening the drawer repeatedly never re-fetches.
export async function getCoinList(apiKey: string): Promise<CoinListEntry[]> {
  if (!coinListPromise) {
    coinListPromise = (async () => {
      const query = apiKey ? `?x_cg_demo_api_key=${apiKey}` : '';
      const r = await fetch(`https://api.coingecko.com/api/v3/coins/list${query}`);
      return r.json();
    })().catch(err => { coinListPromise = null; throw err; });
  }
  return coinListPromise;
}

export function filterCoinList(list: CoinListEntry[], query: string, limit = 7): CoinSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { c: CoinListEntry; score: number }[] = [];
  for (const c of list) {
    const sym = c.symbol.toLowerCase();
    const name = c.name.toLowerCase();
    let score = -1;
    if (sym === q) score = 0;
    else if (sym.startsWith(q)) score = 1;
    else if (name.startsWith(q)) score = 2;
    else if (sym.includes(q) || name.includes(q)) score = 3;
    if (score >= 0) scored.push({ c, score });
  }
  scored.sort((a, b) => a.score - b.score || a.c.name.length - b.c.name.length);
  return scored.slice(0, limit).map(({ c }) => ({ id: c.id, symbol: c.symbol, name: c.name }));
}

export interface MarketCoin {
  id: string;
  current_price: number | null;
  image?: string;
  symbol?: string;
}

export async function fetchMarketPrices(ids: string, apiKey: string): Promise<MarketCoin[]> {
  const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=brl&ids=${ids}${cgKey(apiKey)}`);
  if (!r.ok) throw Object.assign(new Error('http_error'), { status: r.status });
  const d = await r.json();
  if (!Array.isArray(d)) throw new Error('invalid_response');
  return d;
}

interface PriceCacheEntry {
  price: number;
  ts: number;
}

const priceCache = new Map<string, PriceCacheEntry>();
const PRICE_TTL_MS = 60_000;

export async function fetchSinglePrice(coinId: string, apiKey: string): Promise<number | null> {
  const cached = priceCache.get(coinId);
  if (cached && Date.now() - cached.ts < PRICE_TTL_MS) return cached.price;
  const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=brl&ids=${coinId}${cgKey(apiKey)}`);
  const d = await r.json();
  const price = d[0]?.current_price ?? null;
  if (price != null) priceCache.set(coinId, { price, ts: Date.now() });
  return price;
}

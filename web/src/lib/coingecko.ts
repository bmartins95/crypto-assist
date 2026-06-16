export function cgKey(apiKey: string) {
  return apiKey ? '&x_cg_demo_api_key=' + apiKey : '';
}

export interface CoinSearchResult {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank?: number;
}

export async function searchCoins(query: string, apiKey: string): Promise<CoinSearchResult[]> {
  const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}${cgKey(apiKey)}`);
  const d = await r.json();
  return (d.coins || []).slice(0, 7);
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

export async function fetchSinglePrice(coinId: string, apiKey: string): Promise<number | null> {
  const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=brl&ids=${coinId}${cgKey(apiKey)}`);
  const d = await r.json();
  return d[0]?.current_price ?? null;
}

import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import type { Prices } from '../types';

export const pricesRouter = Router();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface PriceCacheRow {
  coin_id: string;
  price_brl: number;
  image_url: string | null;
  updated_at: string;
}

async function fetchFromCoinGecko(ids: string[]): Promise<{ id: string; price: number; image?: string }[]> {
  const apiKey = process.env.COINGECKO_API_KEY;
  const keyParam = apiKey ? `&x_cg_demo_api_key=${apiKey}` : '';
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=brl&ids=${ids.join(',')}${keyParam}`;

  const r = await fetch(url);
  if (!r.ok) throw Object.assign(new Error('coingecko_http_error'), { status: r.status });
  const d = await r.json();
  if (!Array.isArray(d)) throw new Error('coingecko_invalid_response');

  return d
    .filter((coin) => coin.current_price != null)
    .map((coin) => ({ id: coin.id as string, price: coin.current_price as number, image: coin.image as string | undefined }));
}

// GET /api/prices?ids=bitcoin,ethereum — 5-minute cache in the price_cache table
pricesRouter.get('/', async (req, res) => {
  const idsParam = (req.query.ids as string | undefined)?.trim();
  if (!idsParam) {
    res.status(400).json({ error: 'Query param "ids" is required (comma-separated).' });
    return;
  }
  const ids = [...new Set(idsParam.split(',').map((s) => s.trim()).filter(Boolean))];

  const { data: cachedRows, error: cacheError } = await supabaseAdmin
    .from('price_cache')
    .select('*')
    .in('coin_id', ids);

  if (cacheError) {
    res.status(500).json({ error: cacheError.message });
    return;
  }

  const now = Date.now();
  const fresh = new Map<string, PriceCacheRow>();
  for (const row of (cachedRows ?? []) as PriceCacheRow[]) {
    if (now - new Date(row.updated_at).getTime() < CACHE_TTL_MS) {
      fresh.set(row.coin_id, row);
    }
  }

  const staleIds = ids.filter((id) => !fresh.has(id));
  const result: Prices = {};
  for (const [id, row] of fresh) result[id] = Number(row.price_brl);

  if (staleIds.length > 0) {
    try {
      const fetched = await fetchFromCoinGecko(staleIds);
      if (fetched.length > 0) {
        await supabaseAdmin.from('price_cache').upsert(
          fetched.map((c) => ({ coin_id: c.id, price_brl: c.price, image_url: c.image ?? null, updated_at: new Date().toISOString() }))
        );
      }
      for (const c of fetched) result[c.id] = c.price;
    } catch (e) {
      // If CoinGecko fails, still return whatever we had cached (even if
      // stale) instead of failing the whole response.
      for (const id of staleIds) {
        const stale = (cachedRows as PriceCacheRow[] | null)?.find((r) => r.coin_id === id);
        if (stale) result[id] = Number(stale.price_brl);
      }
      const status = (e as { status?: number }).status === 429 ? 429 : undefined;
      if (Object.keys(result).length === 0) {
        res.status(status ?? 502).json({ error: 'Failed to fetch prices from CoinGecko.' });
        return;
      }
    }
  }

  res.json(result);
});

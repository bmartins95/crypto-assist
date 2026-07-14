import { useEffect, useMemo, useState } from 'react';
import type { Platform } from '@/lib/types';
import { PLATFORM_SEED } from '@/lib/types';
import { api } from '@/lib/api/client';

const RECENT_KEY = 'crypto-assist:recent-platforms';
const MAX_RECENT = 4;

function readRecentIds(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    // A corrupt cache entry is equivalent to no recent platforms.
    return [];
  }
}

interface PlatformCatalog {
  catalog: Platform[];
  byId: Record<string, Platform>;
  recent: Platform[];
  addRecent: (platformId: string) => void;
  // Resolves an operation's stored platformId/platformName into a renderable Platform:
  // a catalog hit (has a logo) if still known, else a synthetic `custom`-kind Platform
  // built from the denormalized name (covers real custom platforms and any catalog
  // entry that's since dropped out of the cached exchange list — data-model.md).
  resolveOpPlatform: (platformId?: string, platformName?: string) => Platform | null;
}

export function usePlatformCatalog(): PlatformCatalog {
  const [exchanges, setExchanges] = useState<Platform[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>(() => readRecentIds());

  useEffect(() => {
    let cancelled = false;
    api.getPlatformExchanges()
      .then(payload => {
        if (!cancelled) setExchanges(payload.exchanges);
      })
      .catch(() => {
        // Seed-only catalog (wallets/DeFi) keeps the picker usable when exchanges can't be fetched.
      });
    return () => { cancelled = true; };
  }, []);

  const catalog = useMemo<Platform[]>(() => {
    const byId = new Map<string, Platform>();
    for (const p of PLATFORM_SEED) byId.set(p.id, p);
    for (const p of exchanges) byId.set(p.id, p);
    return [...byId.values()];
  }, [exchanges]);

  const byId = useMemo<Record<string, Platform>>(
    () => Object.fromEntries(catalog.map(p => [p.id, p])),
    [catalog]
  );

  const recent = useMemo<Platform[]>(
    () => recentIds.map(id => byId[id]).filter((p): p is Platform => !!p),
    [recentIds, byId]
  );

  function addRecent(platformId: string): void {
    const next = [platformId, ...recentIds.filter(id => id !== platformId)].slice(0, MAX_RECENT);
    setRecentIds(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }

  function resolveOpPlatform(platformId?: string, platformName?: string): Platform | null {
    if (!platformId || !platformName) return null;
    return byId[platformId] ?? { id: platformId, name: platformName, kind: 'custom' };
  }

  return { catalog, byId, recent, addRecent, resolveOpPlatform };
}

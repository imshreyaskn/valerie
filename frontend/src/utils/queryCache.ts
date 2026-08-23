import { useEffect, useRef, useState, useCallback } from 'react';

// ── Minimal typed query cache ─────────────────────────────────────────────────
// In-flight dedupe + TTL cache for the four hot read models (runs, endpoints,
// findings, weaknesses) that were previously refetched independently by every
// page on every mount. Zero dependencies; invalidation is explicit.

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

export function invalidate(prefix: string): void {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
  notify();
}

async function fetchWithCache<T>(key: string, fetcher: () => Promise<T>, ttlMs: number): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.fetchedAt < ttlMs) return hit.data;

  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const p = fetcher()
    .then((data) => {
      cache.set(key, { data, fetchedAt: Date.now() });
      inFlight.delete(key);
      notify();
      return data;
    })
    .catch((err) => {
      inFlight.delete(key);
      throw err;
    });

  inFlight.set(key, p);
  return p;
}

/**
 * Cached async resource hook.
 *  - dedupes concurrent mounts behind one request
 *  - serves from cache within `ttlMs`
 *  - `refreshKey` bumps force a refetch (e.g. after a mutation)
 */
export function useCachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { ttlMs?: number; refreshKey?: number | string } = {}
): { data: T | null; loading: boolean; error: Error | null; reload: () => void } {
  const { ttlMs = 15_000, refreshKey } = options;
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: Error | null }>(() => {
    const hit = cache.get(key) as CacheEntry<T> | undefined;
    if (hit && Date.now() - hit.fetchedAt < ttlMs) return { data: hit.data, loading: false, error: null };
    return { data: null, loading: true, error: null };
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true }));
    fetchWithCache(key, () => fetcherRef.current(), ttlMs)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: err instanceof Error ? err : new Error(String(err)) }));
  }, [key, ttlMs]);

  useEffect(() => {
    load();
    listeners.add(load);
    return () => {
      listeners.delete(load);
    };
  }, [load, refreshKey]);

  return {
    ...state,
    reload: useCallback(() => {
      cache.delete(key);
      load();
    }, [key, load]),
  };
}

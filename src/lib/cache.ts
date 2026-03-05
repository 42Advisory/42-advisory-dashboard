/** Simple in-memory TTL cache to avoid hammering APIs on every page load. */
const store = new Map<string, { data: unknown; expires: number }>();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return undefined;
  }
  return entry.data as T;
}

export function cacheSet(key: string, data: unknown, ttl = DEFAULT_TTL): void {
  store.set(key, { data, expires: Date.now() + ttl });
}

export async function cached<T>(key: string, fn: () => Promise<T>, ttl = DEFAULT_TTL): Promise<T> {
  const existing = cacheGet<T>(key);
  if (existing !== undefined) return existing;
  const result = await fn();
  cacheSet(key, result, ttl);
  return result;
}

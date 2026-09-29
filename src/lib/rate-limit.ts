import "server-only";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Простой лимитер в памяти процесса — у нас один инстанс, этого достаточно.
export function hit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count++;
  return { ok: b.count <= limit, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
}

export function reset(key: string) {
  buckets.delete(key);
}

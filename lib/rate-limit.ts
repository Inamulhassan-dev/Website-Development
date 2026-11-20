type Bucket = { hits: number[]; blockedUntil?: number };

const buckets = new Map<string, Bucket>();

/**
 * Small in-memory sliding-window limiter. Suitable for a single demo instance;
 * swap for Redis/Upstash when running multiple instances in production.
 */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  if (bucket.blockedUntil && bucket.blockedUntil > now) {
    return { ok: false, retryAfter: Math.ceil((bucket.blockedUntil - now) / 1000) };
  }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    bucket.blockedUntil = now + windowMs;
    buckets.set(key, bucket);
    return { ok: false, retryAfter: Math.ceil(windowMs / 1000) };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (!b.hits.length && (!b.blockedUntil || b.blockedUntil < now)) buckets.delete(k);
    }
  }
  return { ok: true, retryAfter: 0 };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

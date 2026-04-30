/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * Designed for single-process deployments and unit tests. For multi-instance
 * production we'd swap this for Redis — the public surface is intentionally
 * tiny so that swap stays mechanical.
 */

type Bucket = {
  hits: number[];
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export type RateLimitOptions = {
  /** Bucket key — combine the user/IP/feature so different actions don't share. */
  key: string;
  /** Max hits within the window before requests are rejected. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Override the clock for testing. */
  now?: () => number;
};

/**
 * Record a hit and return whether the request is allowed under the limit.
 * The hit is recorded even when the limit is exceeded — this prevents an
 * attacker from "resetting" the window by spamming during the cool-down.
 */
export function rateLimit(opts: RateLimitOptions): RateLimitResult {
  const now = (opts.now ?? Date.now)();
  const cutoff = now - opts.windowMs;

  const existing = buckets.get(opts.key) ?? { hits: [] };
  const recent = existing.hits.filter((t) => t > cutoff);
  recent.push(now);
  buckets.set(opts.key, { hits: recent });

  const count = recent.length;
  const allowed = count <= opts.limit;
  const oldest = recent[0] ?? now;
  const resetAt = oldest + opts.windowMs;
  const remaining = Math.max(0, opts.limit - count);

  return { allowed, remaining, resetAt };
}

/** For tests: clear all buckets, or just one when a key is provided. */
export function resetRateLimit(key?: string) {
  if (key) buckets.delete(key);
  else buckets.clear();
}

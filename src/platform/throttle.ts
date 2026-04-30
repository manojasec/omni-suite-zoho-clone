import { rateLimit } from "@/platform/rate-limit";

/**
 * Throwing wrapper around the in-memory limiter for use in server actions and
 * API routes. Mirrors the per-user, per-action throttle pattern so that hot
 * paths (search, AI replies, chat posts) cannot be hammered by a single user.
 */
export class RateLimitExceededError extends Error {
  constructor(public retryAt: number) {
    super("Too many requests");
    this.name = "RateLimitExceededError";
  }
}

export type ThrottleOptions = {
  feature: string;
  userId: string;
  limit?: number;
  windowMs?: number;
};

export function assertWithinRateLimit(opts: ThrottleOptions): void {
  const result = rateLimit({
    key: `${opts.feature}:${opts.userId}`,
    limit: opts.limit ?? 30,
    windowMs: opts.windowMs ?? 60_000,
  });
  if (!result.allowed) {
    throw new RateLimitExceededError(result.resetAt);
  }
}

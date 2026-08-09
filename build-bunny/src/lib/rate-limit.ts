/**
 * Simple in-memory sliding-window rate limiter (m3 contract). Per-process by
 * design: attempts submission is the only V1 consumer (30/min/student) and a
 * single Next.js instance serves a school's traffic. If the deployment ever
 * scales horizontally this becomes a per-instance soft limit — acceptable for
 * an anti-hammering guard, not a billing meter.
 */

export interface RateLimiter {
  /** True when the call is allowed; false when the key is over its budget. */
  allow(key: string, now?: number): boolean;
  /** Drop all recorded hits (test isolation). */
  reset(): void;
}

export function createRateLimiter(options: {
  /** Max allowed calls per key inside the window. */
  limit: number;
  windowMs: number;
}): RateLimiter {
  const { limit, windowMs } = options;
  const hits = new Map<string, number[]>();

  return {
    allow(key: string, now: number = Date.now()): boolean {
      const cutoff = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);

      // Opportunistic GC: prune keys whose entire window has elapsed so a
      // long-lived process does not accumulate one array per student ever.
      if (hits.size > 10_000) {
        for (const [k, times] of hits) {
          if (times.every((t) => t <= cutoff)) hits.delete(k);
        }
      }
      return true;
    },
    reset(): void {
      hits.clear();
    },
  };
}

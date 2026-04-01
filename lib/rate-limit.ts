/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * Suitable for a single-process internal tool. If this ever runs behind
 * multiple replicas, replace with a Redis-backed implementation.
 *
 * Usage:
 *   const result = rateLimit(req, { windowMs: 60_000, max: 5 });
 *   if (!result.ok) return NextResponse.json(..., { status: 429 });
 */

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  { windowMs, max }: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || now > existing.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { ok: true, remaining: max - 1, resetAt };
  }

  existing.count += 1;
  const remaining = Math.max(0, max - existing.count);
  return {
    ok: existing.count <= max,
    remaining,
    resetAt: existing.resetAt,
  };
}

/**
 * Derive a rate-limit key from a Next.js request.
 * Uses the x-forwarded-for header or the remote address as the IP,
 * combined with a route prefix to namespace per-endpoint limits.
 */
export function rateLimitKey(req: Request, prefix: string): string {
  const forwarded = (req.headers as Headers).get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  return `${prefix}:${ip}`;
}

/**
 * Purge expired windows. Call this on a timer if memory growth is a concern
 * (low-traffic internal tool can skip it).
 */
export function purgeExpiredWindows(): void {
  const now = Date.now();
  for (const [key, window] of store.entries()) {
    if (now > window.resetAt) store.delete(key);
  }
}

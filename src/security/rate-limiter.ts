export interface RateLimiter {
  /** Returns true if the request is allowed (and records the timestamp),
   *  false if the rate limit is exceeded (no timestamp recorded). */
  check(userId: number, category: string, limit: number, windowMs: number): boolean;
}

export class SlidingWindowRateLimiter implements RateLimiter {
  private windows = new Map<string, number[]>();

  check(userId: number, category: string, limit: number, windowMs: number): boolean {
    const key = `${userId}:${category}`;
    const now = Date.now();
    const cutoff = now - windowMs;
    let timestamps = this.windows.get(key) || [];
    timestamps = timestamps.filter((t) => t > cutoff);
    if (timestamps.length >= limit) return false;
    timestamps.push(now);
    this.windows.set(key, timestamps);
    return true;
  }
}

export interface RateLimiter {
  /** Returns true if the request is allowed (and records the timestamp),
   *  false if the rate limit is exceeded (no timestamp recorded). */
  check(userId: number, category: string, limit: number, windowMs: number): boolean;
  /** String-key-based rate limiting (for IP-anchored auth endpoints). */
  checkByKey(key: string, category: string, limit: number, windowMs: number): boolean;
}

export class SlidingWindowRateLimiter implements RateLimiter {
  private windows = new Map<string, number[]>();

  check(userId: number, category: string, limit: number, windowMs: number): boolean {
    return this.checkByKey(String(userId), category, limit, windowMs);
  }

  checkByKey(key: string, category: string, limit: number, windowMs: number): boolean {
    const mapKey = `${key}:${category}`;
    const now = Date.now();
    const cutoff = now - windowMs;
    let timestamps = this.windows.get(mapKey) || [];
    timestamps = timestamps.filter((t) => t > cutoff);
    if (timestamps.length >= limit) return false;
    timestamps.push(now);
    this.windows.set(mapKey, timestamps);
    return true;
  }
}

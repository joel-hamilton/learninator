import type { Context } from "hono";
import type { AppVariables } from "../types.js";
import { rateLimitedFragment } from "./input-limits.js";

/**
 * Factory that returns a Hono middleware which enforces a sliding-window rate
 * limit for a given action.  Must be placed *after* `requireAuth` in the
 * route chain so that `c.get("user")` is populated.
 *
 * When `rateLimiter` is null (test mode / no rate limiter configured) the
 * middleware passes through unconditionally.
 */
export function rateLimit(action: string, max: number, windowMs: number) {
  return async (c: Context<{ Variables: AppVariables }>, next: () => Promise<void>) => {
    const rateLimiter = c.get("rateLimiter");
    if (!rateLimiter) {
      return next();
    }

    const user = c.get("user")!;
    if (!rateLimiter.check(user.id, action, max, windowMs)) {
      c.status(429);
      return c.html(rateLimitedFragment());
    }

    return next();
  };
}

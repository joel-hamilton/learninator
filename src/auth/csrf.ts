import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { AppVariables } from "../types.js";

type CsrfContext = Context<{ Variables: AppVariables }>;

const CSRF_COOKIE = "learninator_csrf";
const CSRF_HEADER = "X-CSRF-Token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_EXEMPT_PATHS = new Set(["/login", "/signup"]);

export async function csrfMiddleware(c: CsrfContext, next: () => Promise<void>) {
  if (SAFE_METHODS.has(c.req.method) || CSRF_EXEMPT_PATHS.has(c.req.path)) {
    await next();
    return;
  }

  const cookieToken = getCookie(c, CSRF_COOKIE);
  const headerToken = c.req.header(CSRF_HEADER);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return c.text("Invalid CSRF token", 403);
  }

  await next();
}

import { Hono } from "hono";
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import type { AppVariables, User } from "../types.js";
import { loginPage, signupPage, loginForm, signupForm } from "../views/auth.js";

type AuthContext = Context<{ Variables: AppVariables }>;

const SESSION_COOKIE = "learninator_sid";
const CSRF_COOKIE = "learninator_csrf";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const SECURE_COOKIE = process.env.NODE_ENV === "production";

function uuidv4(): string {
  return crypto.randomUUID();
}

function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

interface CookieOpts {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  maxAge?: number;
  path?: string;
}

function cookieOpts(overrides: CookieOpts = {}): CookieOpts {
  return {
    httpOnly: true,
    secure: SECURE_COOKIE,
    sameSite: "Lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
    ...overrides,
  };
}

function getClientIP(c: AuthContext): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
    || c.req.header("x-real-ip")
    || "127.0.0.1";
}

const sessionMiddleware = async (c: AuthContext, next: () => Promise<void>) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) {
    c.set("user", null);
    await next();
    return;
  }

  const store = c.get("store");

  // Legacy cookie migration: numeric user ID → UUID session token
  const numericId = parseInt(token, 10);
  if (!isNaN(numericId) && String(numericId) === token) {
    const user = await store.getUser(numericId);
    if (user) {
      const sessionToken = uuidv4();
      const csrfToken = generateCSRFToken();
      const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();
      await store.createSession({
        userId: user.id,
        token: sessionToken,
        csrfToken,
        expiresAt,
      });
      setCookie(c, SESSION_COOKIE, sessionToken, cookieOpts());
      setCookie(c, CSRF_COOKIE, csrfToken, cookieOpts({ httpOnly: false }));
      c.set("user", user as User);
    } else {
      c.set("user", null);
    }
    await next();
    return;
  }

  // New format: UUID session token
  const session = await store.getSessionByToken(token);
  if (session && session.expiresAt > new Date().toISOString()) {
    const user = await store.getUser(session.userId);
    c.set("user", (user as User) || null);
  } else {
    c.set("user", null);
  }
  await next();
};

const requireAuth = async (c: AuthContext, next: () => Promise<void>) => {
  const user = c.get("user");
  if (!user) {
    return c.redirect("/login");
  }
  await next();
};

const authApp = new Hono<{ Variables: AppVariables }>();

authApp.get("/login", (c) => {
  const user = c.get("user");
  if (user) return c.redirect("/");
  return c.html(loginPage());
});

authApp.post("/login", async (c) => {
  const store = c.get("store");
  const body = await c.req.parseBody();
  const email = String(body.email || "").trim();
  const password = String(body.password || "");

  if (!email || !password) {
    return c.html(loginForm(email, "Email and password are required."));
  }

  // Rate limiting
  const rateLimiter = c.get("rateLimiter");
  if (rateLimiter) {
    const ip = getClientIP(c);
    if (!rateLimiter.checkByKey(ip, "login", 10, 60000)) {
      return c.html(loginForm(email, "Too many login attempts. Please try again in a minute."));
    }
  }

  const user = await store.getUserByEmail(email);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return c.html(loginForm(email, "Invalid email or password."));
  }

  // Opportunistic cleanup of expired sessions
  await store.deleteExpiredSessions();

  const sessionToken = uuidv4();
  const csrfToken = generateCSRFToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();
  await store.createSession({ userId: user.id, token: sessionToken, csrfToken, expiresAt });

  setCookie(c, SESSION_COOKIE, sessionToken, cookieOpts());
  setCookie(c, CSRF_COOKIE, csrfToken, cookieOpts({ httpOnly: false }));

  c.header("HX-Redirect", "/");
  return c.body(null);
});

authApp.get("/signup", (c) => {
  const user = c.get("user");
  if (user) return c.redirect("/");
  return c.html(signupPage());
});

authApp.post("/signup", async (c) => {
  const store = c.get("store");
  const body = await c.req.parseBody();
  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  const confirm = String(body.confirm || "");

  if (!email || !password) {
    return c.html(signupForm(email, "All fields are required."));
  }

  if (password !== confirm) {
    return c.html(signupForm(email, "Passwords do not match."));
  }

  if (password.length < 6) {
    return c.html(signupForm(email, "Password must be at least 6 characters."));
  }

  // Rate limiting
  const rateLimiter = c.get("rateLimiter");
  if (rateLimiter) {
    const ip = getClientIP(c);
    if (!rateLimiter.checkByKey(ip, "signup", 5, 60000)) {
      return c.html(signupForm(email, "Too many signup attempts. Please try again in a minute."));
    }
  }

  const existing = await store.getUserByEmail(email);
  if (existing) {
    return c.html(signupForm(email, "An account with that email already exists."));
  }

  const hash = await bcrypt.hash(password, 10);
  const newUser = await store.createUser({ email, passwordHash: hash });

  const sessionToken = uuidv4();
  const csrfToken = generateCSRFToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();
  await store.createSession({ userId: newUser.id, token: sessionToken, csrfToken, expiresAt });

  setCookie(c, SESSION_COOKIE, sessionToken, cookieOpts());
  setCookie(c, CSRF_COOKIE, csrfToken, cookieOpts({ httpOnly: false }));

  c.header("HX-Redirect", "/");
  return c.body(null);
});

authApp.get("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    await c.get("store").deleteSession(token);
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  deleteCookie(c, CSRF_COOKIE, { path: "/" });
  return c.redirect("/login");
});

export const auth = {
  sessionMiddleware,
  requireAuth,
  authApp,
};

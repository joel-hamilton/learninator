import { Hono } from "hono";
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import type { AppVariables, User } from "../types.js";
import { HTMX_HEAD } from "../views/shared.js";

type AuthContext = Context<{ Variables: AppVariables }>;

const SESSION_COOKIE = "learninator_sid";

const sessionMiddleware = async (c: AuthContext, next: () => Promise<void>) => {
  const userId = getCookie(c, SESSION_COOKIE);
  if (userId) {
    const id = parseInt(userId);
    if (!isNaN(id)) {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, id))
        .limit(1);
      c.set("user", (user as User) || null);
    }
  }
  c.set("user", c.get("user") || null);
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
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Login — Learninator</title>
${HTMX_HEAD}
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #fdfcf9; color: #2d2d2d; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 2.5rem; width: 100%; max-width: 400px; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  .sub { color: #888; font-size: 0.9rem; margin-bottom: 1.5rem; }
  label { display: block; font-size: 0.85rem; font-weight: 500; margin-bottom: 0.25rem; margin-top: 1rem; }
  input { width: 100%; padding: 0.6rem 0.75rem; border: 1px solid #e8e4dc; border-radius: 6px; font-size: 1rem; margin-bottom: 0.5rem; }
  input:focus { outline: none; border-color: #b8a88a; }
  button { width: 100%; padding: 0.7rem; background: #2d2d2d; color: #fff; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; margin-top: 1rem; }
  button:hover { background: #444; }
  .error { background: #fce8e8; color: #8b2e2e; padding: 0.5rem 0.75rem; border-radius: 4px; font-size: 0.85rem; margin-bottom: 0.5rem; }
  .alt-link { text-align: center; margin-top: 1rem; font-size: 0.85rem; color: #888; }
  .alt-link a { color: #2d2d2d; }
</style>
</head>
<body>
<div class="card">
  <h1>Learninator</h1>
  <p class="sub">Sign in to continue learning</p>
  <form hx-post="/login" hx-target="this" hx-swap="outerHTML">
    <label for="email">Email</label>
    <input type="email" name="email" id="email" required>
    <label for="password">Password</label>
    <input type="password" name="password" id="password" required>
    <div id="error"></div>
    <button type="submit">Sign in</button>
  </form>
  <p class="alt-link">Don't have an account? <a href="/signup">Sign up</a></p>
</div>
</body>
</html>`);
});

authApp.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const email = String(body.email || "").trim();
  const password = String(body.password || "");

  if (!email || !password) {
    return c.html(`<form hx-post="/login" hx-target="this" hx-swap="outerHTML">
      <label for="email">Email</label>
      <input type="email" name="email" id="email" value="${email}" required>
      <label for="password">Password</label>
      <input type="password" name="password" id="password" required>
      <div id="error" class="error">Email and password are required.</div>
      <button type="submit">Sign in</button>
    </form>`);
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return c.html(`<form hx-post="/login" hx-target="this" hx-swap="outerHTML">
      <label for="email">Email</label>
      <input type="email" name="email" id="email" value="${email}" required>
      <label for="password">Password</label>
      <input type="password" name="password" id="password" required>
      <div id="error" class="error">Invalid email or password.</div>
      <button type="submit">Sign in</button>
    </form>`);
  }

  setCookie(c, SESSION_COOKIE, String(user.id), {
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  c.header("HX-Redirect", "/");
  return c.body(null);
});

authApp.get("/signup", (c) => {
  const user = c.get("user");
  if (user) return c.redirect("/");
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sign Up — Learninator</title>
${HTMX_HEAD}
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #fdfcf9; color: #2d2d2d; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 2.5rem; width: 100%; max-width: 400px; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  .sub { color: #888; font-size: 0.9rem; margin-bottom: 1.5rem; }
  label { display: block; font-size: 0.85rem; font-weight: 500; margin-bottom: 0.25rem; margin-top: 1rem; }
  input { width: 100%; padding: 0.6rem 0.75rem; border: 1px solid #e8e4dc; border-radius: 6px; font-size: 1rem; margin-bottom: 0.5rem; }
  input:focus { outline: none; border-color: #b8a88a; }
  button { width: 100%; padding: 0.7rem; background: #2d2d2d; color: #fff; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; margin-top: 1rem; }
  button:hover { background: #444; }
  .error { background: #fce8e8; color: #8b2e2e; padding: 0.5rem 0.75rem; border-radius: 4px; font-size: 0.85rem; margin-bottom: 0.5rem; }
  .alt-link { text-align: center; margin-top: 1rem; font-size: 0.85rem; color: #888; }
  .alt-link a { color: #2d2d2d; }
</style>
</head>
<body>
<div class="card">
  <h1>Learninator</h1>
  <p class="sub">Create your account</p>
  <form hx-post="/signup" hx-target="this" hx-swap="outerHTML">
    <label for="email">Email</label>
    <input type="email" name="email" id="email" required>
    <label for="password">Password</label>
    <input type="password" name="password" id="password" required minlength="6">
    <label for="confirm">Confirm password</label>
    <input type="password" name="confirm" id="confirm" required minlength="6">
    <div id="error"></div>
    <button type="submit">Create account</button>
  </form>
  <p class="alt-link">Already have an account? <a href="/login">Sign in</a></p>
</div>
</body>
</html>`);
});

authApp.post("/signup", async (c) => {
  const body = await c.req.parseBody();
  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  const confirm = String(body.confirm || "");

  if (!email || !password) {
    return c.html(`<form hx-post="/signup" hx-target="this" hx-swap="outerHTML">
      <label for="email">Email</label>
      <input type="email" name="email" id="email" value="${email}" required>
      <label for="password">Password</label>
      <input type="password" name="password" id="password" required minlength="6">
      <label for="confirm">Confirm password</label>
      <input type="password" name="confirm" id="confirm" required minlength="6">
      <div id="error" class="error">All fields are required.</div>
      <button type="submit">Create account</button>
    </form>`);
  }

  if (password !== confirm) {
    return c.html(`<form hx-post="/signup" hx-target="this" hx-swap="outerHTML">
      <label for="email">Email</label>
      <input type="email" name="email" id="email" value="${email}" required>
      <label for="password">Password</label>
      <input type="password" name="password" id="password" required minlength="6">
      <label for="confirm">Confirm password</label>
      <input type="password" name="confirm" id="confirm" required minlength="6">
      <div id="error" class="error">Passwords do not match.</div>
      <button type="submit">Create account</button>
    </form>`);
  }

  if (password.length < 6) {
    return c.html(`<form hx-post="/signup" hx-target="this" hx-swap="outerHTML">
      <label for="email">Email</label>
      <input type="email" name="email" id="email" value="${email}" required>
      <label for="password">Password</label>
      <input type="password" name="password" id="password" required minlength="6">
      <label for="confirm">Confirm password</label>
      <input type="password" name="confirm" id="confirm" required minlength="6">
      <div id="error" class="error">Password must be at least 6 characters.</div>
      <button type="submit">Create account</button>
    </form>`);
  }

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existing) {
    return c.html(`<form hx-post="/signup" hx-target="this" hx-swap="outerHTML">
      <label for="email">Email</label>
      <input type="email" name="email" id="email" value="" required>
      <label for="password">Password</label>
      <input type="password" name="password" id="password" required minlength="6">
      <label for="confirm">Confirm password</label>
      <input type="password" name="confirm" id="confirm" required minlength="6">
      <div id="error" class="error">An account with that email already exists.</div>
      <button type="submit">Create account</button>
    </form>`);
  }

  const hash = await bcrypt.hash(password, 10);
  const [newUser] = await db
    .insert(schema.users)
    .values({ email, passwordHash: hash })
    .returning();

  setCookie(c, SESSION_COOKIE, String(newUser.id), {
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  c.header("HX-Redirect", "/");
  return c.body(null);
});

authApp.get("/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.redirect("/login");
});

export const auth = {
  sessionMiddleware,
  requireAuth,
  authApp,
};

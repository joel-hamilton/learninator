import { Hono } from "hono";
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import type { AppVariables, User } from "../types.js";
import { loginPage, signupPage, loginForm, signupForm } from "../views/auth.js";

type AuthContext = Context<{ Variables: AppVariables }>;

const SESSION_COOKIE = "learninator_sid";

const sessionMiddleware = async (c: AuthContext, next: () => Promise<void>) => {
  const userId = getCookie(c, SESSION_COOKIE);
  if (userId) {
    const id = parseInt(userId);
    if (!isNaN(id)) {
      const [user] = await c.get("db")
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
  return c.html(loginPage());
});

authApp.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const email = String(body.email || "").trim();
  const password = String(body.password || "");

  if (!email || !password) {
    return c.html(loginForm(email, "Email and password are required."));
  }

  const [user] = await c.get("db")
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return c.html(loginForm(email, "Invalid email or password."));
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
  return c.html(signupPage());
});

authApp.post("/signup", async (c) => {
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

  const [existing] = await c.get("db")
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existing) {
    return c.html(signupForm(email, "An account with that email already exists."));
  }

  const hash = await bcrypt.hash(password, 10);
  const [newUser] = await c.get("db")
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

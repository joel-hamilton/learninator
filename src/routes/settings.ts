import { Hono } from "hono";
import type { Context } from "hono";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import type { AppVariables, User } from "../types.js";
import { settingsPage } from "../views/settings.js";

type SettingsContext = Context<{ Variables: AppVariables }>;

const settingsApp = new Hono<{ Variables: AppVariables }>();

settingsApp.get("/", (c: SettingsContext) => {
  const user = c.get("user") as User;
  return c.html(settingsPage(user));
});

settingsApp.post("/profile", async (c: SettingsContext) => {
  const user = c.get("user") as User;
  const body = await c.req.parseBody();
  const name = String(body.name || "").trim();

  await db
    .update(schema.users)
    .set({ name })
    .where(eq(schema.users.id, user.id));

  const initial = name ? name.trim().charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase();

  return c.html(`<span id="user-avatar" hx-swap-oob="true">${initial}</span><div class="result-msg success">Name updated.</div>`);
});

settingsApp.post("/password", async (c: SettingsContext) => {
  const user = c.get("user") as User;
  const body = await c.req.parseBody();
  const currentPassword = String(body.current_password || "");
  const newPassword = String(body.new_password || "");
  const confirmPassword = String(body.confirm_password || "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return c.html(`<div class="result-msg error">All fields are required.</div>`);
  }

  if (newPassword.length < 6) {
    return c.html(`<div class="result-msg error">New password must be at least 6 characters.</div>`);
  }

  if (newPassword !== confirmPassword) {
    return c.html(`<div class="result-msg error">New passwords do not match.</div>`);
  }

  // Re-fetch user to get current password hash
  const [freshUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);

  if (!freshUser || !(await bcrypt.compare(currentPassword, freshUser.passwordHash))) {
    return c.html(`<div class="result-msg error">Current password is incorrect.</div>`);
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await db
    .update(schema.users)
    .set({ passwordHash: hash })
    .where(eq(schema.users.id, user.id));

  return c.html(`<div class="result-msg success">Password changed.</div>`);
});

export { settingsApp };

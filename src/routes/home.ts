import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import type { AppVariables } from "../types.js";
import type { User } from "../types.js";
import { HTMX_HEAD } from "../views/shared.js";

type Ctx = Context<{ Variables: AppVariables }>;
export const homeRoutes = new Hono<{ Variables: AppVariables }>();

function layout(user: User, content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Learninator</title>
${HTMX_HEAD}
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #fdfcf9; color: #2d2d2d; min-height: 100vh; }
  .header { background: #fff; border-bottom: 1px solid #e8e4dc; padding: 0 2rem; display: flex; align-items: center; justify-content: space-between; height: 56px; }
  .header h1 { font-size: 1.1rem; font-weight: 600; }
  .header .user { font-size: 0.85rem; color: #888; }
  .header .user a { color: #888; text-decoration: none; margin-left: 1rem; }
  .header .user a:hover { color: #2d2d2d; }
  .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
  .empty-state { text-align: center; margin-top: 5rem; }
  .empty-state h2 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  .empty-state p { color: #888; margin-bottom: 2rem; }
  .empty-state form { display: flex; gap: 0.5rem; justify-content: center; }
  .empty-state textarea { padding: 0.7rem 1rem; border: 1px solid #e8e4dc; border-radius: 8px; font-size: 1rem; width: 360px; font-family: inherit; resize: none; }
  .empty-state textarea:focus { outline: none; border-color: #b8a88a; }
  .empty-state button { padding: 0.7rem 1.5rem; background: #2d2d2d; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .empty-state button:hover { background: #444; }
  .examples { display: flex; gap: 0.75rem; justify-content: center; margin-top: 1.5rem; flex-wrap: wrap; }
  .example-btn { padding: 0.5rem 1rem; background: #fff; border: 1px solid #e8e4dc; border-radius: 20px; font-size: 0.85rem; cursor: pointer; color: #666; transition: all 0.15s; }
  .example-btn:hover { border-color: #b8a88a; color: #2d2d2d; }
  .mission-list { display: grid; gap: 1rem; }
  .mission-card { background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 1.5rem; display: flex; align-items: center; justify-content: space-between; transition: border-color 0.15s; }
  .mission-card:hover { border-color: #b8a88a; }
  .mission-card .info h3 { font-size: 1rem; margin-bottom: 0.25rem; }
  .mission-card .info .meta { font-size: 0.8rem; color: #888; }
  .mission-card .actions { display: flex; gap: 0.5rem; align-items: center; }
  .mission-card .actions a, .mission-card .actions button { font-size: 0.85rem; padding: 0.4rem 0.9rem; border-radius: 6px; text-decoration: none; cursor: pointer; }
  .btn-primary { background: #2d2d2d; color: #fff; border: none; }
  .btn-primary:hover { background: #444; }
  .btn-ghost { background: #fff; color: #666; border: 1px solid #e8e4dc; }
  .btn-ghost:hover { border-color: #b8a88a; color: #2d2d2d; }
  .btn-danger { background: #fff; color: #8b2e2e; border: 1px solid #e8e4dc; }
  .btn-danger:hover { border-color: #c44; background: #fef5f5; }
  .add-new { margin-bottom: 1.5rem; }
  .add-new a { font-size: 0.9rem; color: #2d2d2d; text-decoration: none; padding: 0.5rem 1rem; border: 1px dashed #d4cbb8; border-radius: 8px; display: inline-block; }
  .add-new a:hover { background: #faf7f0; border-style: solid; }
</style>
</head>
<body>
<header class="header">
  <h1>Learninator</h1>
  <div class="user">${user.email} <a href="/logout">Log out</a></div>
</header>
<div class="container">
${content}
</div>
</body>
</html>`;
}

homeRoutes.get("/", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const missionRows = await db
    .select()
    .from(schema.missions)
    .where(eq(schema.missions.userId, user.id));

  if (missionRows.length === 0) {
    return c.html(layout(user, `
      <div class="empty-state">
        <h2>What do you want to learn?</h2>
        <p>Start a new mission and your AI teacher will guide you.</p>
        <form hx-post="/missions" hx-target="body">
          <textarea name="message" placeholder="e.g., Guitar, Rust, Quantum Physics..." required autofocus rows="2" style="width:360px;padding:0.7rem 1rem;border:1px solid #e8e4dc;border-radius:8px;font-size:1rem;font-family:inherit;resize:none;" oninput="autoResize(this)"></textarea>
          <button type="submit">Start Learning</button>
        </form>
        <div class="examples">
          <button class="example-btn" onclick="this.closest('form').querySelector('input').value='Guitar fretboard fluency'; this.closest('form').querySelector('input').focus()">Guitar fretboard</button>
          <button class="example-btn" onclick="this.closest('form').querySelector('input').value='Rust programming'; this.closest('form').querySelector('input').focus()">Rust</button>
          <button class="example-btn" onclick="this.closest('form').querySelector('input').value='Cooking fundamentals'; this.closest('form').querySelector('input').focus()">Cooking</button>
          <button class="example-btn" onclick="this.closest('form').querySelector('input').value='Drawing and sketching'; this.closest('form').querySelector('input').focus()">Drawing</button>
        </div>
      </div>
    `));
  }

  const cards = missionRows.map((m) => `
    <div class="mission-card">
      <div class="info">
        <h3>${m.title}</h3>
        <div class="meta">${m.status === "onboarding" ? "Setting up..." : m.status === "active" ? "Active" : "Archived"} &middot; Last updated ${new Date(m.updatedAt).toLocaleDateString()}</div>
      </div>
      <div class="actions">
        <a href="/missions/${m.id}" class="btn-primary">Continue</a>
        <form hx-post="/missions/${m.id}/delete" hx-target="closest .mission-card" hx-swap="outerHTML" style="display:inline">
          <button type="submit" class="btn-danger" onclick="return confirm('Delete this mission?')">Delete</button>
        </form>
      </div>
    </div>
  `).join("");

  return c.html(layout(user, `
    <div class="add-new">
      <a href="/missions/new">+ Start a new mission</a>
    </div>
    <div class="mission-list">
      ${cards}
    </div>
  `));
});

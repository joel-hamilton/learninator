import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import type { AppVariables } from "../types.js";
import type { User } from "../types.js";
import { layout } from "../views/home.js";

type Ctx = Context<{ Variables: AppVariables }>;
export const homeRoutes = new Hono<{ Variables: AppVariables }>();

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
          <button class="example-btn" onclick="this.closest('form').querySelector('textarea').value='Guitar fretboard fluency'; this.closest('form').querySelector('textarea').focus()">Guitar fretboard</button>
          <button class="example-btn" onclick="this.closest('form').querySelector('textarea').value='Rust programming'; this.closest('form').querySelector('textarea').focus()">Rust</button>
          <button class="example-btn" onclick="this.closest('form').querySelector('textarea').value='Cooking fundamentals'; this.closest('form').querySelector('textarea').focus()">Cooking</button>
          <button class="example-btn" onclick="this.closest('form').querySelector('textarea').value='Drawing and sketching'; this.closest('form').querySelector('textarea').focus()">Drawing</button>
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

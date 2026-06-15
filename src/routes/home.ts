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
          <textarea name="message" placeholder="e.g., Guitar, Rust, Quantum Physics..." required autofocus rows="2" oninput="autoResize(this)"></textarea>
          <button type="submit">Start Learning</button>
        </form>
        <div class="examples">
          <button type="button" class="example-btn" onclick="const ta=this.closest('.empty-state').querySelector('textarea');ta.value='Guitar fretboard fluency';ta.focus()">Guitar fretboard</button>
          <button type="button" class="example-btn" onclick="const ta=this.closest('.empty-state').querySelector('textarea');ta.value='Rust programming';ta.focus()">Rust</button>
          <button type="button" class="example-btn" onclick="const ta=this.closest('.empty-state').querySelector('textarea');ta.value='Cooking fundamentals';ta.focus()">Cooking</button>
          <button type="button" class="example-btn" onclick="const ta=this.closest('.empty-state').querySelector('textarea');ta.value='Drawing and sketching';ta.focus()">Drawing</button>
        </div>
      </div>
    `));
  }

  const getStatusBadge = (status: string): string => {
    if (status === "onboarding") return '<span class="badge badge-in-progress">Setting up</span>';
    if (status === "active") return '<span class="badge badge-active">Active</span>';
    return '<span class="badge badge-default">Archived</span>';
  };

  const cards = missionRows.map((m) => `
    <div class="mission-card">
      <div class="info">
        <h3>${m.title}</h3>
        <div class="meta">${getStatusBadge(m.status)} &middot; Updated ${new Date(m.updatedAt).toLocaleDateString()}</div>
      </div>
      <div class="actions">
        <a href="/missions/${m.id}" class="btn btn-primary btn-sm">Continue</a>
        <form hx-post="/missions/${m.id}/delete" hx-target="closest .mission-card" hx-swap="outerHTML" style="display:inline">
          <button type="submit" class="btn btn-danger btn-sm" onclick="return confirm('Delete this mission?')">Delete</button>
        </form>
      </div>
    </div>
  `).join("");

  return c.html(layout(user, `
    <div class="welcome">
      <h2>Your missions</h2>
      <p>Continue learning where you left off, or start something new.</p>
    </div>
    <div class="add-new">
      <a href="/missions/new">+ Start a new mission</a>
    </div>
    <div class="section-label">Missions</div>
    <div class="mission-list stagger">
      ${cards}
    </div>
  `));
});

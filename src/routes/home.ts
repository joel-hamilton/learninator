import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import type { AppVariables } from "../types.js";
import type { User } from "../types.js";
import { layout } from "../views/home.js";
import { svgIcon } from "../views/shared.js";

type Ctx = Context<{ Variables: AppVariables }>;
export const homeRoutes = new Hono<{ Variables: AppVariables }>();

homeRoutes.get("/", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionRows = await store.listMissions(user.id);

  if (missionRows.length === 0) {
    return c.html(layout(user, `
      <div class="empty-state">
        <h2>What do you want to learn?</h2>
        <p>Describe what you'd like to learn and your AI teacher will create a personalized learning path with interactive lessons, reference docs, and practice exercises.</p>
        <form hx-post="/missions" hx-target="body">
          <div class="textarea-wrapper">
            <textarea name="message" placeholder="e.g., I want to learn guitar soloing across the entire fretboard..." required autofocus rows="3" oninput="autoResize(this)"></textarea>
            <span class="textarea-hint">Press Enter to send &middot; Shift + Enter for newline</span>
          </div>
          <button type="submit">Start Learning</button>
        </form>
        <div class="browse-entry" style="margin-top:1.25rem">
          <a href="/browse" class="btn btn-secondary">🧭 Browse topics</a>
        </div>
        <div class="examples">
          <span style="font-size:0.8rem;color:var(--text-muted);margin-right:0.25rem;">Try:</span>
          <button type="button" class="example-btn" onclick="const ta=this.closest('.empty-state').querySelector('textarea');ta.value='Guitar fretboard fluency and improvisation';ta.focus()">Guitar soloing</button>
          <button type="button" class="example-btn" onclick="const ta=this.closest('.empty-state').querySelector('textarea');ta.value='Rust programming from zero to CLI tools';ta.focus()">Rust</button>
          <button type="button" class="example-btn" onclick="const ta=this.closest('.empty-state').querySelector('textarea');ta.value='Cooking fundamentals — knife skills, sauces, and building flavor';ta.focus()">Cooking</button>
          <button type="button" class="example-btn" onclick="const ta=this.closest('.empty-state').querySelector('textarea');ta.value='Drawing and sketching with traditional and digital media';ta.focus()">Drawing</button>
        </div>
      </div>
    `));
  }

  const active = missionRows.filter(m => m.status !== "archived");
  const archived = missionRows.filter(m => m.status === "archived");

  const getStatusBadge = (status: string): string => {
    if (status === "onboarding") return '<span class="badge badge-in-progress">Setting up</span>';
    if (status === "active") return '<span class="badge badge-active">Active</span>';
    return '<span class="badge badge-default">Archived</span>';
  };

  const renderActiveCard = (m: typeof missionRows[number]) => `
    <div class="mission-card" onclick="window.location.href='/missions/${m.id}'" style="cursor:pointer" role="link" tabindex="0" onkeydown="if(event.key==='Enter')window.location.href='/missions/${m.id}'">
      <div class="info">
        <h3>${m.title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h3>
        <div class="meta">${getStatusBadge(m.status)} &middot; Updated ${new Date(m.updatedAt).toLocaleDateString()}</div>
      </div>
      <div class="actions" onclick="event.stopPropagation()">
        <form hx-post="/missions/${m.id}/archive" hx-target="closest .mission-card" hx-swap="outerHTML" style="display:inline">
          <button type="submit" class="btn btn-ghost btn-sm" onclick="return confirm('Archive this mission?')">${svgIcon("archive")} Archive</button>
        </form>
      </div>
    </div>
  `;

  const renderArchivedCard = (m: typeof missionRows[number]) => `
    <div class="mission-card mission-card--archived" onclick="window.location.href='/missions/${m.id}'" style="cursor:pointer" role="link" tabindex="0" onkeydown="if(event.key==='Enter')window.location.href='/missions/${m.id}'">
      <div class="info">
        <h3>${m.title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h3>
        <div class="meta">${getStatusBadge(m.status)} &middot; Updated ${new Date(m.updatedAt).toLocaleDateString()}</div>
      </div>
      <div class="actions" onclick="event.stopPropagation()">
        <form hx-post="/missions/${m.id}/restore" hx-target="closest .mission-card" hx-swap="outerHTML" style="display:inline">
          <button type="submit" class="btn btn-ghost btn-sm">${svgIcon("rotateCcw")} Restore</button>
        </form>
        <form hx-post="/missions/${m.id}/delete" hx-target="closest .mission-card" hx-swap="outerHTML" style="display:inline">
          <button type="submit" class="btn btn-danger btn-sm" onclick="return confirm('Permanently delete this mission? This cannot be undone.')">${svgIcon("trash")} Delete</button>
        </form>
      </div>
    </div>
  `;

  const activeCards = active.map(renderActiveCard).join("");
  const archivedCards = archived.map(renderArchivedCard).join("");

  const archivedSection = archived.length > 0 ? `
    <div class="section-label" style="margin-top:2.5rem;">Archived</div>
    <div class="mission-list stagger">${archivedCards}</div>
  ` : "";

  return c.html(layout(user, `
    <div class="welcome">
      <h2>Your missions</h2>
      <p>Continue learning where you left off, or start something new.</p>
    </div>
    <div class="add-new" style="display:flex;gap:0.75rem;align-items:center">
      <a href="/missions/new">${svgIcon("plus")} Start a new mission</a>
      <a href="/browse" class="btn btn-secondary btn-sm">🧭 Browse topics</a>
    </div>
    <div class="section-label">Missions</div>
    <div class="mission-list stagger">
      ${activeCards || '<p style="color:var(--text-muted);padding:1rem 0;">No active missions. Start one above!</p>'}
    </div>
    ${archivedSection}
  `));
});

// ── Workflow state polling endpoint (catch-up after navigation/reload) ──
homeRoutes.get("/workflows/state", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const wfState = c.get("workflowState");
  const workflows = wfState.getActiveWorkflows(user.id);
  return c.json({ workflows });
});

// ── Workflow events SSE endpoint (user-scoped, site-wide indicator) ──
homeRoutes.get("/workflows/events", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;

  return streamSSE(c, async (stream) => {
    const log = c.get("logger");
    const events = c.get("events");
    log.debug("Workflow SSE client connected for user %d", user.id);

    const unsub = events.subscribeUser(user.id, async (event) => {
      try {
        await stream.writeSSE({ data: JSON.stringify(event), event: event.event });
      } catch (e) {
        log.debug("Workflow SSE write error: %s", e);
      }
    });

    await new Promise<void>((resolve) => {
      c.req.raw.signal.addEventListener("abort", () => {
        log.debug("Workflow SSE client disconnected for user %d", user.id);
        unsub();
        resolve();
      });
    });
  });
});

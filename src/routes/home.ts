import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import type { AppVariables } from "../types.js";
import type { User } from "../types.js";
import { layout } from "../views/home.js";
import { svgIcon } from "../views/shared.js";
import type { MissionStore, MissionRow } from "../db/store.js";

type Ctx = Context<{ Variables: AppVariables }>;
export const homeRoutes = new Hono<{ Variables: AppVariables }>();

// ── Shared card render helpers ──────────────────────────────────────────

function getStatusBadge(status: string): string {
  if (status === "onboarding") return '<span class="badge badge-in-progress">Setting up</span>';
  if (status === "active") return '<span class="badge badge-active">Active</span>';
  return '<span class="badge badge-default">Archived</span>';
}

function renderActiveCard(m: MissionRow): string {
  const title = m.title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const updated = new Date(m.updatedAt).toLocaleDateString();
  return `<div class="mission-card" onclick="window.location.href='/missions/${m.id}'" style="cursor:pointer" role="link" tabindex="0" onkeydown="if(event.key==='Enter')window.location.href='/missions/${m.id}'">
    <div class="info">
      <h3>${title}</h3>
      <div class="meta">${getStatusBadge(m.status)} &middot; Updated ${updated}</div>
    </div>
    <div class="actions" onclick="event.stopPropagation()">
      <form hx-post="/missions/${m.id}/archive" hx-target="closest .mission-card" hx-swap="outerHTML" style="display:inline">
        <button type="submit" class="btn btn-ghost btn-sm" onclick="return confirm('Archive this mission?')">${svgIcon("archive")} Archive</button>
      </form>
    </div>
  </div>`;
}

function renderArchivedCard(m: MissionRow): string {
  const title = m.title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const updated = new Date(m.updatedAt).toLocaleDateString();
  return `<div class="mission-card mission-card--archived" onclick="window.location.href='/missions/${m.id}'" style="cursor:pointer" role="link" tabindex="0" onkeydown="if(event.key==='Enter')window.location.href='/missions/${m.id}'">
    <div class="info">
      <h3>${title}</h3>
      <div class="meta">${getStatusBadge(m.status)} &middot; Updated ${updated}</div>
    </div>
    <div class="actions" onclick="event.stopPropagation()">
      <form hx-post="/missions/${m.id}/restore" hx-target="closest .mission-card" hx-swap="outerHTML" style="display:inline">
        <button type="submit" class="btn btn-ghost btn-sm">${svgIcon("rotateCcw")} Restore</button>
      </form>
      <form hx-post="/missions/${m.id}/delete" hx-target="closest .mission-card" hx-swap="outerHTML" style="display:inline">
        <button type="submit" class="btn btn-danger btn-sm" onclick="return confirm('Permanently delete this mission? This cannot be undone.')">${svgIcon("trash")} Delete</button>
      </form>
    </div>
  </div>`;
}

// ── Section rendering ───────────────────────────────────────────────────

export function renderMissionSections(missions: MissionRow[]): { activeSectionHtml: string; archivedSectionHtml: string } {
  const active = missions.filter(m => m.status !== "archived");
  const archived = missions.filter(m => m.status === "archived");

  const activeCards = active.map(renderActiveCard).join("");
  const archivedCards = archived.map(renderArchivedCard).join("");

  const activeSectionHtml = `<div id="active-section">
    <div class="section-label">Missions</div>
    <div class="mission-list stagger">
      ${activeCards || '<p style="color:var(--text-muted);padding:1rem 0;">No active missions. Start one above!</p>'}
    </div>
  </div>`;

  const archivedSectionHtml = archived.length > 0
    ? `<div id="archived-section">
        <details class="archived-section">
          <summary>${svgIcon("chevronDown", "chevron")}<span class="section-label" style="margin:0;cursor:pointer">Archived (${archived.length})</span></summary>
          <div class="mission-list stagger">${archivedCards}</div>
        </details>
      </div>`
    : `<div id="archived-section"></div>`;

  return { activeSectionHtml, archivedSectionHtml };
}

export async function renderOobSections(store: MissionStore, userId: number): Promise<string> {
  const missions = await store.listMissions(userId);
  const { activeSectionHtml, archivedSectionHtml } = renderMissionSections(missions);

  return activeSectionHtml.replace('<div id="active-section"', '<div id="active-section" hx-swap-oob="innerHTML:#active-section"')
    + archivedSectionHtml.replace('<div id="archived-section"', '<div id="archived-section" hx-swap-oob="innerHTML:#archived-section"');
}

// ── Home page ──

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

  const { activeSectionHtml, archivedSectionHtml } = renderMissionSections(missionRows);

  return c.html(layout(user, `
    <div class="welcome">
      <h2>Your missions</h2>
      <p>Continue learning where you left off, or start something new.</p>
    </div>
    <div class="add-new" style="display:flex;gap:0.75rem;align-items:center">
      <a href="/missions/new">${svgIcon("plus")} Start a new mission</a>
      <a href="/browse" class="btn btn-secondary btn-sm">🧭 Browse topics</a>
    </div>
    ${activeSectionHtml}
    ${archivedSectionHtml}
  `));
});

// ── Workflow state polling endpoint (catch-up after navigation/reload) ──
homeRoutes.get("/workflows/state", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const wfState = c.get("workflowState");
  const workflows = wfState.getActiveWorkflows(user.id);
  return c.json({ workflows });
});

// ── (SSE endpoint /workflows/events was removed — see ADR-0003) ──

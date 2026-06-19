import { HTMX_HEAD, HTMX_LOADING_BAR, svgIcon, userInitial, userMenu } from "./shared.js";
import { siteWideIndicator } from "./fragments.js";
import { ssePollerScript } from "../shared/sse-poller.js";

function tabIcon(key: string): string {
  switch (key) {
    case "lessons": return svgIcon("book");
    case "chat": return svgIcon("chat");
    case "reference": return svgIcon("file");
    case "records": return svgIcon("chart");
    case "resources": return svgIcon("box");
    default: return svgIcon("book");
  }
}

export function missionLayout(user: { email: string; name?: string | null }, mission: { id: number; title: string; status: string }, content: string, activeTab: string = "lessons", backHref: string = "/", backLabel: string = "Dashboard") {
  const tabs = [
    { key: "lessons", label: "Lessons", href: `/missions/${mission.id}` },
    { key: "chat", label: "Chat", href: `/missions/${mission.id}/chat` },
    { key: "reference", label: "Reference", href: `/missions/${mission.id}/reference` },
    { key: "records", label: "Learning Records", href: `/missions/${mission.id}/records` },
    { key: "resources", label: "Resources", href: `/missions/${mission.id}/resources` },
  ];

  const tabHtml = tabs.map((t) =>
    `<a href="${t.href}" class="tab ${t.key === activeTab ? "active" : ""}">
      <span class="tab-icon">${tabIcon(t.key)}</span><span class="tab-label">${t.label}</span>
    </a>`
  ).join("");

  const statusTag = mission.status === "active"
    ? '<span class="status-tag tag-active">active</span>'
    : mission.status === "onboarding"
      ? '<span class="status-tag tag-onboarding">onboarding</span>'
      : '<span class="status-tag tag-archived">archived</span>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${mission.title} — Learninator</title>
${HTMX_HEAD}
<style>
  /* Header */
  .header {
    background: var(--paper);
    border-bottom: 1px solid var(--rule);
    padding: 0 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 56px;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .header-left { display: flex; align-items: center; gap: 2rem; min-width: 0; }
  .header .logo {
    font-size: 1rem; font-weight: 700; letter-spacing: -0.02em;
    display: flex; align-items: center; gap: 0.4rem;
    color: var(--ink); text-decoration: none; flex-shrink: 0;
    font-family: var(--font-display);
    margin-right: 0.5rem;
  }
  .header .logo:hover { color: var(--ink); }
  .header .logo .svg-icon { width: 1.15em; height: 1.15em; color: var(--rubric); }
  .header-title {
    font-size: 0.9rem; font-weight: 600; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap;
  }
  .header-title-text {
    cursor: pointer;
    border-bottom: 2px solid transparent;
    padding-bottom: 1px;
    transition: border-color 0.2s ease;
  }
  .header-title-text:hover {
    border-bottom-color: var(--rule-hover);
  }
  .header-title .edit-hint {
    display: inline-block;
    opacity: 0;
    transition: opacity 0.2s ease;
    margin: 0 0.15rem;
  }
  .header-title .edit-hint .svg-icon {
    width: 0.75em; height: 0.75em;
    color: var(--ink-muted);
    vertical-align: middle;
  }
  .header-title-text:hover .edit-hint { opacity: 1; }
  .status-tag {
    display: inline-block;
    font-size: 0.62rem; font-weight: 600; padding: 0.18rem 0.5rem;
    border-radius: 999px; text-transform: uppercase; letter-spacing: 0.04em;
    margin-left: 1.25rem; vertical-align: middle;
  }
  .tag-active { background: var(--success-bg); color: var(--success); border: 1px solid var(--success-border); }
  .tag-onboarding { background: var(--warning-bg); color: var(--warning); border: 1px solid var(--warning-border); }
  .tag-archived { background: var(--margin); color: var(--ink-muted); }
  .header-right { display: flex; align-items: center; gap: 0.75rem; font-size: 0.8rem; color: var(--ink-secondary); flex-shrink: 0; }

  /* Layout */
  .layout {
    display: grid;
    grid-template-columns: 250px 1fr;
    min-height: calc(100vh - 56px);
    transition: grid-template-columns 0.25s ease;
    position: relative;
  }
  .layout.sidebar-collapsed { grid-template-columns: 56px 1fr; }
  .layout.sidebar-collapsed .sidebar { padding: 0.5rem 0; overflow: hidden; }
  .layout.sidebar-collapsed .sidebar-back { display: flex; justify-content: center; align-items: center; padding: 0.65rem 0.5rem; border: none; border-radius: 0; margin-bottom: 0.5rem; width: 100%; box-sizing: border-box; }
  .layout.sidebar-collapsed .sidebar-back .svg-icon { width: 1.1em; height: 1.1em; }
  .layout.sidebar-collapsed .sidebar-back .back-label { display: none; }
  .layout.sidebar-collapsed .sidebar-label,
  .layout.sidebar-collapsed .sidebar-footer,
  .layout.sidebar-collapsed .sidebar-divider { display: none; }
  .layout.sidebar-collapsed .tab { justify-content: center; padding: 0.55rem 0; }
  .layout.sidebar-collapsed .tab-label { display: none; }
  .layout.sidebar-collapsed .tab .tab-icon .svg-icon { width: 1.25em; height: 1.25em; }

  @media (max-width: 768px) {
    .layout:not(.sidebar-open) { grid-template-columns: 0 1fr; }
    .layout:not(.sidebar-open) .sidebar { overflow: hidden; padding: 0; border-right: none; min-width: 0; }
  }

  /* Sidebar */
  .sidebar {
    background: var(--margin); border-right: 1px solid var(--rule);
    padding: 1.25rem 0.75rem; display: flex; flex-direction: column;
    position: sticky; top: 56px; height: calc(100vh - 56px); overflow-y: auto;
    transition: padding 0.25s ease, border 0.25s ease;
  }
  .sidebar-back {
    font-size: 0.78rem; color: var(--ink-secondary); text-decoration: none;
    display: inline-flex; align-items: center; gap: 0.3rem;
    padding: 0.35rem 0.65rem; border: 1px solid var(--rule); border-radius: var(--radius-sm);
    transition: all var(--transition); margin-bottom: 0.85rem;
  }
  .sidebar-back:hover { border-color: var(--rule-hover); color: var(--ink); background: var(--surface-hover); }
  .sidebar-back .svg-icon { width: 0.8em; height: 0.8em; }

  /* Sidebar toggle — sibling of .sidebar, positioned at the sidebar/main boundary */
  .sidebar-toggle {
    position: absolute;
    left: 250px;
    bottom: 20px;
    transform: translateX(-50%);
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid var(--rule);
    background: var(--surface);
    color: var(--ink-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 101;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    transition: left 0.25s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
    padding: 0;
    line-height: 1;
  }
  .sidebar-toggle:hover {
    border-color: var(--ink);
    color: var(--ink);
    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  }
  .sidebar-toggle svg {
    width: 16px;
    height: 16px;
    transition: transform 0.25s ease;
  }
  .layout.sidebar-collapsed .sidebar-toggle { left: 56px; }
  .layout.sidebar-collapsed .sidebar-toggle svg { transform: rotate(180deg); }
  @media (max-width: 768px) {
    .sidebar-toggle { left: 0; }
    .layout.sidebar-open .sidebar-toggle { left: 250px; }
  }

  .sidebar-label {
    font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.07em;
    color: var(--ink-muted); font-weight: 600; padding: 0 0.5rem; margin-bottom: 0.35rem;
  }
  .tabs { display: flex; flex-direction: column; gap: 2px; }
  .tab {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 0.55rem 0.75rem; border-radius: var(--radius-sm);
    font-size: 0.85rem; color: var(--ink-secondary); text-decoration: none;
    transition: all var(--transition); font-weight: 500;
  }
  .tab:hover { background: var(--surface-hover); color: var(--ink); }
  .tab.active {
    background: var(--rubric-light); color: var(--rubric); font-weight: 600;
  }
  .tab-icon { width: 1.2em; text-align: center; flex-shrink: 0; }
  .tab-icon .svg-icon { width: 1em; height: 1em; color: var(--ink-muted); transition: color var(--transition); }
  .tab:hover .tab-icon .svg-icon, .tab.active .tab-icon .svg-icon { color: inherit; }

  .sidebar-divider { height: 1px; background: var(--rule); margin: 0.85rem 0.4rem; }

  .sidebar-footer {
    margin-top: auto; padding: 0.85rem 0.75rem;
    background: var(--surface);
    border: 1px solid var(--rule); border-radius: var(--radius-sm);
  }
  .sidebar-footer .label {
    font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.07em;
    color: var(--ink-muted); font-weight: 600; margin-bottom: 0.25rem;
  }
  .sidebar-footer .mission-name { font-size: 0.8rem; color: var(--ink); font-weight: 600; margin-bottom: 0.1rem; }
  .sidebar-footer .mission-status { font-size: 0.7rem; color: var(--ink-muted); }
  .sidebar-footer-actions { display: flex; gap: 0.35rem; margin-top: 0.6rem; }
  .sidebar-action-btn {
    display: inline-flex; align-items: center; gap: 0.3rem;
    font-size: 0.68rem; padding: 0.25rem 0.45rem;
    border: 1px solid var(--rule); border-radius: var(--radius-sm);
    background: var(--surface); color: var(--ink-secondary);
    cursor: pointer; font-family: inherit; font-weight: 500;
    transition: all var(--transition);
  }
  .sidebar-action-btn:hover { border-color: var(--rule-hover); color: var(--ink); background: var(--surface-hover); }
  .sidebar-action-btn--danger:hover { color: var(--danger); border-color: var(--danger); }
  .sidebar-action-btn .svg-icon { width: 0.85em; height: 0.85em; color: var(--ink-muted); }

  /* Main */
  .main { padding: 2rem 2.5rem; overflow: auto; animation: fadeInUp 0.35s ease-out; }

  /* Lesson Cards */
  .lesson-list { display: grid; gap: 0; }
  .lesson-card:not(.lesson-card--sub):not(:first-child) { margin-top: 0.65rem; }
  .lesson-card {
    background: var(--surface); border: 1px solid var(--rule); border-radius: var(--radius);
    padding: 0.85rem 1.15rem; display: flex; align-items: center; justify-content: space-between;
    text-decoration: none; color: inherit; cursor: pointer;
    transition: all var(--transition-slow);
  }
  .lesson-card:hover { border-color: var(--rule-hover); background: var(--surface-hover); box-shadow: var(--shadow-sm); }
  .lesson-card .info { display: flex; align-items: center; gap: 0.7rem; min-width: 0; }
  .lesson-card .num { font-size: 0.68rem; color: var(--ink-muted); font-family: var(--font-mono); flex-shrink: 0; font-weight: 500; }
  .lesson-card h3 {
    font-size: 0.85rem; font-weight: 500; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap;
  }
  .lesson-card--sub {
    margin-left: 1.5rem;
    border-top: 0;
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }
  .lesson-card--has-subs {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
  .lesson-card--last-sub {
    border-bottom-left-radius: var(--radius);
    border-bottom-right-radius: var(--radius);
  }

  /* Reference Cards */
  .ref-list { display: grid; gap: 0.4rem; }
  .ref-card {
    display: block; text-decoration: none; color: inherit;
    background: var(--surface); border: 1px solid var(--rule); border-radius: var(--radius);
    padding: 1rem 1.15rem; transition: all var(--transition-slow);
  }
  .ref-card:hover { border-color: var(--rule-hover); background: var(--surface-hover); box-shadow: var(--shadow-sm); }
  .ref-card h3 { font-size: 0.9rem; font-weight: 500; }
  .ref-card .type { font-size: 0.65rem; color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; margin-bottom: 0.2rem; }

  /* Learning Records (text-only, not clickable) */
  .record-list { display: flex; flex-direction: column; }
  .record-card {
    padding: 1rem 0;
  }
  .record-card + .record-card { border-top: 1px solid var(--rule); }
  .record-card .record-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; flex-wrap: wrap; }
  .record-card .record-header .meta { font-size: 0.68rem; color: var(--ink-muted); font-family: var(--font-mono); }
  .record-card h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 0.4rem; }
  .record-card .content { font-size: 0.85rem; color: var(--ink-secondary); line-height: 1.55; }
  .record-card .content.markdown-body { font-size: 0.85rem; }

  /* Resources */
  .resource-markdown {
    background: var(--surface); border: 1px solid var(--rule); border-radius: var(--radius);
    padding: 1.5rem; line-height: 1.6; font-size: 0.88rem;
  }

  /* Chat */
  #chat-messages {
    display: flex; flex-direction: column; gap: 0.75rem;
    margin-bottom: 1rem; max-height: 60vh; overflow-y: auto; padding: 0.25rem;
    overflow-wrap: break-word; word-break: break-word;
  }
  #chat-messages > * { min-width: 0; max-width: 100%; }

  /* Empty */
  .empty { text-align: center; color: var(--text-secondary); padding: 4rem 2rem; }
  .empty a { color: var(--accent); }

</style>
</head>
<body data-user-initial="${userInitial(user)}">
${HTMX_LOADING_BAR}
<header class="header">
  <div class="header-left">
    <a href="/" class="logo">${svgIcon("zap")} Learninator</a>
    <span class="header-title" id="mission-title-display" title="Click to rename" onclick="this.style.display='none';document.getElementById('mission-title-edit').style.display='inline-flex';document.getElementById('title-input').focus();document.getElementById('title-input').select();"><span class="header-title-text">${mission.title} <span class="edit-hint">${svgIcon("edit")}</span></span>${statusTag}</span>
    <form id="mission-title-edit" hx-put="/missions/${mission.id}/title" hx-target="#mission-title-display" hx-swap="outerHTML" style="display:none;align-items:center;gap:0.35rem;" hx-on::after-request="this.style.display='none'">
      <input type="text" id="title-input" name="title" value="${mission.title.replace(/"/g, "&quot;")}" style="font-size:0.85rem;padding:0.25rem 0.55rem;border:1.5px solid var(--rule);border-radius:6px;font-family:inherit;width:200px;">
      <button type="submit" style="font-size:0.75rem;padding:0.25rem 0.55rem;border-radius:6px;border:1px solid var(--rule);background:var(--surface);cursor:pointer;font-family:inherit;">Save</button>
      <button type="button" onclick="this.closest('form').style.display='none';document.getElementById('mission-title-display').style.display=''" style="font-size:0.75rem;padding:0.25rem 0.55rem;border-radius:6px;border:1px solid var(--rule);background:var(--surface);cursor:pointer;font-family:inherit;">Cancel</button>
    </form>
  </div>
  <div class="header-right">${userMenu(user)}</div>
</header>
${siteWideIndicator()}
<div class="layout">
  <aside class="sidebar">
    <a href="${backHref}" class="sidebar-back">${svgIcon("arrowLeft")} <span class="back-label">${backLabel}</span></a>
    <div class="sidebar-label">${mission.title}</div>
    <nav class="tabs">
      ${tabHtml}
    </nav>
    <div class="sidebar-divider"></div>
    <div class="sidebar-footer">
      <div class="label">Mission</div>
      <div class="mission-name" id="sidebar-mission-name">${mission.title}</div>
      <div class="mission-status">${mission.status}</div>
      <div class="sidebar-footer-actions">
        ${mission.status === "archived" ? `
          <form hx-post="/missions/${mission.id}/restore" hx-target="body"><button type="submit" class="sidebar-action-btn">${svgIcon("rotateCcw")} Restore</button></form>
          <form hx-post="/missions/${mission.id}/delete" hx-target="body"><button type="submit" class="sidebar-action-btn sidebar-action-btn--danger" onclick="return confirm('Permanently delete this mission?')">${svgIcon("trash")} Delete</button></form>
        ` : `
          <form hx-post="/missions/${mission.id}/archive" hx-target="body"><button type="submit" class="sidebar-action-btn" onclick="return confirm('Archive this mission?')">${svgIcon("archive")} Archive</button></form>
        `}
      </div>
    </div>
  </aside>
  <button class="sidebar-toggle" title="Toggle sidebar" aria-label="Toggle sidebar">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="17 17 12 12 17 7"/></svg>
  </button>
  <main class="main">
    ${content}
  </main>
</div>
${ssePollerScript()}
<script>
(function() {
  // Sidebar toggle — persist collapse state across navigation (tabs are plain links)
  var toggle = document.querySelector(".layout > .sidebar-toggle");
  var layout = document.querySelector(".layout");
  if (!toggle || !layout) return;
  var STORAGE_KEY = "learninator:sidebar-collapsed";
  var stored = null;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) {}
  if (stored === "1") {
    layout.classList.add("sidebar-collapsed");
  } else if (stored === null && window.innerWidth <= 768) {
    layout.classList.add("sidebar-collapsed");
  }
  toggle.addEventListener("click", function() {
    layout.classList.toggle("sidebar-collapsed");
    if (window.innerWidth <= 768) {
      layout.classList.toggle("sidebar-open");
    }
    try {
      localStorage.setItem(STORAGE_KEY, layout.classList.contains("sidebar-collapsed") ? "1" : "0");
    } catch (e) {}
  });
})();
</script>
</body>
</html>`;
}

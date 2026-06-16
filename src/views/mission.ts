import { HTMX_HEAD, HTMX_LOADING_BAR } from "./shared.js";

function tabIcon(key: string): string {
  switch (key) {
    case "lessons": return "📖";
    case "chat": return "💬";
    case "reference": return "📋";
    case "records": return "📊";
    case "resources": return "📦";
    default: return "•";
  }
}

export function missionLayout(user: { email: string }, mission: { id: number; title: string; status: string }, content: string, activeTab: string = "lessons") {
  const tabs = [
    { key: "lessons", label: "Lessons", href: `/missions/${mission.id}` },
    { key: "chat", label: "Chat", href: `/missions/${mission.id}/chat` },
    { key: "reference", label: "Reference", href: `/missions/${mission.id}/reference` },
    { key: "records", label: "Learning Records", href: `/missions/${mission.id}/records` },
    { key: "resources", label: "Resources", href: `/missions/${mission.id}/resources` },
  ];

  const tabHtml = tabs.map((t) =>
    `<a href="${t.href}" class="tab ${t.key === activeTab ? "active" : ""}">
      <span class="tab-icon">${tabIcon(t.key)}</span>${t.label}
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
  /* ── Header ── */
  .header {
    background: rgba(255,255,255,0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 0 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 56px;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .header-left { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
  .header-back {
    font-size: 0.85rem; color: var(--text-secondary); text-decoration: none;
    padding: 0.3rem 0.6rem; border: 1px solid var(--border); border-radius: var(--radius-sm);
    transition: all var(--transition); white-space: nowrap;
  }
  .header-back:hover { border-color: var(--primary); color: var(--text); }
  .header-title {
    font-size: 0.95rem; font-weight: 600; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap;
  }
  .status-tag {
    display: inline-block;
    font-size: 0.65rem; font-weight: 500; padding: 0.15rem 0.45rem;
    border-radius: 999px; text-transform: uppercase; letter-spacing: 0.04em;
    margin-left: 0.5rem; vertical-align: middle;
  }
  .tag-active { background: var(--success-bg); color: var(--success); border: 1px solid var(--success-border); }
  .tag-onboarding { background: var(--warning-bg); color: var(--warning); border: 1px solid var(--warning-border); }
  .tag-archived { background: var(--primary-light); color: var(--text-muted); border: 1px solid var(--border); }
  .header-right { display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; color: var(--text-secondary); flex-shrink: 0; }
  .header-right .logout-link {
    color: var(--text-secondary); text-decoration: none; font-size: 0.8rem;
    padding: 0.3rem 0.7rem; border: 1px solid var(--border); border-radius: var(--radius-sm);
    transition: all var(--transition);
  }
  .header-right .logout-link:hover { border-color: var(--primary); color: var(--text); }

  /* ── Layout ── */
  .layout { display: grid; grid-template-columns: 250px 1fr; min-height: calc(100vh - 56px); }

  /* ── Sidebar ── */
  .sidebar {
    background: var(--surface); border-right: 1px solid var(--border);
    padding: 1.25rem 1rem; display: flex; flex-direction: column;
    position: sticky; top: 56px; height: calc(100vh - 56px); overflow-y: auto;
  }
  .sidebar-label {
    font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--text-muted); font-weight: 600; padding: 0 0.5rem; margin-bottom: 0.5rem;
  }
  .tabs { display: flex; flex-direction: column; gap: 2px; }
  .tab {
    display: flex; align-items: center; gap: 0.55rem;
    padding: 0.55rem 0.75rem; border-radius: var(--radius);
    font-size: 0.88rem; color: var(--text-secondary); text-decoration: none;
    transition: all var(--transition);
  }
  .tab:hover { background: var(--primary-light); color: var(--text); }
  .tab.active {
    background: var(--primary-light); color: var(--text); font-weight: 500;
    border-left: 3px solid var(--primary); border-radius: 0 var(--radius) var(--radius) 0;
    margin-left: -0.5rem; padding-left: calc(0.75rem - 3px);
  }
  .tab-icon { font-size: 0.95rem; width: 1.3em; text-align: center; flex-shrink: 0; }

  .sidebar-divider { height: 1px; background: var(--border); margin: 1rem 0.5rem; }

  .sidebar-footer {
    margin-top: auto; padding: 1rem 0.75rem;
    background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius);
  }
  .sidebar-footer .label {
    font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--text-muted); font-weight: 600; margin-bottom: 0.3rem;
  }
  .sidebar-footer .mission-name { font-size: 0.85rem; color: var(--text); font-weight: 500; margin-bottom: 0.15rem; }
  .sidebar-footer .mission-status { font-size: 0.75rem; color: var(--text-muted); }

  /* ── Main ── */
  .main { padding: 2rem; overflow: auto; animation: fadeInUp 0.3s ease-out; }

  /* ── Cards ── */
  .lesson-list { display: grid; gap: 0.5rem; }
  .lesson-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
    padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between;
    text-decoration: none; color: inherit; cursor: pointer;
    transition: all var(--transition-slow); box-shadow: var(--shadow-sm);
  }
  .lesson-card:hover {
    border-color: var(--primary); box-shadow: var(--shadow-md);
    transform: translateX(3px);
  }
  .lesson-card .info { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
  .lesson-card .num { font-size: 0.75rem; color: var(--text-muted); font-family: ui-monospace, monospace; flex-shrink: 0; }
  .lesson-card h3 {
    font-size: 0.9rem; font-weight: 500; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap;
  }

  .ref-list { display: grid; gap: 0.5rem; }
  .ref-card {
    display: block; text-decoration: none; color: inherit;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
    padding: 1.25rem; transition: all var(--transition-slow); box-shadow: var(--shadow-sm);
  }
  .ref-card:hover { border-color: var(--primary); box-shadow: var(--shadow-md); }
  .ref-card h3 { font-size: 0.95rem; }
  .ref-card .type { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }

  .record-list { display: grid; gap: 0.5rem; }
  .record-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
    padding: 1.25rem; transition: all var(--transition-slow); box-shadow: var(--shadow-sm);
  }
  .record-card:hover { border-color: var(--primary); box-shadow: var(--shadow-md); }
  .record-card h3 { font-size: 0.95rem; margin-bottom: 0.5rem; }
  .record-card .content { font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; }
  .record-card .meta { font-size: 0.75rem; color: var(--text-muted); }

  .resource-markdown {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
    padding: 1.5rem; line-height: 1.6; font-size: 0.9rem; box-shadow: var(--shadow-sm);
  }

  /* ── Chat ── */
  #chat-messages {
    display: flex; flex-direction: column; gap: 0.75rem;
    margin-bottom: 1rem; max-height: 60vh; overflow-y: auto; padding: 0.25rem;
  }

  /* ── Empty ── */
  .empty { text-align: center; color: var(--text-secondary); padding: 4rem 2rem; }
  .empty a { color: var(--primary); }
</style>
</head>
<body>
${HTMX_LOADING_BAR}
<header class="header">
  <div class="header-left">
    <a href="/" class="header-back">&larr; Dashboard</a>
    <span class="header-title" id="mission-title-display" style="cursor:pointer" title="Click to rename" onclick="this.style.display='none';document.getElementById('mission-title-edit').style.display='inline-flex';document.getElementById('title-input').focus();document.getElementById('title-input').select();">${mission.title}${statusTag}</span>
    <form id="mission-title-edit" hx-put="/missions/${mission.id}/title" hx-target="#mission-title-display" hx-swap="outerHTML" style="display:none;align-items:center;gap:0.35rem;" hx-on::after-request="this.style.display='none'">
      <input type="text" id="title-input" name="title" value="${mission.title.replace(/"/g, "&quot;")}" style="font-size:0.9rem;padding:0.2rem 0.5rem;border:1px solid var(--border);border-radius:4px;font-family:inherit;width:200px;">
      <button type="submit" style="font-size:0.75rem;padding:0.2rem 0.5rem;">Save</button>
      <button type="button" onclick="this.closest('form').style.display='none';document.getElementById('mission-title-display').style.display=''" style="font-size:0.75rem;padding:0.2rem 0.5rem;">Cancel</button>
    </form>
  </div>
  <div class="header-right">
    ${user.email}
    <a href="/logout" class="logout-link">Log out</a>
  </div>
</header>
<div class="layout">
  <aside class="sidebar">
    <div class="sidebar-label">Workspace</div>
    <nav class="tabs">
      ${tabHtml}
    </nav>
    <div class="sidebar-divider"></div>
    <div class="sidebar-footer">
      <div class="label">Mission</div>
      <div class="mission-name">${mission.title}</div>
      <div class="mission-status">${mission.status}</div>
    </div>
  </aside>
  <main class="main">
    ${content}
  </main>
</div>
</body>
</html>`;
}

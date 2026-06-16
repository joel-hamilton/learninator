import { HTMX_HEAD, HTMX_LOADING_BAR, svgIcon, userInitial, userMenu } from "./shared.js";

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
  /* Header */
  .header {
    background: rgba(255,255,255,0.85);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
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
  .header .logo {
    font-size: 1rem; font-weight: 700; letter-spacing: -0.02em;
    display: flex; align-items: center; gap: 0.4rem;
    color: var(--text); text-decoration: none; flex-shrink: 0;
  }
  .header .logo:hover { color: var(--text); }
  .header .logo .svg-icon { width: 1.15em; height: 1.15em; color: var(--accent); }
  .header-title {
    font-size: 0.9rem; font-weight: 600; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap;
  }
  .status-tag {
    display: inline-block;
    font-size: 0.62rem; font-weight: 600; padding: 0.18rem 0.5rem;
    border-radius: 999px; text-transform: uppercase; letter-spacing: 0.04em;
    margin-left: 0.5rem; vertical-align: middle;
  }
  .tag-active { background: var(--success-bg); color: var(--success); border: 1px solid var(--success-border); }
  .tag-onboarding { background: var(--warning-bg); color: var(--warning); border: 1px solid var(--warning-border); }
  .tag-archived { background: var(--primary-light); color: var(--text-muted); }
  .header-right { display: flex; align-items: center; gap: 0.75rem; font-size: 0.8rem; color: var(--text-secondary); flex-shrink: 0; }

  /* Layout */
  .layout {
    display: grid;
    grid-template-columns: 250px 1fr;
    min-height: calc(100vh - 56px);
    transition: grid-template-columns 0.25s ease;
  }
  .layout.sidebar-collapsed { grid-template-columns: 0 1fr; }
  .layout.sidebar-collapsed .sidebar { padding: 0; border-right: none; overflow: hidden; }

  @media (max-width: 768px) {
    .layout:not(.sidebar-open) { grid-template-columns: 0 1fr; }
    .layout:not(.sidebar-open) .sidebar { overflow: hidden; padding: 0; border-right: none; min-width: 0; }
  }

  /* Sidebar */
  .sidebar {
    background: var(--surface); border-right: 1px solid var(--border);
    padding: 1.25rem 0.75rem; display: flex; flex-direction: column;
    position: sticky; top: 56px; height: calc(100vh - 56px); overflow-y: auto;
    transition: padding 0.25s ease, border 0.25s ease;
  }
  .sidebar-back {
    font-size: 0.78rem; color: var(--text-secondary); text-decoration: none;
    display: inline-flex; align-items: center; gap: 0.3rem;
    padding: 0.35rem 0.65rem; border: 1px solid var(--border); border-radius: var(--radius-sm);
    transition: all var(--transition); margin-bottom: 0.85rem;
  }
  .sidebar-back:hover { border-color: var(--border-hover); color: var(--text); background: var(--surface-hover); }
  .sidebar-back .svg-icon { width: 0.8em; height: 0.8em; }

  /* Sidebar toggle */
  .sidebar-toggle {
    position: absolute;
    right: -12px;
    bottom: 80px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-muted);
    font-size: 0.65rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    transition: all 0.2s ease;
    padding: 0;
    line-height: 1;
  }
  .sidebar-toggle:hover {
    border-color: var(--primary);
    color: var(--primary);
    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  }
  .sidebar-toggle svg {
    width: 10px;
    height: 10px;
    transition: transform 0.25s ease;
  }
  .sidebar-collapsed .sidebar-toggle { right: -28px; }
  .sidebar-collapsed .sidebar-toggle svg { transform: rotate(180deg); }

  .sidebar-label {
    font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.07em;
    color: var(--text-muted); font-weight: 600; padding: 0 0.5rem; margin-bottom: 0.35rem;
  }
  .tabs { display: flex; flex-direction: column; gap: 2px; }
  .tab {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 0.55rem 0.75rem; border-radius: var(--radius-sm);
    font-size: 0.85rem; color: var(--text-secondary); text-decoration: none;
    transition: all var(--transition); font-weight: 500;
  }
  .tab:hover { background: var(--accent-ghost); color: var(--text); }
  .tab.active {
    background: var(--accent-light); color: var(--accent); font-weight: 600;
  }
  .tab-icon { width: 1.2em; text-align: center; flex-shrink: 0; }
  .tab-icon .svg-icon { width: 1em; height: 1em; color: var(--text-muted); transition: color var(--transition); }
  .tab:hover .tab-icon .svg-icon, .tab.active .tab-icon .svg-icon { color: inherit; }

  .sidebar-divider { height: 1px; background: var(--border); margin: 0.85rem 0.4rem; }

  .sidebar-footer {
    margin-top: auto; padding: 0.85rem 0.75rem;
    background: linear-gradient(135deg, var(--accent-ghost), var(--bg));
    border: 1px solid var(--border); border-radius: var(--radius-sm);
  }
  .sidebar-footer .label {
    font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.07em;
    color: var(--text-muted); font-weight: 600; margin-bottom: 0.25rem;
  }
  .sidebar-footer .mission-name { font-size: 0.8rem; color: var(--text); font-weight: 600; margin-bottom: 0.1rem; }
  .sidebar-footer .mission-status { font-size: 0.7rem; color: var(--text-muted); }

  /* Main */
  .main { padding: 2rem 2.5rem; overflow: auto; animation: fadeInUp 0.35s ease-out; }

  /* Lesson Cards */
  .lesson-list { display: grid; gap: 0; }
  .lesson-card:not(.lesson-card--sub):not(:first-child) { margin-top: 0.65rem; }
  .lesson-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 0.85rem 1.15rem; display: flex; align-items: center; justify-content: space-between;
    text-decoration: none; color: inherit; cursor: pointer;
    transition: all var(--transition-slow);
  }
  .lesson-card:hover { border-color: var(--border-hover); background: var(--surface-hover); box-shadow: var(--shadow-sm); }
  .lesson-card .info { display: flex; align-items: center; gap: 0.7rem; min-width: 0; }
  .lesson-card .num { font-size: 0.68rem; color: var(--text-muted); font-family: ui-monospace, monospace; flex-shrink: 0; font-weight: 500; }
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
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 1rem 1.15rem; transition: all var(--transition-slow);
  }
  .ref-card:hover { border-color: var(--border-hover); background: var(--surface-hover); box-shadow: var(--shadow-sm); }
  .ref-card h3 { font-size: 0.9rem; font-weight: 500; }
  .ref-card .type { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; margin-bottom: 0.2rem; }

  /* Learning Records (text-only, not clickable) */
  .record-list { display: flex; flex-direction: column; }
  .record-card {
    padding: 1rem 0;
  }
  .record-card + .record-card { border-top: 1px solid var(--border); }
  .record-card .record-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; flex-wrap: wrap; }
  .record-card .record-header .meta { font-size: 0.68rem; color: var(--text-muted); font-family: ui-monospace, monospace; }
  .record-card h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 0.4rem; }
  .record-card .content { font-size: 0.85rem; color: var(--text-secondary); line-height: 1.55; }
  .record-card .content.markdown-body { font-size: 0.85rem; }

  /* Resources */
  .resource-markdown {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 1.5rem; line-height: 1.6; font-size: 0.88rem;
  }

  /* Chat */
  #chat-messages {
    display: flex; flex-direction: column; gap: 0.75rem;
    margin-bottom: 1rem; max-height: 60vh; overflow-y: auto; padding: 0.25rem;
  }

  /* Tool Banner */
  .tool-banner {
    position: sticky;
    top: 56px;
    z-index: 99;
    background: var(--warning-bg);
    border-bottom: 1px solid var(--warning-border);
    font-size: 0.78rem;
    color: var(--warning);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-weight: 500;
    max-height: 0;
    overflow: hidden;
    transition: all 0.2s ease;
    padding: 0 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .tool-banner.visible {
    max-height: 38px;
    padding: 0.45rem 1.5rem;
  }

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
    <span class="header-title" id="mission-title-display" style="cursor:pointer" title="Click to rename" onclick="this.style.display='none';document.getElementById('mission-title-edit').style.display='inline-flex';document.getElementById('title-input').focus();document.getElementById('title-input').select();">${mission.title}${statusTag}</span>
    <form id="mission-title-edit" hx-put="/missions/${mission.id}/title" hx-target="#mission-title-display" hx-swap="outerHTML" style="display:none;align-items:center;gap:0.35rem;" hx-on::after-request="this.style.display='none'">
      <input type="text" id="title-input" name="title" value="${mission.title.replace(/"/g, "&quot;")}" style="font-size:0.85rem;padding:0.25rem 0.55rem;border:1.5px solid var(--border);border-radius:6px;font-family:inherit;width:200px;">
      <button type="submit" style="font-size:0.75rem;padding:0.25rem 0.55rem;border-radius:6px;border:1px solid var(--border);background:var(--surface);cursor:pointer;font-family:inherit;">Save</button>
      <button type="button" onclick="this.closest('form').style.display='none';document.getElementById('mission-title-display').style.display=''" style="font-size:0.75rem;padding:0.25rem 0.55rem;border-radius:6px;border:1px solid var(--border);background:var(--surface);cursor:pointer;font-family:inherit;">Cancel</button>
    </form>
  </div>
  <div class="header-right">${userMenu(user)}</div>
</header>
<div id="tool-banner" class="tool-banner"></div>
<div class="layout">
  <aside class="sidebar">
    <a href="${backHref}" class="sidebar-back">${svgIcon("arrowLeft")} ${backLabel}</a>
    <button class="sidebar-toggle" title="Toggle sidebar" aria-label="Toggle sidebar">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="10 3 5 8 10 13"/></svg>
    </button>
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
<script>
(function() {
  // Tool banner (SSE)
  var banner = document.getElementById("tool-banner");
  if (banner) {
    var parts = window.location.pathname.split("/");
    var missionId = parts[2];
    if (missionId && !isNaN(Number(missionId))) {
      var activeTools = [];
      var inFlight = 0;
      var shownAt = 0;
      var hideTimer = 0;
      var MIN_SHOW_MS = 1200;

      document.addEventListener("htmx:beforeRequest", function(e) {
        var el = e.target;
        var form = (el && el.closest) ? el.closest(".chat-form") : null;
        if (!form) form = document.querySelector(".chat-form");
        if (form) {
          inFlight++;
          showBanner("Working...");
        }
      });

      document.addEventListener("htmx:afterRequest", function(e) {
        var el = e.target;
        var form = (el && el.closest) ? el.closest(".chat-form") : null;
        if (!form) form = document.querySelector(".chat-form");
        if (form) {
          inFlight--;
          if (inFlight <= 0) inFlight = 0;
          if (inFlight <= 0 && activeTools.length === 0) hideBanner();
        }
      });

      var es = new EventSource("/missions/" + missionId + "/chat/tool-events");

      es.addEventListener("message", function(e) {
        try {
          var event = JSON.parse(e.data);
          if (event.type === "tool_start") {
            event.names.forEach(function(n) { if (activeTools.indexOf(n) === -1) activeTools.push(n); });
            showBanner(activeTools.join(", "));
          } else if (event.type === "tool_end") {
            activeTools = activeTools.filter(function(t) { return event.names.indexOf(t) === -1; });
            if (activeTools.length === 0) {
              if (inFlight > 0) showBanner("Working...");
              else hideBanner();
            }
          }
        } catch(ex) {}
      });

      es.addEventListener("error", function() {});

      function showBanner(msg) {
        shownAt = Date.now();
        clearTimeout(hideTimer);
        banner.innerHTML = '<span class="spinner"></span> ' + msg;
        banner.classList.add("visible");
      }

      function hideBanner() {
        var elapsed = Date.now() - shownAt;
        if (elapsed < MIN_SHOW_MS) {
          hideTimer = setTimeout(function() {
            banner.classList.remove("visible");
          }, MIN_SHOW_MS - elapsed);
        } else {
          banner.classList.remove("visible");
        }
      }
    }
  }

  // Sidebar toggle
  var toggle = document.querySelector(".sidebar .sidebar-toggle");
  var layout = document.querySelector(".layout");
  if (toggle && layout) {
    if (window.innerWidth <= 768) {
      layout.classList.add("sidebar-collapsed");
    }
    toggle.addEventListener("click", function() {
      layout.classList.toggle("sidebar-collapsed");
    });
  }
})();
</script>
</body>
</html>`;
}

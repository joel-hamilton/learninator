import { HTMX_HEAD, HTMX_LOADING_BAR } from "./shared.js";

export function missionLayout(user: { email: string }, mission: { id: number; title: string; status: string }, content: string, activeTab: string = "lessons") {
  const tabs = [
    { key: "lessons", label: "Lessons", href: `/missions/${mission.id}` },
    { key: "chat", label: "Chat", href: `/missions/${mission.id}/chat` },
    { key: "reference", label: "Reference", href: `/missions/${mission.id}/reference` },
    { key: "records", label: "Learning Records", href: `/missions/${mission.id}/records` },
    { key: "resources", label: "Resources", href: `/missions/${mission.id}/resources` },
  ];

  const tabHtml = tabs.map((t) =>
    `<a href="${t.href}" class="${t.key === activeTab ? "tab active" : "tab"}">${t.label}</a>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${mission.title} — Learninator</title>
${HTMX_HEAD}
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #fdfcf9; color: #2d2d2d; min-height: 100vh; }
  .header { background: #fff; border-bottom: 1px solid #e8e4dc; padding: 0 2rem; display: flex; align-items: center; justify-content: space-between; height: 56px; }
  .header .left { display: flex; align-items: center; gap: 1rem; }
  .header h1 { font-size: 1.1rem; font-weight: 600; }
  .header .back { font-size: 0.85rem; color: #888; text-decoration: none; }
  .header .back:hover { color: #2d2d2d; }
  .header .user { font-size: 0.85rem; color: #888; }
  .header .user a { color: #888; text-decoration: none; margin-left: 0.5rem; }
  .header .user a:hover { color: #2d2d2d; }
  .layout { display: grid; grid-template-columns: 260px 1fr; min-height: calc(100vh - 56px); }
  .sidebar { background: #fff; border-right: 1px solid #e8e4dc; padding: 1.5rem; }
  .sidebar h2 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #aaa; margin-bottom: 1rem; }
  .tabs { display: flex; flex-direction: column; gap: 0.25rem; }
  .tab { display: block; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.9rem; color: #555; text-decoration: none; }
  .tab:hover { background: #faf7f0; }
  .tab.active { background: #f0ebe0; color: #2d2d2d; font-weight: 500; }
  .mission-info { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e8e4dc; }
  .mission-info .label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #aaa; }
  .mission-info .text { font-size: 0.85rem; color: #555; margin-top: 0.25rem; line-height: 1.5; }
  .main { padding: 2rem; overflow: auto; }
  .lesson-list { display: grid; gap: 0.5rem; }
  .lesson-card { background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 1.25rem; display: flex; align-items: center; justify-content: space-between; text-decoration: none; color: inherit; cursor: pointer; transition: border-color 0.15s; }
  .lesson-card:hover { border-color: #b8a88a; }
  .lesson-card .num { font-size: 0.8rem; color: #aaa; font-family: monospace; margin-right: 0.75rem; }
  .lesson-card .info { display: flex; align-items: center; gap: 0.75rem; }
  .lesson-card h3 { font-size: 0.95rem; }
  .lesson-card .status { font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px; }
  .lesson-card--sub { margin-left: 2rem; border-left: 3px solid #e8e4dc; border-radius: 8px 0 0 8px; }
  .lesson-card--sub .num { font-size: 0.75rem; }
  .status-active { background: #faf7f0; color: #888; }
  .status-in-progress { background: #fef5e7; color: #8b6914; }
  .status-completed { background: #e8f0e4; color: #2d5a27; }
  .empty { text-align: center; color: #888; padding: 3rem; }
  .ref-list { display: grid; gap: 0.5rem; }
  .ref-card { background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 1.25rem; }
  .ref-card:hover { border-color: #b8a88a; }
  .ref-card h3 { font-size: 0.95rem; }
  .ref-card .type { font-size: 0.75rem; color: #aaa; text-transform: uppercase; }
  .record-list { display: grid; gap: 0.5rem; }
  .record-card { background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 1.25rem; }
  .record-card:hover { border-color: #b8a88a; }
  .record-card h3 { font-size: 0.95rem; margin-bottom: 0.5rem; }
  .record-card .content { font-size: 0.85rem; color: #555; line-height: 1.5; }
  .record-card .meta { font-size: 0.75rem; color: #aaa; }
  .record-card .superseded { background: #fef5f5; color: #8b2e2e; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; }
  .resource-markdown { background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 1.5rem; line-height: 1.6; font-size: 0.9rem; }
  #chat-messages { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
  .msg { padding: 0.75rem 1rem; border-radius: 8px; line-height: 1.5; font-size: 0.95rem; }
  .msg.assistant { background: #fff; border: 1px solid #e8e4dc; align-self: flex-start; max-width: 85%; }
  .msg.user { background: #f0ebe0; align-self: flex-end; max-width: 85%; }
  .chat-form { display: flex; gap: 0.5rem; }
  .chat-form textarea { flex: 1; padding: 0.7rem 1rem; border: 1px solid #e8e4dc; border-radius: 8px; font-size: 1rem; font-family: inherit; resize: none; }
  .chat-form textarea:focus { outline: none; border-color: #b8a88a; }
  .chat-form button { padding: 0.7rem 1.5rem; background: #2d2d2d; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .chat-form button:hover { background: #444; }
  .spinner { display: inline-block; width: 1em; height: 1em; border: 2px solid #ccc; border-top-color: #888; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 0.5rem; }
</style>
</head>
<body>
${HTMX_LOADING_BAR}
<header class="header">
  <div class="left">
    <a href="/" class="back">&larr; Dashboard</a>
    <h1>${mission.title}</h1>
  </div>
  <div class="user">${user.email} <a href="/logout">Log out</a></div>
</header>
<div class="layout">
  <aside class="sidebar">
    <h2>Workspace</h2>
    <nav class="tabs">
      ${tabHtml}
    </nav>
    <div class="mission-info">
      <div class="label">Mission</div>
      <div class="text">${mission.title} &middot; ${mission.status}</div>
    </div>
  </aside>
  <main class="main">
    ${content}
  </main>
</div>
</body>
</html>`;
}

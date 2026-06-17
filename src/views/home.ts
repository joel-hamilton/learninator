import type { User } from "../types.js";
import { HTMX_HEAD, HTMX_LOADING_BAR, svgIcon, userInitial, userMenu } from "./shared.js";

export function layout(user: User, content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Learninator</title>
${HTMX_HEAD}
<style>
  .header {
    background: var(--paper);
    border-bottom: 1px solid var(--rule);
    padding: 0 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 56px;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .header .logo {
    font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em;
    display: flex; align-items: center; gap: 0.45rem;
    color: var(--ink); text-decoration: none;
    font-family: var(--font-display);
  }
  .header .logo:hover { color: var(--ink); }
  .header .logo .svg-icon { width: 1.2em; height: 1.2em; color: var(--rubric); }
  .header .user-area { display: flex; align-items: center; gap: 0.75rem; }

  .container { max-width: 860px; margin: 0 auto; padding: 3rem 2rem; }

  /* Welcome */
  .welcome { margin-bottom: 2rem; animation: fadeInUp 0.4s ease-out; }
  .welcome h2 { font-size: 2rem; font-weight: 700; margin-bottom: 0.35rem; letter-spacing: -0.02em; font-family: var(--font-display); }
  .welcome p { color: var(--ink-secondary); font-size: 1rem; line-height: 1.6; }

  /* Empty State */
  .empty-state { text-align: center; padding: 5rem 2rem; animation: fadeInUp 0.4s ease-out; }
  .empty-state h2 { font-size: 2.25rem; margin-bottom: 0.5rem; font-weight: 700; letter-spacing: -0.02em; font-family: var(--font-display); }
  .empty-state p { color: var(--ink-secondary); margin-bottom: 2rem; font-size: 1rem; line-height: 1.6; }
  .empty-state form { display: flex; gap: 0.6rem; justify-content: center; }
  .empty-state .textarea-wrapper { width: 440px; }
  .empty-state textarea {
    padding: 0.85rem 1.1rem; padding-bottom: 1.5rem; border: 1.5px solid var(--rule); border-radius: var(--radius-lg);
    font-size: 0.95rem; width: 100%; box-sizing: border-box; font-family: inherit; resize: none;
    transition: all var(--transition-slow); outline: none; background: var(--surface);
    box-shadow: var(--shadow-sm);
  }
  .empty-state textarea:focus { border-color: var(--ink); box-shadow: 0 0 0 4px rgba(30,27,24,0.05); }
  .empty-state textarea::placeholder { color: var(--ink-muted); }
  .empty-state button[type="submit"] {
    padding: 0.8rem 1.8rem; background: var(--rubric); color: #fff;
    border: none; border-radius: var(--radius-lg); font-size: 0.9rem; font-weight: 600;
    cursor: pointer; transition: all var(--transition-slow); font-family: inherit;
    box-shadow: 0 1px 3px rgba(192,57,43,0.2);
    white-space: nowrap;
  }
  .empty-state button[type="submit"]:hover { background: var(--rubric-hover); box-shadow: 0 4px 14px rgba(192,57,43,0.3); }

  .examples { display: flex; gap: 0.6rem; justify-content: center; margin-top: 1.75rem; flex-wrap: wrap; }
  .example-btn {
    padding: 0.55rem 1.2rem; background: var(--surface); border: 1px solid var(--rule);
    border-radius: 999px; font-size: 0.82rem; font-weight: 500; cursor: pointer;
    color: var(--ink-secondary); transition: all var(--transition-slow); font-family: inherit;
    box-shadow: var(--shadow-sm);
  }
  .example-btn:hover { border-color: var(--ink); color: var(--ink); background: var(--margin); transform: translateY(-1px); }

  /* Add New */
  .add-new { margin-top: 2rem; margin-bottom: 2rem; }
  .add-new a {
    font-size: 0.88rem; font-weight: 600; color: var(--rubric); text-decoration: none;
    padding: 0.65rem 1.3rem; border: 1.5px dashed var(--rubric); border-radius: var(--radius);
    display: inline-flex; align-items: center; gap: 0.45rem; transition: all var(--transition-slow);
    background: var(--rubric-light);
  }
  .add-new a:hover { background: var(--rubric); border-style: solid; color: #fff; }
  .add-new a .svg-icon { width: 0.9em; height: 0.9em; }

  /* Mission List */
  .mission-list { display: grid; gap: 0.65rem; }

  /* Mission Card */
  .mission-card {
    background: var(--surface); border: 1px solid var(--rule); border-radius: var(--radius-lg);
    padding: 1.15rem 1.25rem; display: flex; align-items: center; justify-content: space-between;
    transition: all var(--transition-slow);
    box-shadow: var(--shadow-sm);
    position: relative;
    overflow: hidden;
  }
  .mission-card::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    background: var(--rubric); opacity: 0; transition: opacity var(--transition-slow);
  }
  .mission-card:hover {
    border-color: var(--rule-hover);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }
  .mission-card:hover::before { opacity: 1; }
  .mission-card .info { flex: 1; min-width: 0; }
  .mission-card .info h3 { font-size: 1rem; font-weight: 600; margin-bottom: 0.3rem; letter-spacing: -0.01em; font-family: var(--font-display); }
  .mission-card .info .meta { font-size: 0.76rem; color: var(--ink-muted); display: flex; gap: 0.45rem; align-items: center; }
  .mission-card .actions { display: flex; gap: 0.5rem; align-items: center; margin-left: 1.5rem; flex-shrink: 0; }
  .mission-card .actions .btn-primary { font-weight: 600; }
</style>
</head>
<body data-user-initial="${userInitial(user)}">
${HTMX_LOADING_BAR}
<header class="header">
  <a href="/" class="logo">${svgIcon("zap")} Learninator</a>
  <div class="user-area">${userMenu(user)}</div>
</header>
<div class="container">
${content}
</div>
</body>
</html>`;
}

import type { User } from "../types.js";
import { HTMX_HEAD, HTMX_LOADING_BAR, svgIcon } from "./shared.js";

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
    background: rgba(255,255,255,0.9);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
    padding: 0 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 54px;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .header h1 { font-size: 1.05rem; font-weight: 700; letter-spacing: -0.01em; display: flex; align-items: center; gap: 0.4rem; }
  .header h1 .svg-icon { width: 1.1em; height: 1.1em; color: var(--accent); }
  .header .user { font-size: 0.78rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.75rem; }
  .header .user a {
    color: var(--text-secondary); text-decoration: none; font-weight: 500;
    transition: color var(--transition); display: inline-flex; align-items: center; gap: 0.25rem;
    padding: 0.25rem 0.55rem; border: 1px solid var(--border); border-radius: var(--radius-sm);
  }
  .header .user a:hover { border-color: var(--border-hover); color: var(--text); background: var(--surface-hover); }
  .header .user a .svg-icon { width: 0.85em; height: 0.85em; }

  .container { max-width: 860px; margin: 0 auto; padding: 2.5rem 2rem; }

  /* ── Welcome ── */
  .welcome { margin-bottom: 2.5rem; animation: fadeInUp 0.35s ease-out; }
  .welcome h2 { font-size: 1.6rem; font-weight: 700; margin-bottom: 0.3rem; letter-spacing: -0.02em; }
  .welcome p { color: var(--text-secondary); font-size: 0.95rem; line-height: 1.5; }

  /* ── Empty State ── */
  .empty-state { text-align: center; padding: 5rem 2rem; animation: fadeInUp 0.35s ease-out; }
  .empty-state h2 { font-size: 1.6rem; margin-bottom: 0.5rem; font-weight: 700; }
  .empty-state p { color: var(--text-secondary); margin-bottom: 2rem; font-size: 0.95rem; line-height: 1.6; }
  .empty-state form { display: flex; gap: 0.5rem; justify-content: center; }
  .empty-state .textarea-wrapper { width: 420px; }
  .empty-state textarea {
    padding: 0.8rem 1rem; padding-bottom: 1.5rem; border: 1px solid var(--border); border-radius: var(--radius);
    font-size: 0.9rem; width: 100%; box-sizing: border-box; font-family: inherit; resize: none;
    transition: all var(--transition-slow); outline: none; background: var(--surface);
  }
  .empty-state textarea:focus { border-color: var(--accent); }
  .empty-state textarea::placeholder { color: var(--text-muted); }
  .empty-state button[type="submit"] {
    padding: 0.75rem 1.6rem; background: var(--primary); color: #fff;
    border: none; border-radius: var(--radius); font-size: 0.9rem; font-weight: 600;
    cursor: pointer; transition: all var(--transition-slow); font-family: inherit;
  }
  .empty-state button[type="submit"]:hover { background: var(--primary-hover); }

  .examples { display: flex; gap: 0.6rem; justify-content: center; margin-top: 1.75rem; flex-wrap: wrap; }
  .example-btn {
    padding: 0.5rem 1.1rem; background: var(--surface); border: 1px solid var(--border);
    border-radius: 999px; font-size: 0.82rem; font-weight: 500; cursor: pointer;
    color: var(--text-secondary); transition: all var(--transition-slow); font-family: inherit;
  }
  .example-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }

  /* ── Add New ── */
  .add-new { margin-top: 2rem; }
  .add-new a {
    font-size: 0.88rem; font-weight: 600; color: var(--text-secondary); text-decoration: none;
    padding: 0.6rem 1.2rem; border: 1.5px dashed var(--border-hover); border-radius: var(--radius);
    display: inline-flex; align-items: center; gap: 0.4rem; transition: all var(--transition-slow);
  }
  .add-new a:hover { background: var(--accent-light); border-style: solid; border-color: var(--accent); color: var(--accent); }
  .add-new a .svg-icon { width: 0.9em; height: 0.9em; }

  /* ── Mission List ── */
  .mission-list { display: grid; gap: 0.75rem; }

  /* ── Mission Card ── */
  .mission-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 1.25rem; display: flex; align-items: center; justify-content: space-between;
  }
  .mission-card .info { flex: 1; }
  .mission-card .info h3 { font-size: 1rem; font-weight: 600; margin-bottom: 0.3rem; }
  .mission-card .info .meta { font-size: 0.78rem; color: var(--text-muted); display: flex; gap: 0.4rem; align-items: center; }
  .mission-card .actions { display: flex; gap: 0.5rem; align-items: center; margin-left: 1.5rem; flex-shrink: 0; }
  .mission-card .btn-primary { background: var(--primary); color: #fff; font-weight: 600; }
  .mission-card .btn-primary:hover { background: var(--primary-hover); }
</style>
</head>
<body>
${HTMX_LOADING_BAR}
<header class="header">
  <h1>${svgIcon("zap")} Learninator</h1>
  <div class="user">${user.email} <a href="/logout">${svgIcon("logOut")} Log out</a></div>
</header>
<div class="container">
${content}
</div>
</body>
</html>`;
}

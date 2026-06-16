import type { User } from "../types.js";
import { HTMX_HEAD, HTMX_LOADING_BAR } from "./shared.js";

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
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 0 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 60px;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .header h1 { font-size: 1.15rem; font-weight: 700; letter-spacing: -0.01em; }
  .header .user { font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; }
  .header .user a { color: var(--text-secondary); text-decoration: none; margin-left: 1.2rem; font-weight: 500; transition: color var(--transition); }
  .header .user a:hover { color: var(--primary); }

  .container { max-width: 860px; margin: 0 auto; padding: 2.5rem 2rem; }

  /* ── Welcome ── */
  .welcome { margin-bottom: 3rem; animation: fadeInUp 0.35s ease-out; }
  .welcome h2 { font-size: 1.75rem; font-weight: 800; margin-bottom: 0.4rem; letter-spacing: -0.02em; }
  .welcome p { color: var(--text-secondary); font-size: 0.98rem; line-height: 1.5; }

  /* ── Empty State ── */
  .empty-state { text-align: center; padding: 5rem 2rem; animation: fadeInUp 0.35s ease-out; }
  .empty-state h2 { font-size: 1.75rem; margin-bottom: 0.7rem; font-weight: 800; }
  .empty-state p { color: var(--text-secondary); margin-bottom: 2rem; font-size: 0.98rem; line-height: 1.6; }
  .empty-state form { display: flex; gap: 0.6rem; justify-content: center; }
	.empty-state .textarea-wrapper { width: 400px; }
  .empty-state textarea {
    padding: 0.9rem 1.1rem; padding-bottom: 1.5rem; border: 2px solid var(--border); border-radius: var(--radius-lg);
    font-size: 0.95rem; width: 100%; box-sizing: border-box; font-family: inherit; resize: none;
    transition: all var(--transition-slow); outline: none; background: var(--surface);
  }
  .empty-state textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(45,45,45,0.08); background: var(--surface); }
  .empty-state textarea::placeholder { color: var(--text-muted); }
  .empty-state button[type="submit"] {
    padding: 0.8rem 1.8rem; background: var(--primary); color: #fff;
    border: none; border-radius: var(--radius-lg); font-size: 0.95rem; font-weight: 600;
    cursor: pointer; transition: all var(--transition-slow); font-family: inherit;
    box-shadow: var(--shadow-sm);
  }
  .empty-state button[type="submit"]:hover { background: var(--primary-hover); box-shadow: var(--shadow-md); transform: translateY(-1px); }
  .empty-state button[type="submit"]:active { transform: translateY(0); }

  .examples { display: flex; gap: 0.7rem; justify-content: center; margin-top: 2rem; flex-wrap: wrap; }
  .example-btn {
    padding: 0.55rem 1.2rem; background: var(--surface); border: 1.5px solid var(--border);
    border-radius: 999px; font-size: 0.85rem; font-weight: 500; cursor: pointer;
    color: var(--text-secondary); transition: all var(--transition-slow); font-family: inherit;
  }
  .example-btn:hover { border-color: var(--primary); color: var(--primary); box-shadow: var(--shadow-md); background: var(--primary-light); }

  /* ── Add New ── */
  .add-new { margin-top: 2.5rem; }
  .add-new a {
    font-size: 0.92rem; font-weight: 600; color: var(--text-secondary); text-decoration: none;
    padding: 0.7rem 1.3rem; border: 2px dashed var(--border-hover); border-radius: var(--radius-lg);
    display: inline-flex; align-items: center; gap: 0.5rem; transition: all var(--transition-slow);
  }
  .add-new a:hover { background: var(--primary-light); border-style: solid; border-color: var(--primary); color: var(--primary); box-shadow: var(--shadow-sm); }

  /* ── Mission List ── */
  .mission-list { display: grid; gap: 1rem; }

  /* ── Mission Card ── */
  .mission-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
    padding: 1.5rem; display: flex; align-items: center; justify-content: space-between;
    box-shadow: var(--shadow-sm);
  }
  .mission-card .info { flex: 1; }
  .mission-card .info h3 { font-size: 1.05rem; font-weight: 700; margin-bottom: 0.4rem; }
  .mission-card .info .meta { font-size: 0.8rem; color: var(--text-muted); display: flex; gap: 0.4rem; align-items: center; }
  .mission-card .actions { display: flex; gap: 0.6rem; align-items: center; margin-left: 1.5rem; flex-shrink: 0; }
  .mission-card .btn { margin: 0; }
  .mission-card .btn-primary { background: var(--primary); color: #fff; font-weight: 600; letter-spacing: 0.01em; }
  .mission-card .btn-primary:hover { background: var(--primary-hover); color: #fff; }
  .mission-card .btn-ghost { font-weight: 500; }
</style>
</head>
<body>
${HTMX_LOADING_BAR}
<header class="header">
  <h1>Learninator</h1>
  <div class="user">${user.email} <a href="/logout">Log out</a></div>
</header>
<div class="container">
${content}
</div>
</body>
</html>`;
}

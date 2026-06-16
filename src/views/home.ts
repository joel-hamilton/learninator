import type { User } from "../types.js";
import { HTMX_HEAD, HTMX_LOADING_BAR } from "./shared.js";
import { browseSectionHtml, BROWSE_CSS } from "./browse.js";

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
    background: rgba(255,255,255,0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 0 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 56px;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .header h1 { font-size: 1.1rem; font-weight: 600; }
  .header .user { font-size: 0.85rem; color: var(--text-secondary); }
  .header .user a { color: var(--text-secondary); text-decoration: none; margin-left: 1rem; }
  .header .user a:hover { color: var(--text); }

  .container { max-width: 860px; margin: 0 auto; padding: 2.5rem 2rem; }

  /* ── Welcome ── */
  .welcome { margin-bottom: 2.5rem; animation: fadeInUp 0.35s ease-out; }
  .welcome h2 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.3rem; letter-spacing: -0.02em; }
  .welcome p { color: var(--text-secondary); font-size: 0.95rem; }

  /* ── Empty State ── */
  .empty-state { text-align: center; padding: 4rem 2rem; animation: fadeInUp 0.35s ease-out; }
  .empty-state h2 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  .empty-state p { color: var(--text-secondary); margin-bottom: 2rem; }
  .empty-state form { display: flex; gap: 0.5rem; justify-content: center; }
	.empty-state .textarea-wrapper { width: 380px; }
  .empty-state textarea {
    padding: 0.75rem 1rem; padding-bottom: 1.3rem; border: 1px solid var(--border); border-radius: var(--radius-lg);
    font-size: 1rem; width: 100%; box-sizing: border-box; font-family: inherit; resize: none;
    transition: border-color var(--transition), box-shadow var(--transition); outline: none;
  }
  .empty-state textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(45,45,45,0.1); }
  .empty-state textarea::placeholder { color: var(--text-muted); }
  .empty-state button[type="submit"] {
    padding: 0.75rem 1.5rem; background: var(--primary); color: #fff;
    border: none; border-radius: var(--radius-lg); font-size: 1rem;
    cursor: pointer; transition: all var(--transition); font-family: inherit;
  }
  .empty-state button[type="submit"]:hover { background: var(--primary-hover); transform: translateY(-1px); }
  .empty-state button[type="submit"]:active { transform: translateY(0) scale(0.98); }

  .examples { display: flex; gap: 0.6rem; justify-content: center; margin-top: 1.5rem; flex-wrap: wrap; }
  .example-btn {
    padding: 0.5rem 1rem; background: var(--surface); border: 1px solid var(--border);
    border-radius: 999px; font-size: 0.85rem; cursor: pointer;
    color: var(--text-secondary); transition: all var(--transition); font-family: inherit;
  }
  .example-btn:hover { border-color: var(--primary); color: var(--primary); box-shadow: var(--shadow-sm); }

  /* ── Add New ── */
  .add-new { margin-bottom: 1.5rem; }
  .add-new a {
    font-size: 0.9rem; color: var(--text-secondary); text-decoration: none;
    padding: 0.6rem 1rem; border: 1px dashed var(--border-hover); border-radius: var(--radius-lg);
    display: inline-flex; align-items: center; gap: 0.4rem; transition: all var(--transition);
  }
  .add-new a:hover { background: var(--primary-light); border-style: solid; border-color: var(--primary); color: var(--text); }

  /* ── Mission List ── */
  .mission-list { display: grid; gap: 0.75rem; }

  /* ── Mission Card ── */
  .mission-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
    padding: 1.25rem 1.5rem; display: flex; align-items: center; justify-content: space-between;
    transition: all var(--transition-slow); box-shadow: var(--shadow-sm);
    border-left: 4px solid var(--primary);
  }
  .mission-card:hover {
    border-color: var(--primary); box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }
  .mission-card .info h3 { font-size: 1rem; font-weight: 600; margin-bottom: 0.2rem; }
  .mission-card .info .meta { font-size: 0.8rem; color: var(--text-muted); }
  .mission-card .actions { display: flex; gap: 0.5rem; align-items: center; }
  ${BROWSE_CSS}
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

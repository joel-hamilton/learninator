/** Shared HTML snippets for all pages. */

export const HTMX_HEAD = `<script src="https://unpkg.com/htmx.org@2.0.10"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet">
<style>
  /* ── Design Tokens ── */
  :root {
    --paper: #fdfbf7;
    --margin: #f3efe8;
    --surface: #fefdfb;
    --surface-hover: #f6f2eb;
    --rule: #e0dbd2;
    --rule-hover: #cbc4b7;
    --ink: #1e1b18;
    --ink-secondary: #5c5650;
    --ink-muted: #9c9589;
    --rubric: #c0392b;
    --rubric-hover: #a33025;
    --rubric-light: #fdf5f4;
    --rubric-ghost: #fef8f7;
    --note: #3b6b9e;
    --note-hover: #2f5682;
    --note-light: #f4f8fc;
    --success: #3d6b4f;
    --success-bg: #f2f8f4;
    --success-border: #cfe0d4;
    --warning: #9e6a22;
    --warning-bg: #fefaf3;
    --warning-border: #f5e2bc;
    --danger: #b5342e;
    --danger-bg: #fef5f4;
    --danger-border: #f9d6d4;
    --info: #3b6b9e;
    --info-bg: #f4f8fc;
    --radius-sm: 6px;
    --radius: 8px;
    --radius-lg: 12px;
    --radius-xl: 16px;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
    --shadow: 0 1px 3px rgba(0,0,0,0.05);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
    --shadow-lg: 0 8px 24px rgba(0,0,0,0.08);
    --shadow-xl: 0 12px 40px rgba(0,0,0,0.10);
    --transition: 150ms ease;
    --transition-slow: 250ms cubic-bezier(0.4, 0, 0.2, 1);
    --font-display: "Crimson Text", Georgia, "Times New Roman", serif;
    --font-body: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  }

  /* ── Reset ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  body {
    font-family: var(--font-body);
    background: var(--paper);
    color: var(--ink);
    min-height: 100vh;
    font-size: 16px;
    line-height: 1.5;
  }
  a { color: var(--note); text-decoration: none; transition: color var(--transition); }
  a:hover { color: var(--note-hover); }

  /* ── Focus Ring ── */
  input:focus-visible, textarea:focus-visible, select:focus-visible, button:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
  }

  /* ── Selection ── */
  ::selection { background: rgba(192, 57, 43, 0.12); color: var(--ink); }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--rule); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--ink-muted); }

  /* ── Loading Bar ── */
  #htmx-loading-bar {
    position: fixed; top: 0; left: 0; height: 2.5px;
    background: var(--rubric);
    z-index: 9999; opacity: 0; transition: opacity 150ms; width: 0;
  }
  .htmx-request#htmx-loading-bar { opacity: 1; animation: htmx-load 2.5s ease-out; }
  @keyframes htmx-load {
    0% { width: 0; } 15% { width: 25%; } 40% { width: 55%; } 70% { width: 80%; } 100% { width: 94%; }
  }

  /* ── HTMX Indicator Toggle ── */
  .htmx-indicator { opacity: 0; transition: opacity 200ms ease-in; }
  .htmx-request .htmx-indicator, .htmx-request.htmx-indicator { opacity: 1; }
  .htmx-request .btn-label { display: none; }
  .htmx-request .htmx-indicator-inline { display: inline-flex !important; align-items: center; gap: 0.3rem; }
  .htmx-indicator-inline { display: none !important; }

  /* ── Spinner ── */
  .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--rule); border-top-color: var(--rubric); border-radius: 50%; animation: spin 0.6s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Thinking Dots ── */
  .thinking-dots { display: flex; gap: 4px; align-items: center; padding: 2px 0; }
  .thinking-dots span { width: 6px; height: 6px; background: var(--rubric); border-radius: 50%; animation: dot-bounce 1.4s infinite ease-in-out both; opacity: 0.5; }
  .thinking-dots span:nth-child(1) { animation-delay: -0.32s; }
  .thinking-dots span:nth-child(2) { animation-delay: -0.16s; }
  @keyframes dot-bounce { 0%, 80%, 100% { transform: scale(0); opacity: 0.2; } 40% { transform: scale(1); opacity: 0.85; } }

  /* ── Animations ── */
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideInRight { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: translateX(0); } }
  .fade-in { animation: fadeIn 0.25s ease-out; }
  .fade-in-up { animation: fadeInUp 0.4s ease-out; }

  /* ── Staggered card entrance ── */
  .stagger > * { animation: fadeInUp 0.4s ease-out backwards; }
  .stagger > *:nth-child(1) { animation-delay: 0.00s; }
  .stagger > *:nth-child(2) { animation-delay: 0.05s; }
  .stagger > *:nth-child(3) { animation-delay: 0.10s; }
  .stagger > *:nth-child(4) { animation-delay: 0.15s; }
  .stagger > *:nth-child(5) { animation-delay: 0.20s; }
  .stagger > *:nth-child(6) { animation-delay: 0.25s; }
  .stagger > *:nth-child(7) { animation-delay: 0.30s; }
  .stagger > *:nth-child(8) { animation-delay: 0.35s; }
  .stagger > *:nth-child(9) { animation-delay: 0.40s; }
  .stagger > *:nth-child(10) { animation-delay: 0.45s; }

  /* ── SVG Icon Library ── */
  .svg-icon { width: 1.1em; height: 1.1em; display: inline-block; vertical-align: -0.15em; flex-shrink: 0; stroke-width: 1.75; }

  /* ── Badges ── */
  .badge {
    display: inline-flex; align-items: center;
    padding: 0.18rem 0.65rem; border-radius: 999px; font-size: 0.68rem;
    font-weight: 500; line-height: 1.4; letter-spacing: 0.02em;
  }
  .badge-default { background: var(--margin); color: var(--ink-secondary); }
  .badge-active { background: var(--rubric-light); color: var(--rubric); }
  .badge-in-progress { background: var(--warning-bg); color: var(--warning); border: 1px solid var(--warning-border); }
  .badge-completed { background: var(--success-bg); color: var(--success); border: 1px solid var(--success-border); }
  .badge-superseded { background: var(--danger-bg); color: var(--danger); }
  .badge-info { background: var(--info-bg); color: var(--info); }
  .badge-ready { background: var(--success-bg); color: var(--success); border: 1px solid var(--success-border); }
  .badge-error { background: var(--danger-bg); color: var(--danger); border: 1px solid var(--danger-border); }

  /* ── Buttons ── */
  .btn {
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 0.5rem 1rem; border-radius: var(--radius-sm); font-size: 0.85rem;
    font-weight: 500; cursor: pointer; transition: all var(--transition);
    border: 1px solid transparent; font-family: inherit; line-height: 1.4;
    text-decoration: none; white-space: nowrap; letter-spacing: 0.01em;
  }
  .btn:active { transform: scale(0.97); }
  .btn-primary {
    background: var(--rubric); color: #fff;
    box-shadow: 0 1px 3px rgba(192,57,43,0.18);
  }
  .btn-primary:hover { background: var(--rubric-hover); box-shadow: 0 2px 8px rgba(192,57,43,0.28); }
  .btn-secondary {
    background: var(--surface); color: var(--ink); border-color: var(--rule);
    box-shadow: var(--shadow-sm);
  }
  .btn-secondary:hover { background: var(--surface-hover); border-color: var(--rule-hover); }
  .btn-ghost {
    background: transparent; color: var(--ink-secondary); border-color: var(--rule);
  }
  .btn-ghost:hover { background: var(--surface-hover); border-color: var(--rule-hover); color: var(--ink); }
  .btn-danger {
    background: var(--surface); color: var(--danger); border-color: var(--rule);
  }
  .btn-danger:hover { background: var(--danger-bg); border-color: var(--danger-border); }
  .btn-accent {
    background: var(--ink); color: #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  }
  .btn-accent:hover { background: #3d3832; box-shadow: 0 4px 14px rgba(0,0,0,0.18); }
  .btn-sm { padding: 0.32rem 0.7rem; font-size: 0.78rem; border-radius: 6px; }
  .btn-lg { padding: 0.7rem 1.5rem; font-size: 0.95rem; border-radius: var(--radius-lg); font-weight: 600; }

  /* ── Form Elements ── */
  .input {
    padding: 0.6rem 0.85rem; border: 1.5px solid var(--rule); border-radius: var(--radius-sm);
    font-size: 0.9rem; font-family: inherit; background: var(--surface);
    color: var(--ink); transition: all var(--transition-slow); outline: none; width: 100%;
  }
  .input:hover { border-color: var(--rule-hover); }
  .input:focus { border-color: var(--ink); box-shadow: 0 0 0 3px rgba(30,27,24,0.06); }
  .input::placeholder { color: var(--ink-muted); }

  /* ── Chat Messages ── */
  .msg-row {
    position: relative; max-width: 88%;
    animation: fadeIn 0.25s ease-out;
    padding-top: 8px;
  }
  .msg-row.user { align-self: flex-end; }
  .msg-row.assistant { align-self: flex-start; }

  .msg-avatar {
    position: absolute; top: 0;
    width: 22px; height: 22px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.6rem; font-weight: 700; letter-spacing: 0.02em;
    z-index: 2;
  }
  .msg-row.user .msg-avatar { right: 3px; background: var(--ink); color: #fff; border: 2px solid var(--paper); }
  .msg-row.assistant .msg-avatar { left: 3px; background: var(--margin); color: var(--ink-secondary); border: 2px solid var(--paper); }

  .msg {
    padding: 0.65rem 0.9rem; border-radius: 14px; line-height: 1.55;
    font-size: 0.9rem;
  }
  .msg-row.user .msg {
    background: var(--ink); color: #fff;
    border-bottom-right-radius: 4px;
    border-top-right-radius: 8px;
  }
  .msg-row.assistant .msg {
    background: var(--surface); border: 1px solid var(--rule);
    color: var(--ink); border-bottom-left-radius: 4px;
    border-top-left-radius: 8px;
    box-shadow: var(--shadow-sm);
  }

  /* Standalone .msg (no .msg-row wrapper) */
  .msg.assistant:not(.msg-row .msg) {
    max-width: 88%; align-self: flex-start;
    background: var(--surface); border: 1px solid var(--rule);
    color: var(--ink); border-bottom-left-radius: 4px;
    box-shadow: var(--shadow-sm);
  }
  .msg.user:not(.msg-row .msg) {
    max-width: 88%; align-self: flex-end;
    background: var(--ink); color: #fff;
    border-bottom-right-radius: 4px;
  }

  /* Markdown overrides inside user bubbles */
  .msg-row.user .msg strong { color: #fff; }
  .msg-row.user .msg code { background: rgba(255,255,255,0.2); color: #fff; }
  .msg-row.user .msg a { color: #fff; text-decoration-color: rgba(255,255,255,0.6); }

  /* ── Chat Form ── */
  .chat-form {
    display: flex; gap: 0.5rem; align-items: flex-end;
    background: var(--surface); border: 1.5px solid var(--rule);
    border-radius: var(--radius-lg); padding: 0.5rem;
    transition: all var(--transition-slow);
    box-shadow: var(--shadow-sm);
  }
  .chat-form:focus-within { border-color: var(--ink); box-shadow: 0 0 0 4px rgba(30,27,24,0.05); }
  .chat-form .textarea-wrapper { position: relative; flex: 1; }
  .chat-form textarea {
    width: 100%; box-sizing: border-box; border: none; padding: 0.35rem 0.5rem; padding-bottom: 1.4rem;
    font-size: 0.9rem; font-family: inherit; resize: none;
    background: transparent; color: var(--ink); outline: none;
    line-height: 1.5;
  }
  .chat-form textarea::placeholder { color: var(--ink-muted); }
  .chat-form .textarea-hint {
    position: absolute;
    bottom: 4px;
    left: 6px;
    font-size: 0.65rem;
    color: var(--ink-muted);
    pointer-events: none;
    opacity: 0.55;
    line-height: 1;
    font-weight: 500;
  }
  .chat-form button {
    padding: 0.5rem 1.1rem;
    background: var(--rubric); color: #fff; border: none;
    border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 600;
    cursor: pointer; transition: all var(--transition);
    flex-shrink: 0; font-family: inherit;
    box-shadow: 0 1px 3px rgba(192,57,43,0.2);
  }
  .chat-form button:hover { background: var(--rubric-hover); box-shadow: 0 4px 12px rgba(192,57,43,0.3); }
  .chat-form button:active { transform: scale(0.97); }

  /* ── Section Label ── */
  .section-label {
    display: flex; align-items: center; gap: 0.75rem;
    font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.07em;
    color: var(--ink-muted); font-weight: 600; margin-bottom: 0.85rem;
  }
  .section-label::after { content: ''; flex: 1; height: 1px; background: var(--rule); }

  /* ── Section Header ── */
  .section-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 1rem;
  }
  .section-header h2 { font-size: 1.05rem; font-weight: 600; }

  /* ── Markdown Body ── */
  .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
    margin: 0.6em 0 0.25em; font-weight: 600; line-height: 1.3;
    font-family: var(--font-display);
  }
  .markdown-body h1 { font-size: 1.4em; letter-spacing: -0.01em; }
  .markdown-body h2 { font-size: 1.2em; letter-spacing: -0.005em; }
  .markdown-body h3 { font-size: 1.05em; }
  .markdown-body p { margin: 0.25em 0 0.55em; }
  .markdown-body ul, .markdown-body ol { margin: 0.25em 0 0.55em; padding-left: 1.6em; }
  .markdown-body li { margin: 0.15em 0; }
  .markdown-body code {
    background: var(--margin); padding: 0.15em 0.4em; border-radius: 4px;
    font-size: 0.88em; font-family: var(--font-mono);
    color: var(--rubric);
  }
  .markdown-body pre {
    background: #2d2925; color: #e8e0d5; padding: 1rem 1.25rem;
    border-radius: var(--radius); overflow-x: auto; margin: 0.6em 0;
    border: 1px solid #3d3832;
  }
  .markdown-body pre code { background: none; padding: 0; font-size: 0.85em; color: inherit; }
  .markdown-body blockquote {
    border-left: 3px solid var(--rule); margin: 0.5em 0;
    padding: 0.25em 0.85em; color: var(--ink-secondary);
    background: var(--margin);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  }
  .markdown-body table { border-collapse: collapse; margin: 0.5em 0; width: 100%; }
  .markdown-body th, .markdown-body td {
    border: 1px solid var(--rule); padding: 0.4em 0.75em; text-align: left;
  }
  .markdown-body th { background: var(--margin); font-weight: 600; font-size: 0.88em; }
  .markdown-body strong { font-weight: 600; color: var(--ink); }
  .markdown-body em { font-style: italic; }
  .markdown-body a { color: var(--note); text-decoration: underline; }
  .markdown-body hr { border: none; border-top: 1px solid var(--rule); margin: 0.85em 0; }

  /* ── User Menu ── */
  .user-menu { position: relative; }
  .user-menu-trigger {
    background: none; border: none; cursor: pointer; padding: 0;
    display: flex; align-items: center;
  }
  .user-menu-trigger .avatar {
    width: 30px; height: 30px; border-radius: 50%;
    background: var(--ink); color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.75rem; font-weight: 700; letter-spacing: 0.02em;
    flex-shrink: 0; transition: transform var(--transition);
  }
  .user-menu-trigger:hover .avatar { transform: scale(1.05); }
  .user-menu-dropdown {
    position: absolute; right: 0; top: calc(100% + 8px);
    background: var(--surface); border: 1px solid var(--rule);
    border-radius: var(--radius); box-shadow: var(--shadow-lg);
    min-width: 180px; padding: 0.35rem;
    display: none; z-index: 200;
    animation: fadeInUp 0.15s ease-out;
  }
  .user-menu-dropdown.open { display: block; }
  .user-menu-dropdown a {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.5rem 0.75rem; border-radius: var(--radius-sm);
    font-size: 0.85rem; color: var(--ink); text-decoration: none;
    transition: background var(--transition); font-weight: 500;
  }
  .user-menu-dropdown a:hover { background: var(--surface-hover); }
  .user-menu-dropdown a .svg-icon { width: 1em; height: 1em; color: var(--ink-muted); }

  /* ── Modal ── */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: 1.5rem;
    animation: fadeIn 0.2s ease-out;
  }
  .modal-content {
    background: var(--surface); border: 1px solid var(--rule);
    border-radius: var(--radius-xl); box-shadow: var(--shadow-lg);
    max-width: 520px; width: 100%; max-height: 90vh; overflow-y: auto;
    animation: fadeInUp 0.25s ease-out;
  }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1.25rem 1.5rem 0;
  }
  .modal-header h3 { font-size: 1.05rem; font-weight: 600; font-family: var(--font-display); }
  .modal-close {
    background: none; border: none; cursor: pointer; font-size: 1.2rem;
    color: var(--ink-muted); padding: 0.25rem; line-height: 1;
    border-radius: var(--radius-sm); transition: all var(--transition);
  }
  .modal-close:hover { color: var(--ink); background: var(--margin); }
  .modal-body { padding: 1rem 1.5rem; }
  .modal-body textarea {
    width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--rule);
    border-radius: var(--radius); font-size: 0.9rem; font-family: inherit;
    background: var(--surface); color: var(--ink); resize: vertical;
    transition: all var(--transition); outline: none; line-height: 1.5;
    min-height: 100px;
  }
  .modal-body textarea:focus { border-color: var(--ink); box-shadow: 0 0 0 3px rgba(30,27,24,0.06); }
  .modal-body textarea::placeholder { color: var(--ink-muted); }
  .modal-body .field-label {
    display: block; font-size: 0.82rem; font-weight: 500;
    color: var(--ink-secondary); margin-bottom: 0.4rem;
  }
  .modal-body .field + .field { margin-top: 1rem; }
  .modal-footer {
    display: flex; gap: 0.5rem; justify-content: flex-end;
    padding: 0 1.5rem 1.25rem;
  }
</style>

<script>
function optimisticChat(form) {
  const input = form.querySelector('textarea[name="message"]');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;
  const targetId = form.getAttribute("hx-target") || "#chat-messages";
  const container = document.querySelector(targetId);
  if (!container) return;

  const row = document.createElement("div");
  row.className = "msg-row user";
  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = document.body.dataset.userInitial || "Y";
  const bubble = document.createElement("div");
  bubble.className = "msg";
  bubble.textContent = msg;
  row.appendChild(avatar);
  row.appendChild(bubble);
  container.appendChild(row);

  const thinkRow = document.createElement("div");
  thinkRow.className = "msg-row assistant";
  const thinkAvatar = document.createElement("div");
  thinkAvatar.className = "msg-avatar";
  thinkAvatar.textContent = "AI";
  const thinkBubble = document.createElement("div");
  thinkBubble.className = "msg thinking-bubble";
  thinkBubble.innerHTML = '<span class="thinking-dots"><span></span><span></span><span></span></span>';
  thinkRow.appendChild(thinkAvatar);
  thinkRow.appendChild(thinkBubble);
  container.appendChild(thinkRow);
  container.scrollTop = container.scrollHeight;
  input.value = "";
  input.style.height = "auto";
  const btn = form.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; setTimeout(function() { btn.disabled = false; }, 2000); }
}
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}
document.addEventListener("keydown", function(e) {
  if (e.target.tagName !== "TEXTAREA" || e.key !== "Enter" || e.shiftKey) return;
  const chatForm = e.target.closest(".chat-form");
  if (chatForm && chatForm.dataset.sending) return;
  if (chatForm && !e.target.value.trim()) return;
  e.preventDefault();

  const form = e.target.closest("form");
  let btn;
  if (form) {
    btn = form.querySelector('button[type="submit"]');
  } else {
    let el = e.target;
    while (el && el !== document.body) {
      btn = el.querySelector('button[hx-post], button[type="submit"]');
      if (btn) break;
      el = el.parentElement;
    }
  }

  if (chatForm) chatForm.dataset.sending = "true";
  if (btn) btn.click();
  else if (form) form.requestSubmit();
});
document.addEventListener("htmx:afterRequest", function(e) {
  const form = e.target.closest(".chat-form");
  if (form) {
    delete form.dataset.sending;
    const targetId = form.getAttribute("hx-target") || "#chat-messages";
    const container = document.querySelector(targetId);
    if (container) {
      const thinking = container.querySelector(".thinking-bubble");
      if (thinking) thinking.closest(".msg-row")?.remove();
    }
  }
});
// User menu dropdown
function toggleUserMenu(btn) {
  var dd = btn.nextElementSibling;
  dd.classList.toggle('open');
}
document.addEventListener('click', function(e) {
  if (!e.target.closest('.user-menu')) {
    document.querySelectorAll('.user-menu-dropdown.open').forEach(function(d) { d.classList.remove('open'); });
  }
});
// Guided question helpers
function selectOption(row, idx) {
  const radio = row.querySelector('input[type="radio"]');
  if (radio) radio.checked = true;
  onOptionChange(idx);
}
function onOptionChange(idx) {
  const options = document.querySelectorAll('#options-container .option-row');
  options.forEach(function(row, i) { row.classList.toggle('selected', i === idx); });
  const isOther = idx === options.length - 1;
  const otherInput = document.getElementById('other-input');
  if (otherInput) otherInput.classList.toggle('visible', isOther);
  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) submitBtn.disabled = false;
  const hidden = document.getElementById('answer-hidden');
  const radio = document.querySelector('input[name="answer"]:checked');
  if (hidden && radio) hidden.value = radio.value;
}
function onOtherInput(input) {
  const hidden = document.getElementById('other-text-hidden');
  if (hidden) hidden.value = input.value;
  const answerHidden = document.getElementById('answer-hidden');
  if (answerHidden) answerHidden.value = input.value;
}
function validateAnswer() {
  const otherInput = document.getElementById('other-input');
  const otherText = document.getElementById('other-text');
  const isVisible = otherInput && otherInput.classList.contains('visible');
  if (isVisible && otherText && !otherText.value.trim()) {
    otherText.focus();
    return false;
  }
  return true;
}
function submitGuidedAnswer() {
  if (!validateAnswer()) return false;
  var section = document.getElementById('question-section');
  if (section) {
    section.innerHTML = '<div class="question-card" id="question-card"><div class="msg assistant thinking-bubble"><span class="thinking-dots"><span></span><span></span><span></span></span></div></div>';
  }
  return true;
}
function addFollowupMessage(text) {
  const container = document.querySelector("#followup-messages");
  if (!container || !text) return;
  const userDiv = document.createElement("div");
  userDiv.className = "msg user";
  userDiv.textContent = text;
  container.appendChild(userDiv);
  const thinking = document.createElement("div");
  thinking.className = "msg assistant thinking-bubble";
  thinking.innerHTML = '<span class="thinking-dots"><span></span><span></span><span></span></span>';
  container.appendChild(thinking);
  container.scrollTop = container.scrollHeight;
}
function cleanupThinking() {
  const thinking = document.querySelector("#followup-messages .thinking-bubble");
  if (thinking) thinking.remove();
}
</script>`;

/** SVG icon sprite — returns the SVG markup for a named icon */
export function svgIcon(name: string, className: string = "svg-icon"): string {
  const icons: Record<string, string> = {
    book: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    chat: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    file: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    chart: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    box: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
    arrowLeft: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    arrowRight: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    plus: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    check: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    x: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    send: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    messageCircle: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    loading: '<svg class="' + className + ' spinner-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
    home: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    zap: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    crosshair: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2"/><line x1="12" y1="2" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="22"/><line x1="2" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="22" y2="12"/></svg>',
    trash: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    archive: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
    rotateCcw: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    logOut: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    settings: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  };
  return icons[name] || "";
}

/** Animated spinner SVG icon */
export function spinnerSvg(size: number = 16): string {
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" style="animation: spin 0.6s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';
}

/** Guided question JS for onboarding pages. */
export const GUIDED_QUESTION_SCRIPT = '<script>\n' +
  'function selectOption(row, idx) {\n' +
  '  const radio = row.querySelector(\'input[type="radio"]\');\n' +
  '  if (radio) radio.checked = true;\n' +
  '  onOptionChange(idx);\n' +
  '}\n' +
  'function onOptionChange(idx) {\n' +
  '  const options = document.querySelectorAll(\'#options-container .option-row\');\n' +
  '  options.forEach(function(row, i) { row.classList.toggle(\'selected\', i === idx); });\n' +
  '  const isOther = idx === options.length - 1;\n' +
  '  const otherInput = document.getElementById(\'other-input\');\n' +
  '  if (otherInput) otherInput.classList.toggle(\'visible\', isOther);\n' +
  '  const submitBtn = document.getElementById(\'submit-btn\');\n' +
  '  if (submitBtn) submitBtn.disabled = false;\n' +
  '  const hidden = document.getElementById(\'answer-hidden\');\n' +
  '  const radio = document.querySelector(\'input[name="answer"]:checked\');\n' +
  '  if (hidden && radio) hidden.value = radio.value;\n' +
  '}\n' +
  'function onOtherInput(input) {\n' +
  '  const hidden = document.getElementById(\'other-text-hidden\');\n' +
  '  if (hidden) hidden.value = input.value;\n' +
  '  const answerHidden = document.getElementById(\'answer-hidden\');\n' +
  '  if (answerHidden) answerHidden.value = input.value;\n' +
  '}\n' +
  'function validateAnswer() {\n' +
  '  const otherInput = document.getElementById(\'other-input\');\n' +
  '  const otherText = document.getElementById(\'other-text\');\n' +
  '  const isVisible = otherInput && otherInput.classList.contains(\'visible\');\n' +
  '  if (isVisible && otherText && !otherText.value.trim()) {\n' +
  '    otherText.focus();\n' +
  '    return false;\n' +
  '  }\n' +
  '  return true;\n' +
  '}\n' +
  'function submitGuidedAnswer() {\n' +
  '  if (!validateAnswer()) return false;\n' +
  '  var section = document.getElementById(\'question-section\');\n' +
  '  if (section) {\n' +
  '    section.innerHTML = \'<div class="question-card" id="question-card"><div class="msg assistant thinking-bubble"><span class="thinking-dots"><span></span><span></span><span></span></span></div></div>\';\n' +
  '  }\n' +
  '  return true;\n' +
  '}\n' +
  '</script>';

/** Loading bar — add right after <body> in page layouts, NOT inside <head>. */
export const HTMX_LOADING_BAR = '<div id="htmx-loading-bar" class="htmx-indicator"></div>';

/** Get the first initial from a user's name or email. */
export function userInitial(user: { name?: string | null; email: string }): string {
  if (user.name?.trim()) return user.name.trim().charAt(0).toUpperCase();
  return user.email.charAt(0).toUpperCase();
}

/** SSE tool-execution banner script. Tracks htmx requests and tool events to show/hide a sticky banner. */
export function toolBannerScript(missionId: number, opts?: { bannerId?: string; trackAllHtmx?: boolean; checkGenerationBar?: boolean }): string {
  const bannerId = opts?.bannerId ?? "tool-banner";
  const trackAll = opts?.trackAllHtmx ?? false;
  const checkGenBar = opts?.checkGenerationBar ?? false;
  const formCheck = trackAll
    ? "true"
    : `(function(el) { var form = (el && el.closest) ? el.closest(".chat-form") : null; if (!form) { var fbBtn = (el && el.closest) ? el.closest("#feedback-bar button[hx-post]") : null; if (fbBtn) form = fbBtn.closest("#feedback-bar"); } return !!form; })()`;
  const genBarCheck = checkGenBar
    ? `if (document.querySelector(".generation-bar")) return;`
    : "";

  return `<script>
(function() {
  var banner = document.getElementById("${bannerId}");
  if (!banner) return;
  var activeTools = [];
  var inFlight = 0;
  var shownAt = 0;
  var hideTimer = 0;
  var MIN_SHOW_MS = 1200;

  document.addEventListener("htmx:beforeRequest", function(e) {
    if (${formCheck}) {
      inFlight++;
      showBanner("Working...");
    }
  });

  document.addEventListener("htmx:afterRequest", function(e) {
    if (${formCheck}) {
      inFlight--;
      if (inFlight <= 0) inFlight = 0;
      if (inFlight <= 0 && activeTools.length === 0) hideBanner();
    }
  });

  var es = new EventSource("/missions/${missionId}/chat/tool-events");
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
    banner.innerHTML = '<span class="spinner"></span> ' + (msg || activeTools.join(", "));
    banner.classList.add("visible");
  }

  function hideBanner() {
    ${genBarCheck}
    var elapsed = Date.now() - shownAt;
    if (elapsed < MIN_SHOW_MS) {
      hideTimer = setTimeout(function() { banner.classList.remove("visible"); }, MIN_SHOW_MS - elapsed);
    } else {
      banner.classList.remove("visible");
    }
  }
})();
</script>`;
}

/** User dropdown menu for the header. */
export function userMenu(user: { name?: string | null; email: string }): string {
  const initial = userInitial(user);
  return `<div class="user-menu">
  <button class="user-menu-trigger" onclick="toggleUserMenu(this)" aria-label="User menu">
    <span class="avatar" id="user-avatar">${initial}</span>
  </button>
  <div class="user-menu-dropdown">
    <a href="/settings">${svgIcon("settings")} Preferences</a>
    <a href="/logout">${svgIcon("logOut")} Log out</a>
  </div>
</div>`;
}

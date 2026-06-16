/** Shared HTML snippets for all pages. */

export const HTMX_HEAD = `<script src="https://unpkg.com/htmx.org@2.0.10"></script>
<style>
  /* ── Design Tokens ── */
  :root {
    --bg: #fdfcf9;
    --surface: #ffffff;
    --surface-hover: #faf8f5;
    --border: #e8e4dc;
    --border-hover: #d4cdbc;
    --text: #2d2d2d;
    --text-secondary: #6b6b6b;
    --text-muted: #a3a3a3;
    --primary: #2d2d2d;
    --primary-hover: #444444;
    --primary-light: #f5f2eb;
    --success: #2d5a27;
    --success-bg: #e8f0e4;
    --success-border: #c4dbbf;
    --warning: #8b6914;
    --warning-bg: #fef5e7;
    --warning-border: #f5deb3;
    --danger: #8b2e2e;
    --danger-bg: #fef5f5;
    --danger-border: #f5c6c6;
    --info: #2d5aa0;
    --info-bg: #eef4fc;
    --radius-sm: 6px;
    --radius: 8px;
    --radius-lg: 12px;
    --radius-xl: 16px;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
    --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
    --shadow-lg: 0 8px 24px rgba(0,0,0,0.08);
    --transition: 150ms ease;
    --transition-slow: 250ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* ── Reset ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  a { color: var(--primary); text-decoration: none; transition: color var(--transition); }
  a:hover { color: var(--primary-hover); }

  /* ── Focus Ring ── */
  input:focus-visible, textarea:focus-visible, select:focus-visible, button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(45, 45, 45, 0.15);
  }

  /* ── Selection ── */
  ::selection { background: rgba(45, 45, 45, 0.12); }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border-hover); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

  /* ── Loading Bar ── */
  #htmx-loading-bar {
    position: fixed; top: 0; left: 0; height: 3px;
    background: var(--primary);
    z-index: 9999; opacity: 0; transition: opacity 150ms; width: 0;
  }
  .htmx-request#htmx-loading-bar { opacity: 1; animation: htmx-load 2s ease-out; }
  @keyframes htmx-load {
    0% { width: 0; } 10% { width: 30%; } 50% { width: 60%; } 80% { width: 85%; } 100% { width: 95%; }
  }

  /* ── HTMX Indicator Toggle ── */
  .htmx-indicator { opacity: 0; transition: opacity 200ms ease-in; }
  .htmx-request .htmx-indicator, .htmx-request.htmx-indicator { opacity: 1; }
  .htmx-request .btn-label { display: none; }
  .htmx-request .htmx-indicator-inline { display: inline-flex !important; align-items: center; gap: 0.3rem; }
  .htmx-indicator-inline { display: none !important; }

  /* ── Spinner ── */
  .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.6s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Thinking Dots ── */
  .thinking-dots { display: flex; gap: 4px; align-items: center; padding: 2px 0; }
  .thinking-dots span { width: 7px; height: 7px; background: var(--primary); border-radius: 50%; animation: dot-bounce 1.4s infinite ease-in-out both; opacity: 0.4; }
  .thinking-dots span:nth-child(1) { animation-delay: -0.32s; }
  .thinking-dots span:nth-child(2) { animation-delay: -0.16s; }
  @keyframes dot-bounce { 0%, 80%, 100% { transform: scale(0); opacity: 0.2; } 40% { transform: scale(1); opacity: 0.8; } }

  /* ── Animations ── */
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .fade-in { animation: fadeIn 0.25s ease-out; }
  .fade-in-up { animation: fadeInUp 0.35s ease-out; }

  /* ── Staggered card entrance ── */
  .stagger > * { animation: fadeInUp 0.35s ease-out backwards; }
  .stagger > *:nth-child(1) { animation-delay: 0.00s; }
  .stagger > *:nth-child(2) { animation-delay: 0.04s; }
  .stagger > *:nth-child(3) { animation-delay: 0.08s; }
  .stagger > *:nth-child(4) { animation-delay: 0.12s; }
  .stagger > *:nth-child(5) { animation-delay: 0.16s; }
  .stagger > *:nth-child(6) { animation-delay: 0.20s; }
  .stagger > *:nth-child(7) { animation-delay: 0.24s; }
  .stagger > *:nth-child(8) { animation-delay: 0.28s; }
  .stagger > *:nth-child(9) { animation-delay: 0.32s; }
  .stagger > *:nth-child(10) { animation-delay: 0.36s; }

  /* ── Badges ── */
  .badge {
    display: inline-flex; align-items: center;
    padding: 0.15rem 0.55rem; border-radius: 999px; font-size: 0.72rem;
    font-weight: 500; line-height: 1.5; letter-spacing: 0.02em;
  }
  .badge-default { background: var(--primary-light); color: var(--text-secondary); border: 1px solid var(--border); }
  .badge-active { background: var(--primary-light); color: var(--text-secondary); border: 1px solid var(--border); }
  .badge-in-progress { background: var(--warning-bg); color: var(--warning); border: 1px solid var(--warning-border); }
  .badge-completed { background: var(--success-bg); color: var(--success); border: 1px solid var(--success-border); }
  .badge-superseded { background: var(--danger-bg); color: var(--danger); border: 1px solid var(--danger-border); }
  .badge-info { background: var(--info-bg); color: var(--info); border: 1px solid #c4d4eb; }
  .badge-ready { background: var(--success-bg); color: var(--success); border: 1px solid var(--success-border); }
  .badge-error { background: var(--danger-bg); color: var(--danger); border: 1px solid var(--danger-border); }

  /* ── Buttons ── */
  .btn {
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 0.5rem 1rem; border-radius: var(--radius); font-size: 0.875rem;
    font-weight: 500; cursor: pointer; transition: all var(--transition);
    border: 1px solid transparent; font-family: inherit; line-height: 1.4;
    text-decoration: none; white-space: nowrap;
  }
  .btn:active { transform: scale(0.97); }
  .btn-primary {
    background: var(--primary); color: #fff; border: none;
  }
  .btn-primary:hover { background: var(--primary-hover); transform: translateY(-1px); box-shadow: var(--shadow); }
  .btn-primary:active { transform: translateY(0) scale(0.98); }
  .btn-secondary {
    background: var(--surface); color: var(--text); border-color: var(--border); box-shadow: var(--shadow-sm);
  }
  .btn-secondary:hover { border-color: var(--border-hover); box-shadow: var(--shadow); }
  .btn-ghost {
    background: transparent; color: var(--text-secondary); border-color: var(--border);
  }
  .btn-ghost:hover { border-color: var(--border-hover); color: var(--text); }
  .btn-danger {
    background: var(--surface); color: var(--danger); border-color: var(--border);
  }
  .btn-danger:hover { background: var(--danger-bg); border-color: var(--danger); }
  .btn-sm { padding: 0.35rem 0.75rem; font-size: 0.8rem; border-radius: var(--radius-sm); }
  .btn-lg { padding: 0.7rem 1.5rem; font-size: 1rem; border-radius: var(--radius-lg); }

  /* ── Form Elements ── */
  .input {
    padding: 0.65rem 0.85rem; border: 1px solid var(--border); border-radius: var(--radius);
    font-size: 0.9rem; font-family: inherit; background: var(--surface);
    color: var(--text); transition: all var(--transition); outline: none; width: 100%;
  }
  .input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(45, 45, 45, 0.1); }
  .input::placeholder { color: var(--text-muted); }

  /* ── Chat Messages ── */
  .msg {
    padding: 0.75rem 1rem; border-radius: var(--radius-lg); line-height: 1.5;
    font-size: 0.95rem; max-width: 85%;
    animation: fadeIn 0.25s ease-out;
  }
  .msg.user {
    background: var(--primary-light); color: var(--text);
    align-self: flex-end;
    border-bottom-right-radius: 4px;
  }
  .msg.assistant {
    background: var(--surface); border: 1px solid var(--border);
    align-self: flex-start;
    border-bottom-left-radius: 4px;
    box-shadow: var(--shadow-sm);
  }

  /* ── Chat Form (unified card) ── */
  .chat-form {
    display: flex; gap: 0.5rem; align-items: flex-end;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 0.6rem;
    box-shadow: var(--shadow-sm);
  }
  .chat-form textarea {
    width: 100%; box-sizing: border-box; border: none; padding: 0.4rem 0.5rem; padding-bottom: 1.3rem;
    font-size: 0.95rem; font-family: inherit; resize: none;
    background: transparent; color: var(--text); outline: none;
    line-height: 1.5;
  }
  .chat-form textarea::placeholder { color: var(--text-muted); }
  .chat-form button {
    padding: 0.55rem 1.2rem;
    background: var(--primary); color: #fff; border: none;
    border-radius: var(--radius); font-size: 0.9rem; font-weight: 500;
    cursor: pointer; transition: all var(--transition);
    flex-shrink: 0; font-family: inherit;
  }
  .chat-form button:hover { background: var(--primary-hover); }
  .chat-form button:active { transform: scale(0.97); }

	.textarea-wrapper {
	    position: relative;
	}
	.chat-form .textarea-wrapper {
	.textarea-wrapper textarea { padding-bottom: 1.3rem; }
	    flex: 1;
	}
	.textarea-hint {
	    position: absolute;
	    bottom: 4px;
	    left: 8px;
	    font-size: 0.62rem;
	    color: var(--text-muted);
	    pointer-events: none;
	    opacity: 0.45;
	    line-height: 1;
	}

	/* ── Section Divider ── */
  .section-label {
    display: flex; align-items: center; gap: 0.75rem;
    font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--text-muted); font-weight: 600; margin-bottom: 0.75rem;
  }
  .section-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  /* ── Section Header ── */
  .section-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 1rem;
  }
  .section-header h2 { font-size: 1.1rem; font-weight: 600; }

  /* ── Markdown Body ── */
  .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
    margin: 0.5em 0 0.25em; font-weight: 600; line-height: 1.3;
  }
  .markdown-body h1 { font-size: 1.4em; }
  .markdown-body h2 { font-size: 1.25em; }
  .markdown-body h3 { font-size: 1.1em; }
  .markdown-body p { margin: 0.25em 0 0.5em; }
  .markdown-body ul, .markdown-body ol { margin: 0.25em 0 0.5em; padding-left: 1.5em; }
  .markdown-body li { margin: 0.15em 0; }
  .markdown-body code {
    background: var(--primary-light); padding: 0.1em 0.35em; border-radius: 3px;
    font-size: 0.9em; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  }
  .markdown-body pre {
    background: #1e1e1e; color: #e0e0e0; padding: 0.75rem 1rem;
    border-radius: var(--radius); overflow-x: auto; margin: 0.5em 0;
  }
  .markdown-body pre code { background: none; padding: 0; font-size: 0.85em; color: inherit; }
  .markdown-body blockquote {
    border-left: 3px solid var(--border-hover); margin: 0.5em 0;
    padding: 0.25em 0.75em; color: var(--text-secondary);
  }
  .markdown-body table { border-collapse: collapse; margin: 0.5em 0; width: 100%; }
  .markdown-body th, .markdown-body td {
    border: 1px solid var(--border); padding: 0.4em 0.75em; text-align: left;
  }
  .markdown-body th { background: var(--primary-light); font-weight: 600; }
  .markdown-body strong { font-weight: 600; }
  .markdown-body em { font-style: italic; }
  .markdown-body a { color: var(--primary); text-decoration: underline; }
  .markdown-body hr { border: none; border-top: 1px solid var(--border); margin: 0.75em 0; }
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
  const div = document.createElement("div");
  div.className = "msg user";
  div.textContent = msg;
  container.appendChild(div);

  const thinking = document.createElement("div");
  thinking.className = "msg assistant thinking-bubble";
  thinking.innerHTML = '<span class="thinking-dots"><span></span><span></span><span></span></span>';
  container.appendChild(thinking);
  container.scrollTop = container.scrollHeight;
  input.value = "";
  input.style.height = "auto";
  const btn = form.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; setTimeout(() => { btn.disabled = false; }, 2000); }
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
      if (thinking) thinking.remove();
    }
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
	  options.forEach((row, i) => row.classList.toggle('selected', i === idx));
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
</script>`;

/** Guided question JS for onboarding pages. */
export const GUIDED_QUESTION_SCRIPT = `<script>
function selectOption(row, idx) {
  const radio = row.querySelector('input[type="radio"]');
  if (radio) radio.checked = true;
  onOptionChange(idx);
}
function onOptionChange(idx) {
  const options = document.querySelectorAll('#options-container .option-row');
  options.forEach((row, i) => row.classList.toggle('selected', i === idx));
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
</script>`;

/** Loading bar — add right after <body> in page layouts, NOT inside <head>. */
export const HTMX_LOADING_BAR = `<div id="htmx-loading-bar" class="htmx-indicator"></div>`;

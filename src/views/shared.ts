/** Shared HTML snippets for all pages. */

export const HTMX_HEAD = `<script src="https://unpkg.com/htmx.org@2.0.10"></script>
<style>
  /* htmx loading indicator */
  .htmx-indicator {
    opacity: 0;
    transition: opacity 200ms ease-in;
  }
  .htmx-request .htmx-indicator,
  .htmx-request.htmx-indicator {
    opacity: 1;
  }

  /* Global loading bar at top of page during requests */
  #htmx-loading-bar {
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    background: #2d2d2d;
    z-index: 9999;
    opacity: 0;
    transition: opacity 150ms;
    width: 0;
  }
  .htmx-request#htmx-loading-bar {
    opacity: 1;
    animation: htmx-load 2s ease-out;
  }
  @keyframes htmx-load {
    0% { width: 0; }
    10% { width: 30%; }
    50% { width: 60%; }
    80% { width: 85%; }
    100% { width: 95%; }
  }

  /* Swap label/indicator visibility during htmx requests */
  .htmx-request .btn-label { display: none; }
  .htmx-request .htmx-indicator-inline { display: inline-flex !important; align-items: center; gap: 0.3rem; }
  .htmx-indicator-inline { display: none !important; }

  /* Inline spinner for buttons */
  .btn-loading {
    position: relative;
    pointer-events: none;
  }
  .btn-loading::after {
    content: "";
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.5s linear infinite;
    margin-left: 0.5rem;
    vertical-align: middle;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Markdown body styles for chat messages */
  .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
    margin: 0.5em 0 0.25em;
    font-weight: 600;
    line-height: 1.3;
  }
  .markdown-body h1 { font-size: 1.4em; }
  .markdown-body h2 { font-size: 1.25em; }
  .markdown-body h3 { font-size: 1.1em; }
  .markdown-body p { margin: 0.25em 0 0.5em; }
  .markdown-body ul, .markdown-body ol { margin: 0.25em 0 0.5em; padding-left: 1.5em; }
  .markdown-body li { margin: 0.15em 0; }
  .markdown-body code {
    background: #f5f2eb;
    padding: 0.1em 0.35em;
    border-radius: 3px;
    font-size: 0.9em;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  }
  .markdown-body pre {
    background: #1e1e1e;
    color: #e0e0e0;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    overflow-x: auto;
    margin: 0.5em 0;
  }
  .markdown-body pre code {
    background: none;
    padding: 0;
    font-size: 0.85em;
    color: inherit;
  }
  .markdown-body blockquote {
    border-left: 3px solid #d4cbb8;
    margin: 0.5em 0;
    padding: 0.25em 0.75em;
    color: #5e5e5e;
  }
  .markdown-body table {
    border-collapse: collapse;
    margin: 0.5em 0;
    width: 100%;
  }
  .markdown-body th, .markdown-body td {
    border: 1px solid #e0dbd0;
    padding: 0.4em 0.75em;
    text-align: left;
  }
  .markdown-body th {
    background: #f5f2eb;
    font-weight: 600;
  }
  .markdown-body strong { font-weight: 600; }
  .markdown-body em { font-style: italic; }
  .markdown-body a { color: #2d5aa0; text-decoration: underline; }
  .markdown-body hr { border: none; border-top: 1px solid #e0dbd0; margin: 0.75em 0; }

  /* Thinking dots animation */
  .thinking-dots { display: flex; gap: 4px; align-items: center; padding: 2px 0; }
  .thinking-dots span { width: 7px; height: 7px; background: #b8a88a; border-radius: 50%; animation: dot-bounce 1.4s infinite ease-in-out both; }
  .thinking-dots span:nth-child(1) { animation-delay: -0.32s; }
  .thinking-dots span:nth-child(2) { animation-delay: -0.16s; }
  @keyframes dot-bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
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
  div.style.cssText = "background:#f0ebe0;align-self:flex-end;padding:0.75rem 1rem;border-radius:8px;max-width:85%;";
  div.innerHTML = msg.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\\n/g, "<br>");
  container.appendChild(div);
  // Add thinking bubble
  const thinking = document.createElement("div");
  thinking.className = "msg assistant thinking-bubble";
  thinking.style.cssText = "background:#fff;border:1px solid #e8e4dc;padding:0.75rem 1rem;border-radius:8px;max-width:85%;align-self:flex-start;";
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
// Enter to submit, Shift+Enter for newline
document.addEventListener("keydown", function(e) {
  if (e.target.tagName !== "TEXTAREA" || e.key !== "Enter" || e.shiftKey) return;
  const form = e.target.closest(".chat-form");
  if (!form || form.dataset.sending) return;
  if (!e.target.value.trim()) return;
  e.preventDefault();
  form.dataset.sending = "true";
  const btn = form.querySelector('button[type="submit"]');
  if (btn) btn.click();
});
// Clear sending flag and remove thinking bubble when request completes
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
</script>`;

/** Loading bar — add right after <body> in page layouts, NOT inside <head>. */
export const HTMX_LOADING_BAR = `<div id="htmx-loading-bar" class="htmx-indicator"></div>`;

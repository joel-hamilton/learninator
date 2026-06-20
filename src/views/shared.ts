/** Shared HTML snippets for all pages. */

/** Guided question JS for onboarding pages. */
export const GUIDED_QUESTION_SCRIPT = '\n' +
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
  '\n';

export const HTMX_HEAD = `<script src="https://unpkg.com/htmx.org@2.0.10"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/static/base.css">

<script>
// Inject CSRF token into all htmx requests
document.addEventListener('htmx:configRequest', function(e) {
  var match = document.cookie.match(/learninator_csrf=([^;]+)/);
  if (match) e.detail.headers['X-CSRF-Token'] = match[1];
});
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
${GUIDED_QUESTION_SCRIPT}
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
    edit: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
    chevronDown: '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  };
  return icons[name] || "";
}

/** Animated spinner SVG icon */
export function spinnerSvg(size: number = 16): string {
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" style="animation: spin 0.6s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';
}


/** Loading bar — add right after <body> in page layouts, NOT inside <head>. */
export const HTMX_LOADING_BAR = '<div id="htmx-loading-bar" class="htmx-indicator"></div>';

/** Get the first initial from a user's name or email. */
export function userInitial(user: { name?: string | null; email: string }): string {
  if (user.name?.trim()) return user.name.trim().charAt(0).toUpperCase();
  return user.email.charAt(0).toUpperCase();
}

/**
 * Convert a stored chat message content string to plain display text.
 * Handles JSON-stringified content blocks, extracting only text-type blocks.
 */
export function contentToText(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("\n");
    }
    return String(parsed);
  } catch {
    return content;
  }
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

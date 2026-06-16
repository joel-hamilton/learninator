import { HTMX_HEAD, HTMX_LOADING_BAR, svgIcon } from "./shared.js";
import { lessonActionBar, completedLessonBar } from "./fragments.js";

function formatLessonNumber(num: number, sub: number | null): string {
  const base = String(num).padStart(4, "0");
  return sub !== null ? `${base}.${sub}` : base;
}

function lessonIdStr(number: number, subNumber: number | null): string {
  return subNumber !== null ? `${number}.${subNumber}` : `${number}`;
}

export function lessonPage(params: {
  missionId: number;
  missionTitle: string;
  lessonNumber: number;
  lessonSubNumber: number | null;
  lessonTitle: string;
  lessonStatus: string;
  lessonHtmlContent: string;
  prevLesson: { number: number; subNumber: number | null } | undefined;
  nextLesson: { number: number; subNumber: number | null } | undefined;
}): string {
  const { missionId, missionTitle, lessonNumber, lessonSubNumber, lessonTitle, lessonStatus, lessonHtmlContent, prevLesson, nextLesson } = params;

  const displayNum = formatLessonNumber(lessonNumber, lessonSubNumber);
  const lid = lessonIdStr(lessonNumber, lessonSubNumber);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${lessonTitle} — ${missionTitle} — Learninator</title>
${HTMX_HEAD}
<style>
  /* Toolbar */
  .toolbar {
    background: rgba(255,255,255,0.85);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-bottom: 1px solid var(--border);
    padding: 0 1.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 52px;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .toolbar .left { display: flex; align-items: center; gap: 0.65rem; min-width: 0; }
  .toolbar .logo {
    font-size: 0.85rem; font-weight: 700; letter-spacing: -0.02em;
    display: flex; align-items: center; gap: 0.3rem;
    color: var(--text); text-decoration: none; flex-shrink: 0;
  }
  .toolbar .logo:hover { color: var(--text); }
  .toolbar .logo .svg-icon { width: 1em; height: 1em; color: var(--accent); }
  .toolbar .back-link {
    font-size: 0.8rem; color: var(--text-secondary); text-decoration: none;
    display: inline-flex; align-items: center; gap: 0.3rem;
    padding: 0.3rem 0.6rem; border: 1px solid var(--border); border-radius: var(--radius-sm);
    transition: all var(--transition); white-space: nowrap;
  }
  .toolbar .back-link:hover { border-color: var(--border-hover); color: var(--text); background: var(--surface-hover); }
  .toolbar .back-link .svg-icon { width: 0.85em; height: 0.85em; }
  .toolbar h1 { font-size: 0.85rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .toolbar .nav { display: flex; gap: 0.4rem; flex-shrink: 0; }
  .toolbar .nav a {
    display: inline-flex; align-items: center; gap: 0.25rem;
    padding: 0.35rem 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-sm);
    font-size: 0.78rem; color: var(--text-secondary); text-decoration: none; transition: all var(--transition);
    font-weight: 500;
  }
  .toolbar .nav a:hover { background: var(--surface-hover); border-color: var(--border-hover); color: var(--text); }
  .toolbar .nav .disabled {
    display: inline-flex; align-items: center; gap: 0.25rem;
    padding: 0.35rem 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-sm);
    font-size: 0.78rem; color: var(--text-muted); opacity: 0.35; pointer-events: none;
  }
  .toolbar .nav .svg-icon { width: 0.8em; height: 0.8em; }

  /* Lesson Container */
  .lesson-container { max-width: 800px; margin: 0 auto; padding: 1.75rem 1.5rem 6rem; animation: fadeInUp 0.35s ease-out; }

  /* Lesson Header */
  .lesson-header { margin-bottom: 1.5rem; }
  .lesson-header .lesson-num {
    font-size: 0.7rem; color: var(--accent); font-family: ui-monospace, monospace;
    text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 0.2rem;
  }
  .lesson-header h2 { font-size: 1.35rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1.3; }

  /* Iframe Container */
  .iframe-container {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
    overflow: hidden; margin-bottom: 1.25rem;
    box-shadow: var(--shadow-md);
  }
  #lesson-frame { width: 100%; border: none; display: block; }

  /* Feedback Bar */
  .feedback-bar {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
    padding: 1rem 1.2rem; margin-bottom: 1.25rem; display: flex; align-items: center;
    gap: 0.6rem; flex-wrap: wrap;
    animation: fadeInUp 0.3s ease-out;
    box-shadow: var(--shadow-sm);
  }
  .feedback-bar .label { font-size: 0.82rem; color: var(--text-secondary); font-weight: 500; }
  .feedback-bar .fb-btn {
    padding: 0.35rem 0.85rem; border: 1px solid var(--border); border-radius: 999px;
    background: var(--surface); cursor: pointer; font-size: 0.8rem;
    transition: all var(--transition); color: var(--text-secondary); font-family: inherit;
  }
  .feedback-bar .fb-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
  .feedback-bar .done-btn {
    padding: 0.5rem 1.2rem; background: var(--accent);
    color: #fff; border: none; border-radius: var(--radius-sm); cursor: pointer;
    font-size: 0.82rem; font-weight: 600; transition: all var(--transition); font-family: inherit;
    box-shadow: 0 1px 3px rgba(79,70,229,0.2);
  }
  .feedback-bar .done-btn:hover { background: var(--accent-hover); box-shadow: 0 4px 12px rgba(79,70,229,0.3); }

  /* FAB */
  .fab {
    position: fixed; bottom: 1.75rem; right: 1.75rem; z-index: 200;
    width: 52px; height: 52px; border-radius: 50%;
    background: var(--accent); color: #fff; border: none;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 24px rgba(79,70,229,0.25);
    transition: all var(--transition-slow);
  }
  .fab:hover { background: var(--accent-hover); transform: scale(1.05); box-shadow: 0 8px 32px rgba(79,70,229,0.35); }
  .fab .svg-icon { width: 1.2em; height: 1.2em; }
  .fab.hidden { display: none; }

  /* Chat Panel */
  .chat-panel {
    position: fixed; bottom: 6rem; right: 1.75rem; z-index: 199;
    width: 380px; max-height: 520px;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl);
    box-shadow: 0 12px 48px rgba(0,0,0,0.12);
    display: none; flex-direction: column;
    animation: fadeInUp 0.25s ease-out;
    overflow: hidden;
  }
  .chat-panel.open { display: flex; }

  .chat-panel-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.85rem 1.1rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    background: var(--bg);
  }
  .chat-panel-header h4 { font-size: 0.85rem; font-weight: 600; }
  .chat-panel-header .header-actions { display: flex; gap: 0.3rem; }
  .chat-panel-header button {
    background: none; border: none; cursor: pointer; color: var(--text-muted);
    padding: 0.25rem; border-radius: 6px; transition: all var(--transition);
  }
  .chat-panel-header button:hover { color: var(--text); background: var(--primary-light); }
  .chat-panel-header button .svg-icon { width: 0.95em; height: 0.95em; }

  .chat-panel-messages {
    flex: 1; overflow-y: auto; padding: 0.75rem;
    display: flex; flex-direction: column; gap: 0.5rem;
    min-height: 150px;
    max-height: 320px;
  }

  .chat-panel-footer {
    padding: 0.5rem; border-top: 1px solid var(--border);
    flex-shrink: 0;
    background: var(--bg);
  }
  .chat-panel-footer .chat-form {
    border: 1px solid var(--border); padding: 0.4rem;
    box-shadow: none;
    border-radius: var(--radius);
  }
  .chat-panel-footer .chat-form:focus-within { box-shadow: 0 0 0 3px rgba(79,70,229,0.06); }
  .chat-panel-footer .chat-form textarea {
    font-size: 0.82rem;
    padding: 0.3rem 0.4rem;
    padding-bottom: 1.2rem;
  }
  .chat-panel-footer .chat-form button {
    font-size: 0.8rem;
    padding: 0.4rem 0.9rem;
  }
  .chat-panel-footer .textarea-hint {
    font-size: 0.6rem;
    left: 5px;
  }

  /* Quick action chips inside chat panel */
  .quick-actions { display: flex; gap: 0.35rem; padding: 0.6rem 0.75rem 0.25rem; flex-wrap: wrap; }
  .quick-chip {
    padding: 0.3rem 0.7rem; font-size: 0.7rem; font-weight: 500;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 999px; cursor: pointer; font-family: inherit;
    color: var(--text-secondary); transition: all var(--transition);
  }
  .quick-chip:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }

  /* Responsive */
  @media (max-width: 480px) {
    .chat-panel { width: calc(100vw - 2rem); right: 1rem; bottom: 5rem; }
  }
</style>
</head>
<body>
${HTMX_LOADING_BAR}
<div class="toolbar">
  <div class="left">
    <a href="/" class="logo">${svgIcon("zap")}</a>
    <a href="/missions/${missionId}" class="back-link">${svgIcon("arrowLeft")} ${missionTitle}</a>
    <h1>${displayNum} &mdash; ${lessonTitle}</h1>
  </div>
  <div class="nav">
    ${prevLesson
      ? `<a href="/missions/${missionId}/lessons/${lessonIdStr(prevLesson.number, prevLesson.subNumber)}">${svgIcon("arrowLeft")} Previous</a>`
      : `<span class="disabled">${svgIcon("arrowLeft")} Previous</span>`}
    ${nextLesson
      ? `<a href="/missions/${missionId}/lessons/${lessonIdStr(nextLesson.number, nextLesson.subNumber)}">Next ${svgIcon("arrowRight")}</a>`
      : `<span class="disabled">Next ${svgIcon("arrowRight")}</span>`}
  </div>
</div>
<div class="lesson-container">
  <div class="lesson-header">
    <div class="lesson-num">Lesson ${displayNum}</div>
    <h2>${lessonTitle}</h2>
  </div>

  <div class="iframe-container">
    <iframe id="lesson-frame" scrolling="no" srcdoc="${lessonHtmlContent.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/<\/body>/i, `<script>function r(){const h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);parent.postMessage({type:'lessonResize',height:h},'*');}new ResizeObserver(r).observe(document.body);r();<\/script></body>`)}"></iframe>
  </div>

  ${lessonStatus === "completed"
    ? completedLessonBar(missionId, lessonNumber, lessonSubNumber)
    : lessonActionBar(missionId, lessonNumber, lessonSubNumber)
  }

  <!-- FAB -->
  <button class="fab" id="lesson-fab" onclick="toggleChat()" title="Ask about this lesson">
    ${svgIcon("messageCircle")}
  </button>

  <!-- Chat Panel -->
  <div class="chat-panel" id="lesson-chat-panel">
    <div class="chat-panel-header">
      <h4>Ask about this lesson</h4>
      <div class="header-actions">
        <button title="Clear conversation" onclick="clearChat(${missionId})">
          ${svgIcon("trash")}
        </button>
        <button title="Close" onclick="toggleChat()">
          ${svgIcon("x")}
        </button>
      </div>
    </div>
    <div class="quick-actions">
      <button class="quick-chip" onclick="sendQuick('Can you explain this lesson in simpler terms?')">Explain this</button>
      <button class="quick-chip" onclick="sendQuick('Give me a practice exercise for this lesson')">Practice exercise</button>
      <button class="quick-chip" onclick="sendQuick('Create a new lesson that builds on this')">Next lesson</button>
    </div>
    <div class="chat-panel-messages" id="lesson-chat-messages">
      <div class="msg assistant">Ask me anything about this lesson! I can clarify concepts, give examples, or create follow-up lessons.</div>
    </div>
    <div class="chat-panel-footer">
      <form class="chat-form" hx-post="/missions/${missionId}/lessons/${lid}/chat" hx-target="#lesson-chat-messages" hx-swap="beforeend" hx-on::before-request="optimisticChat(this)" hx-on::after-request="this.reset()">
        <input type="hidden" name="lesson_title" value="${lessonTitle.replace(/"/g, '&quot;')}">
        <input type="hidden" name="lesson_number" value="${displayNum}">
        <div class="textarea-wrapper">
          <textarea name="message" placeholder="Ask about this lesson..." rows="1" oninput="autoResize(this)"></textarea>
          <span class="textarea-hint">Shift + Enter for newline</span>
        </div>
        <button type="submit">${svgIcon("send")}</button>
      </form>
    </div>
  </div>
</div>
<script>
const frame = document.getElementById('lesson-frame');
frame.style.minHeight = (window.innerHeight - 250) + 'px';
window.addEventListener('message', function(e) {
  if (e.data?.type === 'lessonResize' && e.data.height) {
    frame.style.height = e.data.height + 'px';
    frame.style.minHeight = '0';
  }
});

// FAB chat panel
function toggleChat() {
  var panel = document.getElementById('lesson-chat-panel');
  var fab = document.getElementById('lesson-fab');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) {
    fab.classList.add('hidden');
    var msgs = document.getElementById('lesson-chat-messages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  } else {
    fab.classList.remove('hidden');
  }
}

function sendQuick(text) {
  var textarea = document.querySelector('#lesson-chat-panel textarea[name="message"]');
  if (textarea) {
    textarea.value = text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    var form = textarea.closest('form');
    if (form) {
      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.click();
    }
  }
}

function clearChat(missionId) {
  if (!confirm('Clear this conversation? (Messages are still saved to the mission chat)')) return;
  var msgs = document.getElementById('lesson-chat-messages');
  if (msgs) {
    msgs.innerHTML = '<div class="msg assistant">Ask me anything about this lesson! I can clarify concepts, give examples, or create follow-up lessons.</div>';
  }
}
</script>
</body>
</html>`;
}

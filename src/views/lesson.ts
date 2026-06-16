import { HTMX_HEAD, HTMX_LOADING_BAR } from "./shared.js";
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${lessonTitle} — ${missionTitle} — Learninator</title>
${HTMX_HEAD}
<style>
  /* ── Toolbar ── */
  .toolbar {
    background: rgba(255,255,255,0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 0 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 52px;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .toolbar .left { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
  .toolbar .back-link {
    font-size: 0.85rem; color: var(--text-secondary); text-decoration: none;
    padding: 0.3rem 0.6rem; border: 1px solid var(--border); border-radius: var(--radius-sm);
    transition: all var(--transition); white-space: nowrap;
  }
  .toolbar .back-link:hover { border-color: var(--primary); color: var(--text); }
  .toolbar h1 { font-size: 0.9rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .toolbar .nav { display: flex; gap: 0.5rem; flex-shrink: 0; }
  .toolbar .nav a {
    padding: 0.35rem 0.8rem; border: 1px solid var(--border); border-radius: var(--radius-sm);
    font-size: 0.8rem; color: var(--text-secondary); text-decoration: none; transition: all var(--transition);
  }
  .toolbar .nav a:hover { background: var(--primary-light); border-color: var(--border-hover); color: var(--text); }
  .toolbar .nav .disabled {
    padding: 0.35rem 0.8rem; border: 1px solid var(--border); border-radius: var(--radius-sm);
    font-size: 0.8rem; color: var(--text-muted); opacity: 0.5; pointer-events: none;
  }

  /* ── Lesson Container ── */
  .lesson-container { max-width: 800px; margin: 0 auto; padding: 2rem 1.5rem; animation: fadeInUp 0.35s ease-out; }

  /* ── Lesson Header ── */
  .lesson-header { margin-bottom: 1.5rem; }
  .lesson-header .lesson-num {
    font-size: 0.72rem; color: var(--text-muted); font-family: ui-monospace, monospace;
    text-transform: uppercase; letter-spacing: 0.06em; font-weight: 500; margin-bottom: 0.3rem;
  }
  .lesson-header h2 { font-size: 1.3rem; font-weight: 600; letter-spacing: -0.02em; }

  /* ── Iframe Container ── */
  .iframe-container {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl);
    overflow: hidden; box-shadow: var(--shadow-md); margin-bottom: 1.5rem;
  }
  #lesson-frame { width: 100%; border: none; display: block; }

  /* ── Feedback Bar ── */
  .feedback-bar {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
    padding: 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center;
    gap: 0.75rem; flex-wrap: wrap; box-shadow: var(--shadow-sm);
    animation: fadeInUp 0.3s ease-out;
  }
  .feedback-bar .label { font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; }
  .feedback-bar .fb-btn {
    padding: 0.35rem 0.85rem; border: 1px solid var(--border); border-radius: 999px;
    background: var(--surface); cursor: pointer; font-size: 0.82rem;
    transition: all var(--transition); color: var(--text-secondary); font-family: inherit;
  }
  .feedback-bar .fb-btn:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-light); }
  .feedback-bar .fb-btn.selected { background: var(--primary); border-color: var(--primary); color: #fff; }
  .feedback-bar .done-btn {
    margin-left: auto; padding: 0.5rem 1.25rem; background: var(--primary);
    color: #fff; border: none; border-radius: var(--radius); cursor: pointer;
    font-size: 0.85rem; font-weight: 500; transition: all var(--transition); font-family: inherit;
  }
  .feedback-bar .done-btn:hover { background: var(--primary-hover); }
  .feedback-bar .done-btn:active { transform: scale(0.97); }

  /* ── Lesson Chat ── */
  .lesson-chat {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
    padding: 1.25rem; box-shadow: var(--shadow-sm);
  }
  .lesson-chat h3 { font-size: 0.9rem; font-weight: 600; margin-bottom: 1rem; color: var(--text); }
  #followup-messages { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; }
</style>
</head>
<body>
${HTMX_LOADING_BAR}
<div class="toolbar">
  <div class="left">
    <a href="/missions/${missionId}" class="back-link">&larr; ${missionTitle}</a>
    <h1>${displayNum} — ${lessonTitle}</h1>
  </div>
  <div class="nav">
    ${prevLesson
      ? `<a href="/missions/${missionId}/lessons/${lessonIdStr(prevLesson.number, prevLesson.subNumber)}">&larr; Previous</a>`
      : `<span class="disabled">&larr; Previous</span>`}
    ${nextLesson
      ? `<a href="/missions/${missionId}/lessons/${lessonIdStr(nextLesson.number, nextLesson.subNumber)}">Next &rarr;</a>`
      : `<span class="disabled">Next &rarr;</span>`}
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

  <div class="lesson-chat">
    <h3>Questions about this lesson?</h3>
    <div id="followup-messages"></div>
    <form class="chat-form" hx-post="/missions/${missionId}/chat" hx-target="#followup-messages" hx-swap="beforeend" hx-on::before-request="optimisticChat(this)" hx-on::after-request="this.reset()">
      <input type="hidden" name="context" value="Lesson ${displayNum}: ${lessonTitle}">
      <div class="textarea-wrapper">
        <textarea name="message" placeholder="What's unclear about this lesson?" rows="2" oninput="autoResize(this)"></textarea>
        <span class="textarea-hint">Shift + Enter for newline</span>
      </div>
      <button type="submit">Ask</button>
    </form>
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
</script>
</body>
</html>`;
}

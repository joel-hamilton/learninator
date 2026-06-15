import { HTMX_HEAD, HTMX_LOADING_BAR } from "./shared.js";

export function lessonPage(params: {
  missionId: number;
  missionTitle: string;
  lessonNumber: number;
  lessonTitle: string;
  lessonHtmlContent: string;
  feedbackRating: string | null;
  feedbackText: string | null;
  prevLesson: { number: number } | undefined;
  nextLesson: { number: number } | undefined;
}): string {
  const { missionId, missionTitle, lessonNumber, lessonTitle, lessonHtmlContent, feedbackRating, feedbackText, prevLesson, nextLesson } = params;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${lessonTitle} — ${missionTitle} — Learninator</title>
${HTMX_HEAD}
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #fdfcf9; color: #2d2d2d; }
  .toolbar { background: #fff; border-bottom: 1px solid #e8e4dc; padding: 0 1.5rem; display: flex; align-items: center; justify-content: space-between; height: 52px; position: sticky; top: 0; z-index: 10; }
  .toolbar .left { display: flex; align-items: center; gap: 1rem; }
  .toolbar a { font-size: 0.85rem; color: #888; text-decoration: none; }
  .toolbar a:hover { color: #2d2d2d; }
  .toolbar h1 { font-size: 0.95rem; font-weight: 500; }
  .toolbar .nav { display: flex; gap: 0.5rem; }
  .toolbar .nav a { padding: 0.3rem 0.7rem; border: 1px solid #e8e4dc; border-radius: 6px; font-size: 0.8rem; }
  .toolbar .nav a:hover { background: #faf7f0; }
  .toolbar .nav a.disabled { color: #ccc; pointer-events: none; border-color: #eee; }
  .lesson-container { max-width: 780px; margin: 0 auto; padding: 1.5rem; }
  #lesson-frame { width: 100%; border: none; background: #fff; border-radius: 8px; border: 1px solid #e8e4dc; }
  .feedback-bar { background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 1.25rem; margin-top: 1.5rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
  .feedback-bar .label { font-size: 0.85rem; color: #555; }
  .feedback-bar button { padding: 0.4rem 0.9rem; border: 1px solid #e8e4dc; border-radius: 20px; background: #fff; cursor: pointer; font-size: 0.85rem; transition: all 0.15s; }
  .feedback-bar button:hover { border-color: #b8a88a; }
  .feedback-bar button.selected { background: #f0ebe0; border-color: #b8a88a; }
  .feedback-bar .done-btn { margin-left: auto; padding: 0.5rem 1.25rem; background: #2d2d2d; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 0.85rem; }
  .feedback-bar .done-btn:hover { background: #444; }
  .lesson-chat { margin-top: 1.5rem; background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 1.25rem; }
  .lesson-chat h3 { font-size: 0.95rem; margin-bottom: 1rem; color: #555; font-weight: 500; }
  #followup-messages { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1rem; }
  .msg { padding: 0.75rem 1rem; border-radius: 8px; line-height: 1.5; font-size: 0.95rem; }
  .msg.assistant { background: #fff; border: 1px solid #e8e4dc; align-self: flex-start; max-width: 85%; }
  .msg.user { background: #f0ebe0; align-self: flex-end; max-width: 85%; }
  .lesson-chat .chat-form { display: flex; gap: 0.5rem; }
  .lesson-chat .chat-form textarea { flex: 1; padding: 0.7rem 1rem; border: 1px solid #e8e4dc; border-radius: 8px; font-size: 1rem; font-family: inherit; resize: none; }
  .lesson-chat .chat-form textarea:focus { outline: none; border-color: #b8a88a; }
  .lesson-chat .chat-form button { padding: 0.7rem 1.5rem; background: #2d2d2d; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .lesson-chat .chat-form button:hover { background: #444; }
</style>
</head>
<body>
${HTMX_LOADING_BAR}
<div class="toolbar">
  <div class="left">
    <a href="/missions/${missionId}">&larr; ${missionTitle}</a>
    <h1>${String(lessonNumber).padStart(4, "0")} — ${lessonTitle}</h1>
  </div>
  <div class="nav">
    ${prevLesson ? `<a href="/missions/${missionId}/lessons/${lessonNumber - 1}">&larr; Previous</a>` : `<span class="disabled">&larr; Previous</span>`}
    ${nextLesson ? `<a href="/missions/${missionId}/lessons/${lessonNumber + 1}">Next &rarr;</a>` : `<span class="disabled">Next &rarr;</span>`}
  </div>
</div>
<div class="lesson-container">
  <iframe id="lesson-frame" scrolling="no" srcdoc="${lessonHtmlContent.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/<\/body>/i, `<script>function r(){const h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);parent.postMessage({type:'lessonResize',height:h},'*');}new ResizeObserver(r).observe(document.body);r();<\/script></body>`)}"></iframe>

  <div class="feedback-bar" id="feedback-bar">
    <span class="label">How was this lesson?</span>
    <button hx-post="/missions/${missionId}/lessons/${lessonNumber}/feedback" hx-target="#feedback-bar" hx-swap="outerHTML" hx-vals='{"rating":"too_easy"}'>Too easy</button>
    <button hx-post="/missions/${missionId}/lessons/${lessonNumber}/feedback" hx-target="#feedback-bar" hx-swap="outerHTML" hx-vals='{"rating":"just_right"}'>Just right</button>
    <button hx-post="/missions/${missionId}/lessons/${lessonNumber}/feedback" hx-target="#feedback-bar" hx-swap="outerHTML" hx-vals='{"rating":"too_hard"}'>Too hard</button>
    <form hx-post="/missions/${missionId}/lessons/${lessonNumber}/complete" hx-target="#feedback-bar" hx-swap="outerHTML" style="margin-left:auto;">
      <button type="submit" class="done-btn">Mark Complete</button>
    </form>
  </div>

  ${feedbackRating ? `
    <div class="feedback-bar">
      <span class="label">You rated this: <strong>${feedbackRating.replace("_", " ")}</strong></span>
      ${feedbackText ? `<span style="font-size:0.85rem;color:#888;">${feedbackText}</span>` : ""}
    </div>
  ` : ""}

  <div class="lesson-chat">
    <h3>Questions about this lesson?</h3>
    <div id="followup-messages"></div>
    <form class="chat-form" hx-post="/missions/${missionId}/chat" hx-target="#followup-messages" hx-swap="beforeend" hx-on::before-request="optimisticChat(this)" hx-on::after-request="this.reset()">
      <input type="hidden" name="context" value="Lesson ${lessonNumber}: ${lessonTitle}">
      <textarea name="message" placeholder="What's unclear about this lesson?" rows="2" oninput="autoResize(this)"></textarea>
      <button type="submit">Ask</button>
    </form>
  </div>
</div>
<script>
const frame = document.getElementById('lesson-frame');
frame.style.minHeight = (window.innerHeight - 200) + 'px';
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

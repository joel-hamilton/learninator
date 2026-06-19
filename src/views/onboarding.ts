import { GUIDED_QUESTION_SCRIPT, HTMX_HEAD, HTMX_LOADING_BAR, svgIcon, userInitial, userMenu } from "./shared.js";
import { siteWideIndicator, activationProgressPanel } from "./fragments.js";
import { ssePollerScript } from "../shared/sse-poller.js";

/** Chat-focused page for onboarding missions. */
export function onboardingLayout(user: { email: string; name?: string | null }, mission: { id: number; title: string }, messagesHtml: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${mission.title} — Learninator</title>
${HTMX_HEAD}
<style>
  .header {
    background: var(--paper);
    border-bottom: 1px solid var(--rule);
    padding: 0 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 56px;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .header-left { display: flex; align-items: center; gap: 0.75rem; }
  .header h1 { font-size: 0.95rem; font-weight: 600; }
  .header .logo {
    font-size: 0.95rem; font-weight: 700; letter-spacing: -0.02em;
    display: flex; align-items: center; gap: 0.35rem;
    color: var(--ink); text-decoration: none; flex-shrink: 0;
    font-family: var(--font-display);
  }
  .header .logo:hover { color: var(--ink); }
  .header .logo .svg-icon { width: 1.1em; height: 1.1em; color: var(--rubric); }
  .header .back {
    font-size: 0.8rem; color: var(--ink-secondary); text-decoration: none;
    display: inline-flex; align-items: center; gap: 0.3rem;
    padding: 0.3rem 0.6rem; border: 1px solid var(--rule); border-radius: var(--radius-sm);
    transition: all var(--transition);
  }
  .header .back:hover { border-color: var(--rule-hover); color: var(--ink); background: var(--surface-hover); }
  .header-right { font-size: 0.8rem; color: var(--ink-secondary); display: flex; align-items: center; gap: 0.75rem; }

  .container { max-width: 700px; margin: 3rem auto; padding: 0 2rem; animation: fadeInUp 0.4s ease-out; }
  h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem; letter-spacing: -0.02em; font-family: var(--font-display); }
  .subtitle { color: var(--ink-secondary); margin-bottom: 0.4rem; font-size: 0.9rem; line-height: 1.5; }

  #chat-messages {
    display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem;
    max-height: 55vh; overflow-y: auto; padding: 0.25rem;
    overflow-wrap: break-word; word-break: break-word;
  }
  #chat-messages > * { min-width: 0; max-width: 100%; }
</style>
</head>
<body data-user-initial="${userInitial(user)}">
${HTMX_LOADING_BAR}
<header class="header">
  <div class="header-left">
    <a href="/" class="logo">${svgIcon("zap")} Learninator</a>
    <h1>${mission.title}</h1>
  </div>
  <div class="header-right">${userMenu(user)}</div>
</header>
<div class="container">
  <h1>Mission Setup</h1>
  <p class="subtitle">Your AI teacher will interview you to define your learning goals.</p>
  <form hx-post="/missions/${mission.id}/mode" hx-target="body" hx-swap="outerHTML" style="margin-bottom:2rem;"><input type="hidden" name="mode" value="guided"><button type="submit" style="background:none;border:none;padding:0;font:inherit;color:var(--note);font-size:0.82rem;text-decoration:underline;text-decoration-style:dotted;cursor:pointer;text-underline-offset:2px;font-weight:500;">Prefer structured questions instead?</button></form>
  <div id="chat-messages">
    ${messagesHtml}
  </div>
  <form class="chat-form" hx-post="/missions/${mission.id}/chat" hx-target="#chat-messages" hx-swap="beforeend" hx-on::before-request="optimisticChat(this)" hx-on::after-request="this.reset()">
      <div class="textarea-wrapper">
        <textarea name="message" id="chat-input" placeholder="Type your answer..." autofocus autocomplete="off" rows="2" oninput="autoResize(this)"></textarea>
        <span class="textarea-hint">Press Enter to send &middot; Shift + Enter for newline</span>
      </div>
      <button type="submit">Send</button>
  </form>
</div>
</body>
</html>`;
}
/** Guided onboarding page with question card UI. */
export function guidedOnboardingLayout(
  user: { email: string; name?: string | null },
  mission: { id: number; title: string },
  messagesHtml: string,
  questionId: number | null,
  question: string | null,
  options: string[],
  needsTrigger: boolean
) {
  let questionCardHtml = "";
  if (needsTrigger) {
    questionCardHtml = `<div class="question-card" id="question-card">
      <div class="msg assistant thinking-bubble"><span class="thinking-dots"><span></span><span></span><span></span></span></div>
      <div hx-post="/missions/${mission.id}/guided/start" hx-target="#question-card" hx-swap="outerHTML" hx-trigger="load"></div>
    </div>`;
  } else if (questionId && question) {
    questionCardHtml = guidedQuestionCard(mission.id, questionId, question, options);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${mission.title} — Learninator</title>
${HTMX_HEAD}
<style>
  :root { --bg: #fdfcf9; --surface: #ffffff; --border: #e8e4dc; --border-hover: #d4cdbc; --text: #2d2d2d; --text-secondary: #6b6b6b; --text-muted: #a3a3a3; --primary: #2d2d2d; --primary-hover: #444444; --primary-light: #f5f2eb; --warning: #8b6914; --warning-bg: #fef5e7; --radius: 8px; --radius-lg: 12px; --shadow-sm: 0 1px 2px rgba(0,0,0,0.04); --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04); --transition: 150ms ease; --transition-slow: 250ms cubic-bezier(0.4, 0, 0.2, 1); }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); }
  .header { background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); padding: 0 2rem; display: flex; align-items: center; justify-content: space-between; height: 56px; }
  .header .left { display: flex; align-items: center; gap: 1rem; }
  .header h1 { font-size: 1.1rem; font-weight: 600; }
  .header .back { font-size: 0.85rem; color: var(--text-secondary); text-decoration: none; }
  .header .back:hover { color: var(--text); }
  .header .right { display: flex; align-items: center; gap: 0.75rem; }
  .header .user { font-size: 0.85rem; color: var(--text-secondary); }
  .header .user a { color: var(--text-secondary); text-decoration: none; margin-left: 0.5rem; }
  .header .user a:hover { color: var(--text); }
  .container { max-width: 700px; margin: 2rem auto; padding: 0 2rem; }
  h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  .subtitle { color: var(--text-secondary); margin-bottom: 0.3rem; }
  #chat-messages { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; max-height: 30vh; overflow-y: auto; padding: 0.25rem; }
  .msg { padding: 0.6rem 0.9rem; border-radius: 8px; line-height: 1.5; font-size: 0.9rem; }
  .msg.assistant { background: var(--surface); border: 1px solid var(--border); align-self: flex-start; max-width: 90%; }
  .msg.user { background: var(--primary-light); align-self: flex-end; max-width: 90%; }
  .question-card { background: var(--surface); border: 2px solid var(--border-hover); border-radius: 12px; padding: 1.75rem; animation: fadeInUp 0.3s ease-out; }
  .question-card h2 { font-size: 1.15rem; margin-bottom: 1.25rem; line-height: 1.4; }
  .option-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 0.85rem; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 0.5rem; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
  .option-row:hover { border-color: var(--primary); background: var(--primary-light); }
  .option-row.selected { border-color: var(--warning); background: var(--warning-bg); }
  .option-row input[type="radio"] { accent-color: var(--warning); width: 1.1em; height: 1.1em; cursor: pointer; }
  .option-row label { flex: 1; cursor: pointer; font-size: 0.95rem; }
  .other-input { margin-top: 0.5rem; margin-bottom: 0.75rem; display: none; }
  .other-input.visible { display: block; }
  .other-input input { width: 100%; padding: 0.6rem 0.85rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem; font-family: inherit; }
  .other-input input:focus { outline: none; border-color: var(--primary); }
  .question-card .submit-btn { margin-top: 1rem; padding: 0.7rem 2rem; background: var(--primary); color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .question-card .submit-btn:hover { background: var(--primary-hover); }
  .question-card .submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .skip-btn { display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; background: transparent; border: 1px solid var(--border); border-radius: 6px; font-size: 0.85rem; color: var(--text-muted); cursor: pointer; text-decoration: none; }
  .skip-btn:hover { border-color: #ccc; color: var(--text-secondary); }
  .skip-btn.htmx-request { opacity: 0.5; pointer-events: none; border-color: var(--warning); color: var(--warning); }
  .skip-btn.htmx-request::after { content: " (working...)"; }
  .thinking-bubble { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem 1rem; display: inline-block; }
  .thinking-dots { display: flex; gap: 0.3rem; }
  .thinking-dots span { width: 0.5em; height: 0.5em; background: #ccc; border-radius: 50%; animation: dotPulse 1.4s infinite ease-in-out; }
  .thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
  .thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes dotPulse { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .spinner { display: inline-block; width: 1em; height: 1em; border: 2px solid #ccc; border-top-color: #888; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 0.5rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body data-user-initial="${userInitial(user)}">
<div id="htmx-loading-bar" class="htmx-indicator" style="position:fixed;top:0;left:0;height:3px;background:var(--primary);z-index:9999;opacity:0;transition:opacity 150ms;width:0;"></div>
<header class="header">
  <div class="left">
    <a href="/" class="back">${svgIcon("arrowLeft")} Dashboard</a>
    <h1>${mission.title}</h1>
  </div>
  <div class="right">${userMenu(user)}</div>
</header>
	${siteWideIndicator()}
<div class="container">
  <h1>Mission Setup</h1>
  <p class="subtitle">Answer each question to define your learning goals.</p>
  ${activationProgressPanel()}
  <form hx-post="/missions/${mission.id}/mode" hx-target="body" hx-swap="outerHTML" style="margin-bottom:1.5rem;"><input type="hidden" name="mode" value="chat"><button type="submit" style="background:none;border:none;padding:0;font:inherit;color:var(--text-secondary);font-size:0.85rem;text-decoration:underline;text-decoration-style:dotted;cursor:pointer;text-underline-offset:2px;">Prefer free-form chat instead?</button></form>
  <div id="chat-messages">${messagesHtml}</div>
  <div id="question-section">
    ${questionCardHtml}
    <div style="text-align:center;">
      <button class="skip-btn" hx-post="/missions/${mission.id}/guided/skip" hx-target="body" hx-swap="outerHTML">I've answered enough — just create the mission</button>
    </div>
  </div>
</div>
	<script>${GUIDED_QUESTION_SCRIPT}</script>
${ssePollerScript()}
</body>
</html>`;
}

/** Renders a single guided question card with radio options. */
export function guidedQuestionCard(missionId: number, questionId: number, question: string, options: string[]) {
  const optionRows = options.map((opt, i) => {
    const isOther = i === options.length - 1;
    const escaped = opt.replace(/"/g, "&quot;");
    return `<div class="option-row" onclick="selectOption(this, ${i})">
      <input type="radio" name="answer" value="${escaped}" id="opt-${i}" onchange="onOptionChange(${i})">
      <label for="opt-${i}">${opt}</label>
    </div>`;
  }).join("");

  return `<div class="question-card" id="question-card">
    <h2>${question}</h2>
    <div id="options-container">
      ${optionRows}
    </div>
    <div class="other-input" id="other-input">
      <input type="text" name="other_text" id="other-text" placeholder="Type your answer..." autocomplete="off" oninput="onOtherInput(this)">
    </div>
    <form hx-post="/missions/${missionId}/guided/answer" hx-target="#question-section" hx-swap="outerHTML" hx-on::before-request="return submitGuidedAnswer()" hx-on::after-request="this.reset()">
      <input type="hidden" name="question_id" value="${questionId}">
      <input type="hidden" name="answer" id="answer-hidden">
      <input type="hidden" name="other_text" id="other-text-hidden">
      <button type="submit" class="submit-btn" id="submit-btn" disabled>Submit</button>
    </form>
  </div>`;
}

/** Full question section (card + skip button) for AJAX responses. */
export function guidedQuestionSection(missionId: number, questionId: number, question: string, options: string[]) {
  return `<div id="question-section">
    ${guidedQuestionCard(missionId, questionId, question, options)}
    <div style="text-align:center;">
      <button class="skip-btn" hx-post="/missions/${missionId}/guided/skip" hx-target="body" hx-swap="outerHTML">I've answered enough — just create the mission</button>
    </div>
  </div>`;
}

/** Thinking state section that triggers a guided turn. */
export function guidedThinkingSection(missionId: number) {
  return `<div id="question-section">
    <div class="question-card" id="question-card">
      <div class="msg assistant thinking-bubble"><span class="thinking-dots"><span></span><span></span><span></span></span></div>
      <div hx-post="/missions/${missionId}/guided/start" hx-target="#question-section" hx-swap="outerHTML" hx-trigger="load"></div>
    </div>
    <div style="text-align:center;">
      <button class="skip-btn" hx-post="/missions/${missionId}/guided/skip" hx-target="body" hx-swap="outerHTML">I've answered enough — just create the mission</button>
    </div>
  </div>`;
}


export function newMissionPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Start a New Mission — Learninator</title>
${HTMX_HEAD}
<style>
  .header {
    background: var(--paper);
    border-bottom: 1px solid var(--rule);
    padding: 0 1.5rem;
    display: flex;
    align-items: center;
    height: 56px;
  }
  .header .logo {
    font-size: 1rem; font-weight: 700; letter-spacing: -0.02em;
    display: flex; align-items: center; gap: 0.35rem;
    color: var(--ink); text-decoration: none;
    font-family: var(--font-display);
  }
  .header .logo:hover { color: var(--ink); }
  .header .logo .svg-icon { width: 1.15em; height: 1.15em; color: var(--rubric); }

  .container { max-width: 700px; margin: 3rem auto; padding: 0 2rem; animation: fadeInUp 0.4s ease-out; }
  h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem; letter-spacing: -0.02em; font-family: var(--font-display); }
  .subtitle { color: var(--ink-secondary); margin-bottom: 2rem; font-size: 0.9rem; line-height: 1.5; }

  #chat-messages {
    display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem;
    max-height: 50vh; overflow-y: auto; padding: 0.25rem;
    overflow-wrap: break-word; word-break: break-word;
  }
  #chat-messages > * { min-width: 0; max-width: 100%; }

  .mode-select { display: flex; gap: 0.75rem; margin-bottom: 1.75rem; }
  .mode-option {
    flex: 1; background: var(--surface); border: 2px solid var(--rule);
    border-radius: var(--radius-lg); padding: 1.25rem; cursor: pointer;
    text-align: center; transition: all var(--transition-slow);
    box-shadow: var(--shadow-sm);
  }
  .mode-option:hover { border-color: var(--rule-hover); background: var(--surface-hover); transform: translateY(-1px); }
  .mode-option.selected { border-color: var(--rubric); background: var(--rubric-light); box-shadow: 0 0 0 4px rgba(192,57,43,0.05); }
  .mode-option h3 { font-size: 0.95rem; margin-bottom: 0.25rem; font-weight: 600; }
  .mode-option p { font-size: 0.78rem; color: var(--ink-secondary); margin: 0; line-height: 1.4; }
  .mode-option input[type="radio"] { display: none; }
</style>
</head>
<body>
${HTMX_LOADING_BAR}
<header class="header">
  <a href="/" class="logo">${svgIcon("zap")} Learninator</a>
</header>
<div class="container">
  <h1>Start a new mission</h1>
  <p class="subtitle">Choose how you'd like to set up your learning mission. Your AI teacher will guide you through defining your goals.</p>
  <div class="mode-select" id="mode-select">
    <label class="mode-option selected" onclick="selectMode('guided')">
      <input type="radio" name="setup_mode" value="guided" checked>
      <h3>Guided Setup</h3>
      <p>One question at a time with multiple choice answers</p>
    </label>
    <label class="mode-option" onclick="selectMode('chat')">
      <input type="radio" name="setup_mode" value="chat">
      <h3>Chat Setup</h3>
      <p>Free-form conversation with your AI teacher</p>
    </label>
  </div>
  <div id="chat-messages">
    <div class="msg assistant">Hi! I'm your teacher. What would you like to learn? Be as specific as you can — for example, "I want to be able to solo on guitar anywhere on the neck" or "I want to ship a Rust CLI tool."</div>
  </div>
  <form class="chat-form" hx-post="/missions" hx-target="#chat-messages" hx-swap="beforeend" hx-on::before-request="optimisticChat(this); attachMode(this)" hx-on::after-request="this.reset()">
    <div class="textarea-wrapper">
      <textarea name="message" id="chat-input" placeholder="Type your answer..." autofocus autocomplete="off" rows="2" oninput="autoResize(this)"></textarea>
      <span class="textarea-hint">Press Enter to send &middot; Shift + Enter for newline</span>
    </div>
    <input type="hidden" name="mode" value="guided" id="mode-input">
    <button type="submit">Send</button>
  </form>
</div>
<script>
function selectMode(mode) {
  document.querySelectorAll('.mode-option').forEach(function(el) { el.classList.remove('selected'); });
  document.querySelector('input[value="' + mode + '"]').closest('.mode-option').classList.add('selected');
  document.getElementById('mode-input').value = mode;
}
function attachMode(form) {
  document.getElementById('mode-input').value = document.querySelector('input[name="setup_mode"]:checked').value;
  return true;
}
</script>
</body>
</html>`;
}

import { HTMX_HEAD, HTMX_LOADING_BAR, svgIcon, userInitial, userMenu } from "./shared.js";
import { browseSectionHtml } from "./browse.js";

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
    background: rgba(255,255,255,0.85);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-bottom: 1px solid var(--border);
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
    color: var(--text); text-decoration: none; flex-shrink: 0;
  }
  .header .logo:hover { color: var(--text); }
  .header .logo .svg-icon { width: 1.1em; height: 1.1em; color: var(--accent); }
  .header .back {
    font-size: 0.8rem; color: var(--text-secondary); text-decoration: none;
    display: inline-flex; align-items: center; gap: 0.3rem;
    padding: 0.3rem 0.6rem; border: 1px solid var(--border); border-radius: var(--radius-sm);
    transition: all var(--transition);
  }
  .header .back:hover { border-color: var(--border-hover); color: var(--text); background: var(--surface-hover); }
  .header-right { font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.75rem; }

  .container { max-width: 700px; margin: 3rem auto; padding: 0 2rem; animation: fadeInUp 0.4s ease-out; }
  h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.25rem; letter-spacing: -0.03em; }
  .subtitle { color: var(--text-secondary); margin-bottom: 0.4rem; font-size: 0.9rem; line-height: 1.5; }

  #chat-messages {
    display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem;
    max-height: 55vh; overflow-y: auto; padding: 0.25rem;
  }
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
  <form hx-post="/missions/${mission.id}/mode" hx-target="body" hx-swap="outerHTML" style="margin-bottom:2rem;"><input type="hidden" name="mode" value="guided"><button type="submit" style="background:none;border:none;padding:0;font:inherit;color:var(--accent);font-size:0.82rem;text-decoration:underline;text-decoration-style:dotted;cursor:pointer;text-underline-offset:2px;font-weight:500;">Prefer structured questions instead?</button></form>
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
    background: rgba(255,255,255,0.85);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-bottom: 1px solid var(--border);
    padding: 0 1.5rem;
    display: flex;
    align-items: center;
    height: 56px;
  }
  .header .logo {
    font-size: 1rem; font-weight: 700; letter-spacing: -0.02em;
    display: flex; align-items: center; gap: 0.35rem;
    color: var(--text); text-decoration: none;
  }
  .header .logo:hover { color: var(--text); }
  .header .logo .svg-icon { width: 1.15em; height: 1.15em; color: var(--accent); }

  .container { max-width: 700px; margin: 3rem auto; padding: 0 2rem; animation: fadeInUp 0.4s ease-out; }
  h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.25rem; letter-spacing: -0.03em; }
  .subtitle { color: var(--text-secondary); margin-bottom: 2rem; font-size: 0.9rem; line-height: 1.5; }

  #chat-messages {
    display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem;
    max-height: 50vh; overflow-y: auto; padding: 0.25rem;
  }

  .mode-select { display: flex; gap: 0.75rem; margin-bottom: 1.75rem; }
  .mode-option {
    flex: 1; background: var(--surface); border: 2px solid var(--border);
    border-radius: var(--radius-lg); padding: 1.25rem; cursor: pointer;
    text-align: center; transition: all var(--transition-slow);
    box-shadow: var(--shadow-sm);
  }
  .mode-option:hover { border-color: var(--border-hover); background: var(--surface-hover); transform: translateY(-1px); }
  .mode-option.selected { border-color: var(--accent); background: var(--accent-light); box-shadow: 0 0 0 4px rgba(79,70,229,0.06); }
  .mode-option h3 { font-size: 0.95rem; margin-bottom: 0.25rem; font-weight: 600; }
  .mode-option p { font-size: 0.78rem; color: var(--text-secondary); margin: 0; line-height: 1.4; }
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
  ${browseSectionHtml()}
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

import { HTMX_HEAD, HTMX_LOADING_BAR } from "./shared.js";

/** Chat-focused page for onboarding missions. */
export function onboardingLayout(user: { email: string }, mission: { id: number; title: string }, messagesHtml: string) {
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
  .header-left { display: flex; align-items: center; gap: 1rem; }
  .header h1 { font-size: 1.1rem; font-weight: 600; }
  .header .back { font-size: 0.85rem; color: var(--text-secondary); text-decoration: none; }
  .header .back:hover { color: var(--text); }
  .header-right { font-size: 0.85rem; color: var(--text-secondary); }
  .header-right a { color: var(--text-secondary); text-decoration: none; margin-left: 0.5rem; }
  .header-right a:hover { color: var(--text); }

  .container { max-width: 700px; margin: 3rem auto; padding: 0 2rem; animation: fadeInUp 0.35s ease-out; }
  h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.25rem; letter-spacing: -0.02em; }
  .subtitle { color: var(--text-secondary); margin-bottom: 2rem; font-size: 0.95rem; }

  #chat-messages {
    display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem;
    max-height: 55vh; overflow-y: auto; padding: 0.25rem;
  }
</style>
</head>
<body>
${HTMX_LOADING_BAR}
<header class="header">
  <div class="header-left">
    <a href="/" class="back">&larr; Dashboard</a>
    <h1>${mission.title}</h1>
  </div>
  <div class="header-right">${user.email} <a href="/logout">Log out</a></div>
</header>
<div class="container">
  <h1>Mission Setup</h1>
  <p class="subtitle">Your AI teacher will interview you to understand your learning goals.</p>
  <div id="chat-messages">
    ${messagesHtml}
  </div>
  <form class="chat-form" hx-post="/missions/${mission.id}/chat" hx-target="#chat-messages" hx-swap="beforeend" hx-on::before-request="optimisticChat(this)" hx-on::after-request="this.reset()">
    <textarea name="message" id="chat-input" placeholder="Type your answer..." autofocus autocomplete="off" rows="2" oninput="autoResize(this)"></textarea>
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
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 0 2rem;
    display: flex;
    align-items: center;
    height: 56px;
  }
  .header a { color: var(--text-secondary); text-decoration: none; font-size: 0.85rem; }
  .header a:hover { color: var(--text); }

  .container { max-width: 700px; margin: 3rem auto; padding: 0 2rem; animation: fadeInUp 0.35s ease-out; }
  h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.25rem; letter-spacing: -0.02em; }
  .subtitle { color: var(--text-secondary); margin-bottom: 2rem; font-size: 0.95rem; }

  #chat-messages {
    display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem;
    max-height: 55vh; overflow-y: auto; padding: 0.25rem;
  }
</style>
</head>
<body>
${HTMX_LOADING_BAR}
<header class="header">
  <a href="/">&larr; Dashboard</a>
</header>
<div class="container">
  <h1>Start a new mission</h1>
  <p class="subtitle">Your AI teacher will help you define your learning goals.</p>
  <div id="chat-messages">
    <div class="msg assistant">Hi! I'm your teacher. What would you like to learn? Be as specific as you can — for example, "I want to be able to solo on guitar anywhere on the neck" or "I want to ship a Rust CLI tool."</div>
  </div>
  <form class="chat-form" hx-post="/missions" hx-target="#chat-messages" hx-swap="beforeend" hx-on::before-request="optimisticChat(this)" hx-on::after-request="this.reset()">
    <textarea name="message" id="chat-input" placeholder="Type your answer..." autofocus autocomplete="off" rows="2" oninput="autoResize(this)"></textarea>
    <button type="submit">Send</button>
  </form>
</div>
</body>
</html>`;
}

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
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #fdfcf9; color: #2d2d2d; }
  .header { background: #fff; border-bottom: 1px solid #e8e4dc; padding: 0 2rem; display: flex; align-items: center; justify-content: space-between; height: 56px; }
  .header .left { display: flex; align-items: center; gap: 1rem; }
  .header h1 { font-size: 1.1rem; font-weight: 600; }
  .header .back { font-size: 0.85rem; color: #888; text-decoration: none; }
  .header .back:hover { color: #2d2d2d; }
  .header .user { font-size: 0.85rem; color: #888; }
  .header .user a { color: #888; text-decoration: none; margin-left: 0.5rem; }
  .header .user a:hover { color: #2d2d2d; }
  .container { max-width: 700px; margin: 3rem auto; padding: 0 2rem; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  .subtitle { color: #888; margin-bottom: 2rem; }
  #chat-messages { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
  .msg { padding: 0.75rem 1rem; border-radius: 8px; line-height: 1.5; font-size: 0.95rem; }
  .msg.assistant { background: #fff; border: 1px solid #e8e4dc; align-self: flex-start; max-width: 85%; }
  .msg.user { background: #f0ebe0; align-self: flex-end; max-width: 85%; }
  .chat-form { display: flex; gap: 0.5rem; }
  .chat-form textarea { flex: 1; padding: 0.7rem 1rem; border: 1px solid #e8e4dc; border-radius: 8px; font-size: 1rem; font-family: inherit; resize: none; }
  .chat-form textarea:focus { outline: none; border-color: #b8a88a; }
  .chat-form button { padding: 0.7rem 1.5rem; background: #2d2d2d; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .chat-form button:hover { background: #444; }
  .spinner { display: inline-block; width: 1em; height: 1em; border: 2px solid #ccc; border-top-color: #888; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 0.5rem; }
</style>
</head>
<body>
${HTMX_LOADING_BAR}
<header class="header">
  <div class="left">
    <a href="/" class="back">&larr; Dashboard</a>
    <h1>${mission.title}</h1>
  </div>
  <div class="user">${user.email} <a href="/logout">Log out</a></div>
</header>
<div class="container">
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
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #fdfcf9; color: #2d2d2d; }
  .header { background: #fff; border-bottom: 1px solid #e8e4dc; padding: 0 2rem; display: flex; align-items: center; height: 56px; }
  .header a { color: #888; text-decoration: none; font-size: 0.85rem; }
  .header a:hover { color: #2d2d2d; }
  .container { max-width: 700px; margin: 3rem auto; padding: 0 2rem; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  .subtitle { color: #888; margin-bottom: 2rem; }
  #chat-messages { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
  .msg { padding: 0.75rem 1rem; border-radius: 8px; line-height: 1.5; font-size: 0.95rem; }
  .msg.assistant { background: #fff; border: 1px solid #e8e4dc; align-self: flex-start; max-width: 85%; }
  .msg.user { background: #f0ebe0; align-self: flex-end; max-width: 85%; }
  .chat-form { display: flex; gap: 0.5rem; }
  .chat-form textarea { flex: 1; padding: 0.7rem 1rem; border: 1px solid #e8e4dc; border-radius: 8px; font-size: 1rem; font-family: inherit; resize: none; }
  .chat-form textarea:focus { outline: none; border-color: #b8a88a; }
  .chat-form button { padding: 0.7rem 1.5rem; background: #2d2d2d; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .chat-form button:hover { background: #444; }
  .spinner { display: inline-block; width: 1em; height: 1em; border: 2px solid #ccc; border-top-color: #888; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 0.5rem; }
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

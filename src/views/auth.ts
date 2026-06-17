import { HTMX_HEAD, HTMX_LOADING_BAR } from "./shared.js";

function authCard(title: string, subtitle: string, formHtml: string, altHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Learninator</title>
${HTMX_HEAD}
<style>
  body {
    font-family: var(--font-body);
    background:
      radial-gradient(ellipse 60% 40% at 50% 0%, rgba(192,57,43,0.03), transparent),
      radial-gradient(ellipse 40% 30% at 100% 100%, rgba(59,107,158,0.03), transparent),
      var(--paper);
    color: var(--ink);
    display: flex; align-items: center; justify-content: center; min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }
  .card {
    background: var(--surface); border: 1px solid var(--rule); border-radius: var(--radius-xl);
    padding: 2.75rem; width: 100%; max-width: 420px; box-shadow: var(--shadow-xl);
    animation: fadeInUp 0.5s ease-out;
  }
  .brand { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; }
  .brand svg { width: 1.5em; height: 1.5em; color: var(--rubric); }
  h1 { font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em; font-family: var(--font-display); }
  .sub { color: var(--ink-secondary); font-size: 0.9rem; margin-bottom: 1.75rem; line-height: 1.5; }
  label { display: block; font-size: 0.85rem; font-weight: 500; margin-bottom: 0.3rem; margin-top: 1.1rem; color: var(--ink); }
  input {
    width: 100%; padding: 0.7rem 0.9rem; border: 1.5px solid var(--rule); border-radius: var(--radius-sm);
    font-size: 0.95rem; font-family: inherit; transition: all var(--transition-slow); outline: none;
    background: var(--surface);
  }
  input:hover { border-color: var(--rule-hover); }
  input:focus { border-color: var(--ink); box-shadow: 0 0 0 3px rgba(30,27,24,0.06); }
  button {
    width: 100%; padding: 0.75rem; background: var(--rubric); color: #fff; border: none;
    border-radius: var(--radius-sm); font-size: 1rem; cursor: pointer; margin-top: 1.5rem;
    font-family: inherit; font-weight: 600; transition: all var(--transition-slow);
    box-shadow: 0 1px 3px rgba(192,57,43,0.2);
  }
  button:hover { background: var(--rubric-hover); box-shadow: 0 4px 14px rgba(192,57,43,0.3); }
  button:active { transform: scale(0.98); }
  .error { background: var(--danger-bg); color: var(--danger); padding: 0.6rem 0.85rem; border-radius: var(--radius-sm); font-size: 0.85rem; margin-top: 0.5rem; border: 1px solid var(--danger-border); }
  .alt-link { text-align: center; margin-top: 1.25rem; font-size: 0.85rem; color: var(--ink-secondary); }
  .alt-link a { color: var(--note); font-weight: 600; }
  .alt-link a:hover { color: var(--note-hover); text-decoration: underline; }
</style>
</head>
<body>
${HTMX_LOADING_BAR}
<div class="card">
  <div class="brand">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
    <h1>Learninator</h1>
  </div>
  <p class="sub">${subtitle}</p>
  ${formHtml}
  <p class="alt-link">${altHtml}</p>
</div>
</body>
</html>`;
}

export function loginPage(): string {
  return authCard(
    "Login",
    "Sign in to continue learning",
    `<form hx-post="/login" hx-target="this" hx-swap="outerHTML">
      <label for="email">Email</label>
      <input type="email" name="email" id="email" required autocomplete="email">
      <label for="password">Password</label>
      <input type="password" name="password" id="password" required autocomplete="current-password">
      <div id="error"></div>
      <button type="submit">Sign in</button>
    </form>`,
    `Don't have an account? <a href="/signup">Sign up</a>`
  );
}

export function signupPage(): string {
  return authCard(
    "Sign Up",
    "Create your account",
    `<form hx-post="/signup" hx-target="this" hx-swap="outerHTML">
      <label for="email">Email</label>
      <input type="email" name="email" id="email" required autocomplete="email">
      <label for="password">Password</label>
      <input type="password" name="password" id="password" required minlength="6" autocomplete="new-password">
      <label for="confirm">Confirm password</label>
      <input type="password" name="confirm" id="confirm" required minlength="6" autocomplete="new-password">
      <div id="error"></div>
      <button type="submit">Create account</button>
    </form>`,
    `Already have an account? <a href="/login">Sign in</a>`
  );
}

export function loginForm(email: string, error: string): string {
  return `<form hx-post="/login" hx-target="this" hx-swap="outerHTML">
      <label for="email">Email</label>
      <input type="email" name="email" id="email" value="${email}" required autocomplete="email">
      <label for="password">Password</label>
      <input type="password" name="password" id="password" required autocomplete="current-password">
      <div id="error" class="error">${error}</div>
      <button type="submit">Sign in</button>
    </form>`;
}

export function signupForm(email: string, error: string): string {
  return `<form hx-post="/signup" hx-target="this" hx-swap="outerHTML">
      <label for="email">Email</label>
      <input type="email" name="email" id="email" value="${email}" required autocomplete="email">
      <label for="password">Password</label>
      <input type="password" name="password" id="password" required minlength="6" autocomplete="new-password">
      <label for="confirm">Confirm password</label>
      <input type="password" name="confirm" id="confirm" required minlength="6" autocomplete="new-password">
      <div id="error" class="error">${error}</div>
      <button type="submit">Create account</button>
    </form>`;
}

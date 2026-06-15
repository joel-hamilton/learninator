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
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg); color: var(--text);
    display: flex; align-items: center; justify-content: center; min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }
  .card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl);
    padding: 2.5rem; width: 100%; max-width: 400px; box-shadow: var(--shadow-lg);
  }
  h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.25rem; letter-spacing: -0.02em; }
  .sub { color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem; }
  label { display: block; font-size: 0.85rem; font-weight: 500; margin-bottom: 0.25rem; margin-top: 1rem; }
  input {
    width: 100%; padding: 0.65rem 0.85rem; border: 1px solid var(--border); border-radius: var(--radius);
    font-size: 0.95rem; font-family: inherit; transition: all var(--transition); outline: none;
  }
  input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(45,45,45,0.1); }
  button {
    width: 100%; padding: 0.7rem; background: var(--primary); color: #fff; border: none;
    border-radius: var(--radius); font-size: 1rem; cursor: pointer; margin-top: 1.25rem;
    font-family: inherit; font-weight: 500; transition: all var(--transition);
  }
  button:hover { background: var(--primary-hover); }
  button:active { transform: scale(0.98); }
  .error { background: var(--danger-bg); color: var(--danger); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.85rem; margin-top: 0.5rem; border: 1px solid var(--danger-border); }
  .alt-link { text-align: center; margin-top: 1rem; font-size: 0.85rem; color: var(--text-secondary); }
  .alt-link a { color: var(--primary); font-weight: 500; }
  .alt-link a:hover { text-decoration: underline; }
</style>
</head>
<body>
${HTMX_LOADING_BAR}
<div class="card">
  <h1>Learninator</h1>
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

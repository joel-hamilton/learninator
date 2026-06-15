import { HTMX_HEAD, HTMX_LOADING_BAR } from "./shared.js";

export function loginPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Login — Learninator</title>
${HTMX_HEAD}
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #fdfcf9; color: #2d2d2d; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 2.5rem; width: 100%; max-width: 400px; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  .sub { color: #888; font-size: 0.9rem; margin-bottom: 1.5rem; }
  label { display: block; font-size: 0.85rem; font-weight: 500; margin-bottom: 0.25rem; margin-top: 1rem; }
  input { width: 100%; padding: 0.6rem 0.75rem; border: 1px solid #e8e4dc; border-radius: 6px; font-size: 1rem; margin-bottom: 0.5rem; }
  input:focus { outline: none; border-color: #b8a88a; }
  button { width: 100%; padding: 0.7rem; background: #2d2d2d; color: #fff; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; margin-top: 1rem; }
  button:hover { background: #444; }
  .error { background: #fce8e8; color: #8b2e2e; padding: 0.5rem 0.75rem; border-radius: 4px; font-size: 0.85rem; margin-bottom: 0.5rem; }
  .alt-link { text-align: center; margin-top: 1rem; font-size: 0.85rem; color: #888; }
  .alt-link a { color: #2d2d2d; }
</style>
</head>
<body>
${HTMX_LOADING_BAR}
<div class="card">
  <h1>Learninator</h1>
  <p class="sub">Sign in to continue learning</p>
  <form hx-post="/login" hx-target="this" hx-swap="outerHTML">
    <label for="email">Email</label>
    <input type="email" name="email" id="email" required>
    <label for="password">Password</label>
    <input type="password" name="password" id="password" required>
    <div id="error"></div>
    <button type="submit">Sign in</button>
  </form>
  <p class="alt-link">Don't have an account? <a href="/signup">Sign up</a></p>
</div>
</body>
</html>`;
}

export function signupPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sign Up — Learninator</title>
${HTMX_HEAD}
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #fdfcf9; color: #2d2d2d; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 2.5rem; width: 100%; max-width: 400px; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  .sub { color: #888; font-size: 0.9rem; margin-bottom: 1.5rem; }
  label { display: block; font-size: 0.85rem; font-weight: 500; margin-bottom: 0.25rem; margin-top: 1rem; }
  input { width: 100%; padding: 0.6rem 0.75rem; border: 1px solid #e8e4dc; border-radius: 6px; font-size: 1rem; margin-bottom: 0.5rem; }
  input:focus { outline: none; border-color: #b8a88a; }
  button { width: 100%; padding: 0.7rem; background: #2d2d2d; color: #fff; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; margin-top: 1rem; }
  button:hover { background: #444; }
  .error { background: #fce8e8; color: #8b2e2e; padding: 0.5rem 0.75rem; border-radius: 4px; font-size: 0.85rem; margin-bottom: 0.5rem; }
  .alt-link { text-align: center; margin-top: 1rem; font-size: 0.85rem; color: #888; }
  .alt-link a { color: #2d2d2d; }
</style>
</head>
<body>
${HTMX_LOADING_BAR}
<div class="card">
  <h1>Learninator</h1>
  <p class="sub">Create your account</p>
  <form hx-post="/signup" hx-target="this" hx-swap="outerHTML">
    <label for="email">Email</label>
    <input type="email" name="email" id="email" required>
    <label for="password">Password</label>
    <input type="password" name="password" id="password" required minlength="6">
    <label for="confirm">Confirm password</label>
    <input type="password" name="confirm" id="confirm" required minlength="6">
    <div id="error"></div>
    <button type="submit">Create account</button>
  </form>
  <p class="alt-link">Already have an account? <a href="/login">Sign in</a></p>
</div>
</body>
</html>`;
}

export function loginForm(email: string, error: string): string {
  return `<form hx-post="/login" hx-target="this" hx-swap="outerHTML">
      <label for="email">Email</label>
      <input type="email" name="email" id="email" value="${email}" required>
      <label for="password">Password</label>
      <input type="password" name="password" id="password" required>
      <div id="error" class="error">${error}</div>
      <button type="submit">Sign in</button>
    </form>`;
}

export function signupForm(email: string, error: string): string {
  return `<form hx-post="/signup" hx-target="this" hx-swap="outerHTML">
      <label for="email">Email</label>
      <input type="email" name="email" id="email" value="${email}" required>
      <label for="password">Password</label>
      <input type="password" name="password" id="password" required minlength="6">
      <label for="confirm">Confirm password</label>
      <input type="password" name="confirm" id="confirm" required minlength="6">
      <div id="error" class="error">${error}</div>
      <button type="submit">Create account</button>
    </form>`;
}

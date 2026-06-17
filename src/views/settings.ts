import type { User } from "../types.js";
import { layout } from "./home.js";

export function settingsPage(user: User): string {
  return layout(user, settingsContent(user));
}

export function settingsContent(user: User): string {
  return `<div class="settings-page fade-in-up">
  <h1>Settings</h1>

  <section class="settings-section">
    <h2>Profile</h2>
    <form
      hx-post="/settings/profile"
      hx-target="#profile-result"
      hx-swap="innerHTML"
    >
      <label for="name">Display name</label>
      <div class="inline-group">
        <input
          type="text" name="name" id="name"
          class="input"
          value="${(user.name || "").replace(/"/g, "&quot;")}"
          placeholder="Your name"
          autocomplete="name"
        />
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
      <div id="profile-result"></div>
    </form>
  </section>

  <section class="settings-section">
    <h2>Change Password</h2>
    <form
      hx-post="/settings/password"
      hx-target="#password-result"
      hx-swap="innerHTML"
    >
      <label for="current-password">Current password</label>
      <input
        type="password" name="current_password" id="current-password"
        class="input" required autocomplete="current-password"
      />
      <label for="new-password">New password</label>
      <input
        type="password" name="new_password" id="new-password"
        class="input" required minlength="6" autocomplete="new-password"
      />
      <label for="confirm-password">Confirm new password</label>
      <input
        type="password" name="confirm_password" id="confirm-password"
        class="input" required minlength="6" autocomplete="new-password"
      />
      <button type="submit" class="btn btn-primary">Change Password</button>
      <div id="password-result"></div>
    </form>
  </section>

  <style>
    .settings-page {
      max-width: 480px;
    }
    .settings-page h1 {
      font-size: 1.75rem; font-weight: 700; margin-bottom: 1.75rem;
      letter-spacing: -0.02em; font-family: var(--font-display);
    }
    .settings-section {
      background: var(--surface); border: 1px solid var(--rule);
      border-radius: var(--radius-lg); padding: 1.5rem;
      margin-bottom: 1rem;
      box-shadow: var(--shadow-sm);
    }
    .settings-section h2 {
      font-size: 0.85rem; font-weight: 600; margin-bottom: 1rem;
      color: var(--ink-secondary); text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .settings-section label {
      display: block; font-size: 0.82rem; font-weight: 500;
      margin-bottom: 0.3rem; margin-top: 0.75rem; color: var(--ink);
    }
    .settings-section label:first-of-type { margin-top: 0; }
    .settings-section .input {
      max-width: 100%;
    }
    .settings-section button[type="submit"] {
      margin-top: 1rem;
    }
    .settings-section .inline-group {
      display: flex; gap: 0.5rem; align-items: flex-end;
    }
    .settings-section .inline-group .input {
      flex: 1;
    }
    .settings-section .inline-group button {
      margin-top: 0; flex-shrink: 0;
    }
    .result-msg {
      font-size: 0.82rem; margin-top: 0.5rem; padding: 0.4rem 0.7rem;
      border-radius: var(--radius-sm); font-weight: 500;
    }
    .result-msg.success {
      background: var(--success-bg); color: var(--success);
      border: 1px solid var(--success-border);
    }
    .result-msg.error {
      background: var(--danger-bg); color: var(--danger);
      border: 1px solid var(--danger-border);
    }
  </style>
</div>`;
}

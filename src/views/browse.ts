export function browsePage(options: string[], path: string[]): string {
  return `<div class="browse-container fade-in-up">
  <div class="browse-header">
    <h2>🧭 Explore what to learn</h2>
    <p>Click through topics to discover something new. The AI will help narrow it down.</p>
  </div>
  ${breadcrumbHtml(path)}
  <div id="browse-options" class="browse-options stagger">
    ${optionGrid(options, path, 0)}
  </div>
  <div class="browse-footer">
    <p class="browse-hint">Not seeing what you want? <a href="/missions/new">Start with your own idea</a></p>
  </div>
</div>`;
}

export function browseOptionsFragment(options: string[], path: string[], iteration: number): string {
  return `<div class="browse-container fade-in-up">
  <div class="browse-header">
    <h2>🧭 Explore what to learn</h2>
    <p>Click through topics to discover something new. The AI will help narrow it down.</p>
  </div>
  ${breadcrumbHtml(path)}
  <div id="browse-options" class="browse-options stagger">
    ${optionGrid(options, path, iteration)}
  </div>
  <div class="browse-footer">
    <p class="browse-hint">Not seeing what you want? <a href="/missions/new">Start with your own idea</a></p>
  </div>
</div>`;
}

export function errorState(message: string): string {
  return `<div class="browse-container">
  <div class="browse-header">
    <h2>🧭 Explore what to learn</h2>
  </div>
  <div id="browse-options" class="browse-error fade-in-up">
    <p>${message}</p>
    <button class="btn btn-secondary" onclick="window.location.reload()">Try again</button>
  </div>
</div>`;
}

// ── Internal helpers ──

function breadcrumbHtml(path: string[]): string {
  if (path.length === 0) return "";
  return `<nav class="breadcrumbs fade-in-up">
    ${path.map((p, i) => `<span class="crumb">
      ${i < path.length - 1
        ? `<span class="crumb-link">${escapeHtml(p)}</span>`
        : `<span class="crumb-current">${escapeHtml(p)}</span>`}
      ${i < path.length - 1 ? `<span class="crumb-sep">›</span>` : ""}
    </span>`).join("")}
  </nav>`;
}

function optionGrid(options: string[], path: string[], iteration: number): string {
  const pathJson = JSON.stringify(path).replace(/'/g, "&#39;");
  return options.map((opt, i) => {
    const escaped = escapeHtml(opt);
    const escapedValue = opt.replace(/'/g, "&#39;");
    return `<form hx-post="/browse/select" hx-target=".browse-container" hx-swap="outerHTML" hx-indicator="#htmx-loading-bar" class="browse-card-form stagger-item" style="animation-delay:${i * 0.04}s">
      <input type="hidden" name="selection" value="${escapedValue}">
      <input type="hidden" name="path" value='${pathJson}'>
      <input type="hidden" name="iteration" value="${iteration}">
      <button type="submit" class="browse-card">
        <span class="browse-card-icon">${topicEmoji(opt)}</span>
        <span class="browse-card-label">${escaped}</span>
        <span class="browse-card-arrow">&rarr;</span>
      </button>
    </form>`;
  }).join("");
}

function topicEmoji(topic: string): string {
  const lower = topic.toLowerCase();
  if (lower.includes("science") || lower.includes("physic") || lower.includes("chem") || lower.includes("biolog") || lower.includes("astronomy")) return "🔬";
  if (lower.includes("code") || lower.includes("program") || lower.includes("tech") || lower.includes("software") || lower.includes("web") || lower.includes("app") || lower.includes("computer") || lower.includes("data") || lower.includes("ai") || lower.includes("machine learn")) return "💻";
  if (lower.includes("music") || lower.includes("guitar") || lower.includes("piano") || lower.includes("sing") || lower.includes("drum") || lower.includes("instrument")) return "🎵";
  if (lower.includes("art") || lower.includes("design") || lower.includes("draw") || lower.includes("paint") || lower.includes("illustrat") || lower.includes("photograph")) return "🎨";
  if (lower.includes("business") || lower.includes("startup") || lower.includes("finance") || lower.includes("market") || lower.includes("entrepreneur") || lower.includes("economic")) return "📈";
  if (lower.includes("health") || lower.includes("fitness") || lower.includes("meditation") || lower.includes("yoga") || lower.includes("nutrition") || lower.includes("exercise")) return "💪";
  if (lower.includes("language") || lower.includes("write") || lower.includes("read") || lower.includes("linguist")) return "📝";
  if (lower.includes("history") || lower.includes("philosophy") || lower.includes("politic")) return "📜";
  if (lower.includes("math") || lower.includes("statistic")) return "🔢";
  if (lower.includes("cook") || lower.includes("baking") || lower.includes("food") || lower.includes("culinary")) return "🍳";
  if (lower.includes("garden") || lower.includes("plant") || lower.includes("nature")) return "🌱";
  if (lower.includes("sport") || lower.includes("athlet") || lower.includes("run") || lower.includes("swim")) return "⚽";
  if (lower.includes("game") || lower.includes("chess")) return "🎮";
  if (lower.includes("craft") || lower.includes("wood") || lower.includes("diy") || lower.includes("build")) return "🔨";
  if (lower.includes("psycholog") || lower.includes("mental")) return "🧠";
  if (lower.includes("engineer") || lower.includes("electronic") || lower.includes("robot")) return "⚙️";
  return "📚";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const BROWSE_STYLES = `<style>
  /* ── Browse ── */
  .browse-container {
    max-width: 720px;
    margin: 0 auto;
  }
  .browse-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }
  .browse-header h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.3rem;
    letter-spacing: -0.02em;
  }
  .browse-header p {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  /* Breadcrumbs */
  .breadcrumbs {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
    font-size: 0.82rem;
    padding: 0.5rem 0.75rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  .crumb { display: inline-flex; align-items: center; gap: 0.25rem; }
  .crumb-link { color: var(--primary); text-decoration: none; }
  .crumb-link:hover { text-decoration: underline; }
  .crumb-current { color: var(--text); font-weight: 600; }
  .crumb-sep { color: var(--text-muted); font-size: 0.9em; }

  /* Option grid */
  .browse-options {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.65rem;
  }

  /* Card form */
  .browse-card-form { margin: 0; padding: 0; }

  /* Card button */
  .browse-card {
    width: 100%;
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 0.9rem 1.05rem;
    cursor: pointer;
    transition: all var(--transition-slow);
    box-shadow: var(--shadow-sm);
    display: flex;
    align-items: center;
    gap: 0.7rem;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    text-align: left;
  }
  .browse-card:hover {
    border-color: var(--primary);
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
    background: var(--primary-light);
  }
  .browse-card:active {
    transform: translateY(0);
  }

  .browse-card-icon {
    font-size: 1.2rem;
    width: 36px;
    height: 36px;
    border-radius: var(--radius);
    background: var(--primary-light);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .browse-card:hover .browse-card-icon {
    background: #eae6d9;
  }

  .browse-card-label {
    flex: 1;
    font-size: 0.88rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--text);
  }

  .browse-card-arrow {
    opacity: 0;
    transition: opacity var(--transition);
    color: var(--text-muted);
    flex-shrink: 0;
    font-size: 1.1rem;
  }
  .browse-card:hover .browse-card-arrow {
    opacity: 1;
  }

  /* Error */
  .browse-error {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--danger);
  }
  .browse-error .btn { margin-top: 1rem; }

  /* Footer */
  .browse-footer {
    text-align: center;
    margin-top: 2.5rem;
  }
  .browse-hint {
    font-size: 0.82rem;
    color: var(--text-muted);
  }
  .browse-hint a { color: var(--primary); text-decoration: underline; }
  .browse-hint a:hover { color: var(--primary-hover); }

  /* Responsive */
  @media (max-width: 640px) {
    .browse-options { grid-template-columns: 1fr; }
    .breadcrumbs { font-size: 0.75rem; }
  }
</style>`;

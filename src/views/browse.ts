export function browsePage(path: string[] = [], iteration: number = 0): string {
  return `<div class="browse-container fade-in-up">
  ${browseHeader(false, path, iteration)}
  ${breadcrumbHtml(path)}
  <div class="browse-options-area">
    ${skeletonOptions(6)}
  </div>
  <div class="browse-footer">
    <p class="browse-hint">Not seeing what you want? <a href="/missions/new">Start with your own idea</a></p>
  </div>
</div>`;
}

export function browseOptionsFragment(options: string[], path: string[], iteration: number, isLastQuestion = false): string {
  return `<div class="browse-container fade-in-up">
  ${browseHeader(isLastQuestion, path, iteration)}
  ${breadcrumbHtml(path)}
  ${isLastQuestion ? lastQuestionBanner() : ""}
  <div class="browse-options-area">
    <div id="browse-options" class="browse-options stagger fade-in-up">
      ${optionGrid(options, path, iteration, isLastQuestion)}
    </div>
  </div>
  <div class="browse-footer">
    <p class="browse-hint">Not seeing what you want? <a href="/missions/new">Start with your own idea</a></p>
  </div>
</div>`;
}

export function refreshOptionsFragment(options: string[], path: string[], iteration: number, isLastQuestion = false): string {
  return `<div id="browse-options" class="browse-options stagger fade-in-up">
    ${optionGrid(options, path, iteration, isLastQuestion)}
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

export function skeletonOptions(count: number): string {
  const cards = Array.from({length: count}, (_, i) =>
    `<div class="skeleton-card stagger-item" style="animation-delay:${i * 0.04}s">
      <span class="skeleton-icon skel-pulse"></span>
      <span class="skeleton-lines">
        <span class="skeleton-line skel-pulse"></span>
        <span class="skeleton-line skeleton-line-short skel-pulse"></span>
      </span>
    </div>`
  ).join("");
  return `<div id="browse-options" class="browse-options stagger" hx-get="/browse/options?path=%5B%5D&iteration=0" hx-trigger="load" hx-swap="outerHTML">
    ${cards}
  </div>`;
}

export function optionsOnly(options: string[], path: string[], iteration: number, isLastQuestion = false): string {
  return `<div id="browse-options" class="browse-options stagger fade-in-up">
    ${optionGrid(options, path, iteration, isLastQuestion)}
  </div>`;
}

// ── Internal helpers ──

function browseHeader(isLastQuestion: boolean, path: string[], iteration: number): string {
  const pathJson = JSON.stringify(path).replace(/'/g, "&#39;");
  return `<div class="browse-header">
    <div class="browse-header-row">
      <h2>🧭 Explore what to learn</h2>
      <form hx-post="/browse/refresh" hx-target="#browse-options" hx-swap="outerHTML" style="display:inline-flex" hx-indicator="#refresh-spinner">
        <input type="hidden" name="path" value='${pathJson}'>
        <input type="hidden" name="iteration" value="${iteration}">
        <button type="submit" class="refresh-btn" title="Refresh options">
          <span id="refresh-spinner" class="htmx-indicator" style="display:inline-flex"><span class="mini-spinner"></span></span>
          <span id="refresh-icon">${svgRefresh()}</span>
        </button>
      </form>
    </div>
    <p>${isLastQuestion ? "One more choice and we'll build your mission." : "Click through topics to discover something new. The AI will help narrow it down."}</p>
  </div>`;
}

function lastQuestionBanner(): string {
  return `<div class="last-question-banner fade-in-up">
    <span class="last-question-icon">🎯</span>
    <span>Final question — after this we'll create your learning mission</span>
  </div>`;
}

function svgRefresh(): string {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`;
}

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

function optionGrid(options: string[], path: string[], iteration: number, isLastQuestion: boolean): string {
  const pathJson = JSON.stringify(path).replace(/'/g, "&#39;");
  const cards = options.map((opt, i) => {
    const escaped = escapeHtml(opt);
    const escapedValue = opt.replace(/'/g, "&#39;");
    return `<form hx-post="/browse/select" hx-target=".browse-container" hx-swap="outerHTML" class="browse-card-form stagger-item" style="animation-delay:${i * 0.04}s">
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

  const customCard = `<div class="browse-card custom-card stagger-item" style="animation-delay:${options.length * 0.04}s" onclick="expandCustomInput(this)">
    <span class="browse-card-icon">✏️</span>
    <span class="custom-card-label">Something else…</span>
    <form hx-post="/browse/select" hx-target=".browse-container" hx-swap="outerHTML" class="custom-form" onsubmit="return this.querySelector('input').value.trim() !== ''">
      <input type="hidden" name="path" value='${pathJson}'>
      <input type="hidden" name="iteration" value="${iteration}">
      <input type="hidden" name="is_custom" value="true">
      <input type="text" name="selection" class="custom-input" placeholder="Type and press Enter…" autocomplete="off">
    </form>
  </div>`;

  return cards + customCard;
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
  .browse-header-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin-bottom: 0.3rem;
  }
  .browse-header h2 {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0;
  }
  .browse-header p {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  /* Refresh button */
  .refresh-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.4rem;
    cursor: pointer;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition);
  }
  .refresh-btn:hover {
    border-color: var(--border-hover);
    color: var(--text-secondary);
    background: var(--primary-light);
  }
  .mini-spinner {
    display: inline-block;
    width: 14px; height: 14px;
    border: 2px solid #ddd;
    border-top-color: #888;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  /* Options area */
  .browse-options-area {
    position: relative;
  }

  /* Skeleton cards */
  .skeleton-card {
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 0.9rem 1.05rem;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    box-shadow: var(--shadow-sm);
    height: 100%;
  }
  .skeleton-icon {
    width: 36px;
    height: 36px;
    border-radius: var(--radius);
    background: var(--border);
    flex-shrink: 0;
  }
  .skeleton-lines {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .skeleton-line {
    height: 0.65rem;
    border-radius: 4px;
    background: var(--border);
    width: 85%;
  }
  .skeleton-line-short { width: 55%; }
  @keyframes skelShimmer {
    0%   { opacity: 0.85; }
    50%  { opacity: 0.45; }
    100% { opacity: 0.85; }
  }
  .skel-pulse { animation: skelShimmer 1.1s ease-in-out infinite; }

  /* Last question banner */
  .last-question-banner {
    background: var(--warning-bg);
    border: 1px solid var(--warning);
    border-radius: var(--radius);
    padding: 0.7rem 1rem;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.85rem;
    color: var(--warning);
  }
  .last-question-icon { font-size: 1.1rem; }

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
    grid-auto-rows: 1fr;
    gap: 0.65rem;
    position: relative;
  }

  /* Card form */
  .browse-card-form { margin: 0; padding: 0; height: 100%; }

  /* Card button */
  .browse-card {
    width: 100%;
    height: 100%;
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 0.9rem 1.05rem;
    cursor: pointer;
    transition: all 120ms ease;
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
    transform: scale(0.97);
  }

  /* Clicked card dims instantly via htmx-request class */
  .browse-card-form.htmx-request .browse-card {
    opacity: 0.55;
    transform: scale(0.97);
    border-color: var(--primary);
    pointer-events: none;
    transition: all 60ms ease;
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

  /* ── "Something Else" card ── */
  .custom-card {
    border-style: dashed;
    border-color: var(--border-hover);
    cursor: pointer;
    transition: all 150ms ease;
    position: relative;
    overflow: visible;
  }
  .custom-card:hover {
    border-color: var(--primary);
    background: var(--primary-light);
  }
  .custom-card .browse-card-icon {
    background: #f0ece1;
  }
  .custom-card-label {
    flex: 1;
    font-size: 0.88rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--text-muted);
  }
  .custom-card.expanded {
    border-style: solid;
    border-color: var(--primary);
    background: var(--surface);
    box-shadow: var(--shadow-md);
  }
  .custom-card.expanded .custom-card-label {
    display: none;
  }

  .custom-form {
    display: none;
    flex: 1;
    margin: 0;
  }
  .custom-card.expanded .custom-form {
    display: block;
  }

  .custom-input {
    width: 100%;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text);
    outline: none;
    padding: 0;
    margin: 0;
    box-shadow: none;
    -webkit-appearance: none;
    border-radius: 0;
  }
  .custom-input:focus,
  .custom-input:focus-visible {
    outline: none !important;
    box-shadow: none !important;
    border: none;
  }
  .custom-input::placeholder {
    color: var(--text-muted);
    font-weight: 400;
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

  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 640px) {
    .browse-options { grid-template-columns: 1fr; }
    .breadcrumbs { font-size: 0.75rem; }
  }
</style>
<script>
(function() {
  // Skeleton HTML used for instant placeholder cards on drill-down
  var SKELETON_HTML = '<div class="skeleton-card"><span class="skeleton-icon skel-pulse"></span><span class="skeleton-lines"><span class="skeleton-line skel-pulse"></span><span class="skeleton-line skeleton-line-short skel-pulse"></span></span></div>';
  function skeletonGrid(count) {
    var cards = '';
    for (var i = 0; i < count; i++) cards += '<div class="stagger-item" style="animation-delay:' + (i * 0.04) + 's">' + SKELETON_HTML + '</div>';
    return '<div id="browse-options" class="browse-options stagger">' + cards + '</div>';
  }

  // Inject skeleton cards immediately when any browse form submits
  document.addEventListener('htmx:beforeRequest', function(evt) {
    var form = evt.target.closest('.browse-card-form, .custom-form');
    if (!form) return;
    var container = form.closest('.browse-container');
    if (!container) return;
    var optionsEl = container.querySelector('#browse-options');
    if (!optionsEl) return;
    optionsEl.outerHTML = skeletonGrid(6);
  });

  // Expand "Something Else" card inline
  window.expandCustomInput = function(el) {
    if (el.classList.contains('expanded')) return;
    el.classList.add('expanded');
    var input = el.querySelector('.custom-input');
    input.focus();
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && this.value.trim()) {
        e.preventDefault();
        this.closest('form').requestSubmit();
      }
    });
  };
})();
</script>`;

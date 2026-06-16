/** Browse topic exploration views */

const EMOJI_MAP: Record<string, string> = {
  music: "🎵", guitar: "🎸", piano: "🎹", drum: "🥁", singing: "🎤", song: "🎶",
  tech: "💻", program: "💻", code: "💻", software: "💻", computer: "🖥", web: "🌐", app: "📱",
  art: "🎨", design: "🎨", draw: "✏️", paint: "🖌", photo: "📷", video: "🎬",
  science: "🔬", math: "📐", physics: "⚛️", chemistry: "⚗️", biology: "🧬", engineer: "⚙️",
  language: "📚", write: "✍️", read: "📖", spanish: "🇪🇸", french: "🇫🇷", japanese: "🇯🇵", chinese: "🇨🇳",
  business: "💼", market: "📊", finance: "💰", entrepreneur: "🚀", start: "🚀",
  health: "🏃", fit: "💪", cook: "🍳", food: "🍳", nutrition: "🥗", yoga: "🧘", meditation: "🧘",
  history: "🏛", philosophy: "🤔", psychology: "🧠",
  game: "🎮", sport: "⚽", dance: "💃",
  data: "📊", ai: "🤖", machine: "🤖", crypto: "🔗", block: "🔗",
  nature: "🌿", garden: "🌱", wood: "🪵", craft: "🔧", diy: "🔨",
};

function emojiFor(option: string): string {
  const lower = option.toLowerCase();
  for (const [keyword, emoji] of Object.entries(EMOJI_MAP)) {
    if (lower.includes(keyword)) return emoji;
  }
  const code = option.charCodeAt(0);
  const emojis = ["📌", "🔖", "📎", "🔍", "💡", "✨", "🌟", "🎯", "📝", "🔑", "🎓", "📋"];
  return emojis[code % emojis.length];
}

export function browseOptionsHtml(options: string[], path: string[], iteration: number): string {
  const gridClass = options.length <= 4 ? "browse-grid browse-grid--few" : "browse-grid";

  const breadcrumb = path.length > 0
    ? `<div class="browse-breadcrumb">
         <a href="#" hx-get="/browse/options?iteration=0" hx-target="#browse-section" hx-swap="innerHTML">Topics</a>
         ${path.map((p, i) => {
           const upTo = path.slice(0, i + 1).join(",");
           const isLast = i === path.length - 1;
           return isLast
             ? `<span> › ${p}</span>`
             : `<a href="#" hx-get="/browse/options?path=${encodeURIComponent(upTo)}&iteration=${i + 1}" hx-target="#browse-section" hx-swap="innerHTML"> › ${p}</a>`;
         }).join("")}
       </div>`
    : `<div class="browse-breadcrumb"><span>Popular topics</span></div>`;

  const params = (opt: string) =>
    `selection=${encodeURIComponent(opt)}&path=${encodeURIComponent(path.join(","))}&iteration=${iteration}`;

  const cards = options.map((opt) => `
    <button type="button" class="browse-card"
            hx-get="/browse/select?${params(opt)}"
            hx-target="#browse-section"
            hx-swap="innerHTML">
      <span class="browse-card-emoji">${emojiFor(opt)}</span>
      <span class="browse-card-text">${opt}</span>
    </button>
  `).join("");

  const customCard = `
    <button type="button" class="browse-card browse-card--custom"
            hx-get="/browse/select?selection=__custom__&path=${encodeURIComponent(path.join(","))}&iteration=${iteration}"
            hx-target="#browse-section"
            hx-swap="innerHTML">
      <span class="browse-card-emoji">✨</span>
      <span class="browse-card-text">Something else...</span>
    </button>`;

  return `${breadcrumb}
    <div class="${gridClass}">
      ${cards}
      ${customCard}
    </div>
    ${path.length > 0 ? `
    <div class="browse-refresh">
      <button class="btn btn-ghost btn-sm"
              hx-get="/browse/options?path=${encodeURIComponent(path.join(","))}&iteration=${iteration}"
              hx-target="#browse-section"
              hx-swap="innerHTML">
        🔄 Different options
      </button>
    </div>` : ""}`;
}

export function browseCustomInputHtml(path: string[], iteration: number): string {
  const baseUrl = `/browse/select?path=${encodeURIComponent(path.join(","))}&iteration=${iteration}`;
  return `<div class="browse-breadcrumb">
      ${path.length > 0 ? path.map(p => `<span> › ${p}</span>`).join("") : ""}
    </div>
    <div class="browse-custom-form">
      <div class="textarea-wrapper" style="flex:1;">
        <textarea name="custom-topic" id="browse-custom-topic" placeholder="What specifically do you want to learn?" rows="2" autofocus oninput="autoResize(this)"></textarea>
        <span class="textarea-hint">Shift + Enter for newline</span>
      </div>
      <button class="btn btn-primary"
              hx-get="${baseUrl}"
              hx-target="#browse-section"
              hx-swap="innerHTML"
              hx-include="#browse-custom-topic">
        Go
      </button>
    </div>`;
}

function browseSkeletonHtml(): string {
  const cards = Array.from({ length: 8 }, () =>
    `<div class="browse-card browse-card--skeleton"><span class="skeleton-line"></span></div>`
  ).join("");
  return `<div class="browse-breadcrumb"><span class="skeleton-line skeleton-line--short"></span></div>
    <div class="browse-grid">
      ${cards}
    </div>`;
}

export function browseSectionHtml(): string {
  return `<div class="browse-divider">
    <span>Or browse topics</span>
  </div>
  <div id="browse-section"
       hx-get="/browse/options?iteration=0"
       hx-trigger="load"
       hx-swap="innerHTML">
    ${browseSkeletonHtml()}
  </div>`;
}

export const BROWSE_CSS = `
/* ── Browse Section ── */
.browse-divider {
  display: flex; align-items: center; gap: 1rem;
  margin: 2rem 0 1rem;
  color: var(--text-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 500;
}
.browse-divider::before, .browse-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.browse-breadcrumb {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
}
.browse-breadcrumb a {
  color: var(--text-secondary);
  text-decoration: none;
}
.browse-breadcrumb a:hover {
  color: var(--primary);
}

.browse-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.6rem;
}
.browse-grid--few {
  grid-template-columns: repeat(3, 1fr);
}
@media (max-width: 640px) {
  .browse-grid { grid-template-columns: repeat(2, 1fr); }
  .browse-grid--few { grid-template-columns: repeat(2, 1fr); }
}

.browse-card {
  display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
  padding: 1rem 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
  font-size: 0.85rem;
  color: var(--text);
  text-align: center;
  width: 100%;
}
.browse-card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
.browse-card:active {
  transform: scale(0.97);
}
.browse-card--custom {
  border-style: dashed;
  background: var(--bg);
}
.browse-card-emoji {
  font-size: 1.4rem;
}
.browse-card-text {
  line-height: 1.3;
}

.browse-card--skeleton {
  cursor: default;
  pointer-events: none;
  min-height: 70px;
}

.browse-refresh {
  margin-top: 0.75rem;
  text-align: center;
}

.browse-custom-form {
  display: flex; gap: 0.5rem; align-items: flex-end;
}

/* ── Skeleton loading ── */
.skeleton-line {
  display: block;
  height: 14px;
  background: linear-gradient(90deg, var(--border) 25%, var(--border-hover) 50%, var(--border) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
  width: 100%;
}
.skeleton-line--short {
  width: 40%;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;

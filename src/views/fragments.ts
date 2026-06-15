/** HTMX fragments used in route handler responses */

// ── Chat ──

export function chatMessageBubble(role: "user" | "assistant", content: string): string {
  if (role === "user") {
    return `<div class="msg user">${content}</div>`;
  }
  return `<div class="msg assistant markdown-body" style="background:#fff;border:1px solid #e8e4dc;">${content}</div>`;
}

// ── Lesson feedback ──

export function feedbackBar(missionId: number, number: number): string {
  return `<div class="feedback-bar" id="feedback-bar">
    <span class="label">How was this lesson?</span>
    <button hx-post="/missions/${missionId}/lessons/${number}/feedback" hx-target="#feedback-bar" hx-swap="outerHTML" hx-vals='{"rating":"too_easy"}'>Too easy</button>
    <button hx-post="/missions/${missionId}/lessons/${number}/feedback" hx-target="#feedback-bar" hx-swap="outerHTML" hx-vals='{"rating":"just_right"}'>Just right</button>
    <button hx-post="/missions/${missionId}/lessons/${number}/feedback" hx-target="#feedback-bar" hx-swap="outerHTML" hx-vals='{"rating":"too_hard"}'>Too hard</button>
    <form hx-post="/missions/${missionId}/lessons/${number}/complete" hx-target="#feedback-bar" hx-swap="outerHTML" style="margin-left:auto;">
      <button type="submit" class="done-btn">Mark Complete</button>
    </form>
  </div>`;
}

export function feedbackThanksBar(rating: string, missionId: number, number: number): string {
  return `<div class="feedback-bar" id="feedback-bar">
    <span class="label">Thanks! You rated this: <strong>${rating.replace("_", " ")}</strong></span>
    <form hx-post="/missions/${missionId}/lessons/${number}/complete" hx-target="#feedback-bar" hx-swap="outerHTML" style="margin-left:auto;">
      <button type="submit" class="done-btn">Mark Complete</button>
    </form>
  </div>`;
}

export function completeBar(alreadyCompleted: boolean, missionId: number, number: number): string {
  return `<div class="feedback-bar" id="feedback-bar" style="flex-direction:column;align-items:stretch;gap:0.75rem;">
    <span class="label">${alreadyCompleted ? "Lesson already completed." : "Lesson completed!"}</span>
    <div style="display:flex;flex-direction:column;gap:0.5rem;">
      <label style="font-size:0.85rem;color:#555;">Notes for the next lesson <span style="color:#aaa;">(optional)</span></label>
      <textarea name="notes" placeholder="What should the next lesson cover? Anything to change? e.g. &quot;More hands-on examples&quot; or &quot;Go deeper into X&quot;" rows="3" style="padding:0.7rem;border:1px solid #e8e4dc;border-radius:8px;font-size:0.9rem;font-family:inherit;resize:vertical;width:100%;"></textarea>
    </div>
    <div style="display:flex;gap:0.5rem;align-items:center;">
      <button hx-post="/missions/${missionId}/lessons/${number}/generate-next" hx-target="#feedback-bar" hx-swap="outerHTML" hx-include="[name='notes']" style="padding:0.5rem 1.25rem;background:#2d2d2d;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:0.85rem;">
        <span class="htmx-indicator-inline">Generating<span style="display:inline-block;width:10px;height:10px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite;margin-left:0.3rem;"></span></span>
        <span class="btn-label">Create Next Lesson</span>
      </button>
      <a href="/missions/${missionId}" style="font-size:0.85rem;color:#888;text-decoration:none;">Done</a>
    </div>
  </div>`;
}

// ── Lesson generation ──

export function generationPollingBar(missionId: number, number: number): string {
  return `<div class="feedback-bar" id="feedback-bar" style="flex-direction:column;align-items:stretch;gap:0.5rem;"
       hx-get="/missions/${missionId}/lessons/${number}/generate-next/status"
       hx-trigger="every 1s"
       hx-swap="outerHTML"
       hx-target="#feedback-bar">
    <span class="label">Generating your next lesson…</span>
    <div style="font-size:0.85rem;color:#888;">
      <span class="thinking-dots"><span></span><span></span><span></span></span>
      Starting…
    </div>
  </div>`;
}

export function generationRunningBar(missionId: number, number: number, latestMsg: string): string {
  return `<div class="feedback-bar" id="feedback-bar" style="flex-direction:column;align-items:stretch;gap:0.5rem;"
       hx-get="/missions/${missionId}/lessons/${number}/generate-next/status"
       hx-trigger="every 1s"
       hx-swap="outerHTML"
       hx-target="#feedback-bar">
    <span class="label">Generating your next lesson…</span>
    <div style="font-size:0.85rem;color:#888;">
      <span class="thinking-dots"><span></span><span></span><span></span></span>
      ${latestMsg}
    </div>
  </div>`;
}

export function generationDoneBar(missionId: number, number: number, lessonTitle: string): string {
  return `<div class="feedback-bar" id="feedback-bar">
    <span class="label">Lesson created! <a href="/missions/${missionId}/lessons/${number}" style="color:#2d2d2d;font-weight:500;">Start Lesson ${String(number).padStart(4, "0")}: ${lessonTitle} &rarr;</a></span>
  </div>`;
}

export function generationErrorBar(missionId: number, error: string): string {
  return `<div class="feedback-bar" id="feedback-bar">
    <span class="label" style="color:#8b2e2e;">Failed to generate next lesson: ${error}</span>
    <a href="/missions/${missionId}" style="font-size:0.85rem;color:#2d2d2d;">Back to lessons &rarr;</a>
  </div>`;
}

export function generationMissingBar(missionId: number): string {
  return `<div class="feedback-bar" id="feedback-bar"><span class="label">Something went wrong. <a href="/missions/${missionId}" style="color:#2d2d2d;">Back to lessons &rarr;</a></span></div>`;
}

// ── Empty states ──

export function emptyLessonsMessage(missionId: number): string {
  return `<div class="empty">
    <p>No lessons yet. Your AI teacher will create them as you go.</p>
    <p style="margin-top:0.5rem;font-size:0.85rem;">Go to the <a href="/missions/${missionId}/chat" style="color:#2d2d2d;">chat</a> to ask for your first lesson.</p>
  </div>`;
}

export function emptyReferencesMessage(): string {
  return `<div class="empty"><p>No reference documents yet. Your AI teacher will create cheat sheets and other references alongside lessons.</p></div>`;
}

export function emptyRecordsMessage(): string {
  return `<div class="empty"><p>No learning records yet. These are created as you demonstrate understanding.</p></div>`;
}

// ── Cards ──

export function lessonCard(missionId: number, lesson: { number: number; title: string; status: string }): string {
  const statusLabel = lesson.status === "completed" ? "Completed" : lesson.status === "in_progress" ? "In Progress" : "";
  const statusClass = lesson.status === "completed" ? "status-completed" : lesson.status === "in_progress" ? "status-in-progress" : "status-active";
  return `
    <a href="/missions/${missionId}/lessons/${lesson.number}" class="lesson-card">
      <div class="info">
        <span class="num">${String(lesson.number).padStart(4, "0")}</span>
        <h3>${lesson.title}</h3>
      </div>
      ${statusLabel ? `<span class="status ${statusClass}">${statusLabel}</span>` : ""}
    </a>
  `;
}

export function referenceDocCard(missionId: number, ref: { id: number; title: string; docType: string }): string {
  return `
    <div class="ref-card">
      <span class="type">${ref.docType}</span>
      <h3>${ref.title}</h3>
      <a href="/missions/${missionId}/reference/${ref.id}" style="font-size:0.85rem;color:#2d2d2d;">View &rarr;</a>
    </div>
  `;
}

export function learningRecordCard(record: { number: number; title: string; markdownContent: string; status: string; supersededBy: number | null }): string {
  return `
    <div class="record-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">
        <span class="meta">LR${String(record.number).padStart(4, "0")}</span>
        ${record.status === "superseded" ? `<span class="superseded">Superseded by LR${String(record.supersededBy || 0).padStart(4, "0")}</span>` : ""}
      </div>
      <h3>${record.title}</h3>
      <div class="content markdown-body">${record.markdownContent}</div>
    </div>
  `;
}

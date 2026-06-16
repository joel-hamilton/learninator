/** HTMX fragments used in route handler responses */

// ── Helpers ──

function lessonIdStr(number: number, subNumber: number | null): string {
  return subNumber !== null ? `${number}.${subNumber}` : `${number}`;
}

function formatLessonNumber(num: number, sub: number | null): string {
  const base = String(num).padStart(4, "0");
  return sub !== null ? `${base}.${sub}` : base;
}

// ── Chat ──

export function chatMessageBubble(role: "user" | "assistant", content: string, userInitial?: string): string {
  const avatar = role === "user" ? (userInitial || "Y") : "AI";
  if (role === "user") {
    return `<div class="msg-row user"><div class="msg-avatar">${avatar}</div><div class="msg">${content}</div></div>`;
  }
  return `<div class="msg-row assistant"><div class="msg-avatar">${avatar}</div><div class="msg markdown-body">${content}</div></div>`;
}

// ── Lesson action bars ──

export function lessonActionBar(missionId: number, number: number, subNumber: number | null): string {
  const lid = lessonIdStr(number, subNumber);
  return `<div class="feedback-bar" id="feedback-bar">
    <button class="btn btn-ghost btn-sm"
      hx-post="/missions/${missionId}/lessons/${lid}/complete"
      hx-target="#feedback-bar" hx-swap="outerHTML">Mark Complete</button>
    <span style="flex:1"></span>
    <button class="btn btn-secondary btn-sm"
      hx-post="/missions/${missionId}/lessons/${lid}/generate-next"
      hx-target="#feedback-bar" hx-swap="outerHTML">New Lesson</button>
    <button class="btn btn-secondary btn-sm"
      hx-post="/missions/${missionId}/lessons/${lid}/generate-sub-lesson"
      hx-target="#feedback-bar" hx-swap="outerHTML">More on This</button>
  </div>`;
}

export function completedLessonBar(missionId: number, number: number, subNumber: number | null): string {
  const lid = lessonIdStr(number, subNumber);
  return `<div class="feedback-bar" id="feedback-bar">
    <span class="badge badge-completed">Completed</span>
    <button class="btn btn-ghost btn-sm"
      hx-post="/missions/${missionId}/lessons/${lid}/incomplete"
      hx-target="#feedback-bar" hx-swap="outerHTML">Mark Incomplete</button>
    <span style="flex:1"></span>
    <button class="btn btn-secondary btn-sm"
      hx-post="/missions/${missionId}/lessons/${lid}/generate-next"
      hx-target="#feedback-bar" hx-swap="outerHTML">New Lesson</button>
    <button class="btn btn-secondary btn-sm"
      hx-post="/missions/${missionId}/lessons/${lid}/generate-sub-lesson"
      hx-target="#feedback-bar" hx-swap="outerHTML">More on This</button>
  </div>`;
}

// ── Lesson generation ──

export function generationPollingBar(missionId: number, number: number, subNumber: number | null, isSub: boolean = false): string {
  const lid = lessonIdStr(number, subNumber);
  const suffix = isSub ? "generate-sub-lesson" : "generate-next";
  const label = isSub ? "Creating sub-lesson…" : "Creating your next lesson…";
  return `<div class="feedback-bar" id="feedback-bar" style="flex-direction:column;align-items:stretch;gap:0.5rem;"
       hx-get="/missions/${missionId}/lessons/${lid}/${suffix}/status"
       hx-trigger="every 1s"
       hx-swap="outerHTML"
       hx-target="#feedback-bar">
    <span class="label"><span class="badge badge-in-progress" style="margin-right:0.5rem;">Generating</span> ${label}</span>
    <div style="font-size:0.85rem;color:var(--text-muted);display:flex;align-items:center;gap:0.5rem;">
      <span class="thinking-dots"><span></span><span></span><span></span></span>
      Starting…
    </div>
  </div>`;
}

export function generationRunningBar(missionId: number, number: number, subNumber: number | null, isSub: boolean, latestMsg: string): string {
  const lid = lessonIdStr(number, subNumber);
  const suffix = isSub ? "generate-sub-lesson" : "generate-next";
  const label = isSub ? "Creating sub-lesson…" : "Creating your next lesson…";
  return `<div class="feedback-bar" id="feedback-bar" style="flex-direction:column;align-items:stretch;gap:0.5rem;"
       hx-get="/missions/${missionId}/lessons/${lid}/${suffix}/status"
       hx-trigger="every 1s"
       hx-swap="outerHTML"
       hx-target="#feedback-bar">
    <span class="label"><span class="badge badge-in-progress" style="margin-right:0.5rem;">Generating</span> ${label}</span>
    <div style="font-size:0.85rem;color:var(--text-muted);display:flex;align-items:center;gap:0.5rem;">
      <span class="thinking-dots"><span></span><span></span><span></span></span>
      ${latestMsg}
    </div>
  </div>`;
}

export function generationDoneBar(missionId: number, number: number, subNumber: number | null, lessonTitle: string): string {
  const lid = lessonIdStr(number, subNumber);
  const displayNum = formatLessonNumber(number, subNumber);
  return `<div class="feedback-bar" id="feedback-bar">
    <span class="label"><span class="badge badge-ready" style="margin-right:0.5rem;">Ready</span> Lesson created! <a href="/missions/${missionId}/lessons/${lid}" style="color:var(--accent);font-weight:500;">Start Lesson ${displayNum}: ${lessonTitle} &rarr;</a></span>
  </div>`;
}

export function generationErrorBar(missionId: number, error: string): string {
  return `<div class="feedback-bar" id="feedback-bar">
    <span class="label"><span class="badge badge-error" style="margin-right:0.5rem;">Error</span> Failed to generate next lesson: ${error}</span>
    <a href="/missions/${missionId}" class="btn btn-ghost btn-sm">Back to lessons &rarr;</a>
  </div>`;
}

export function generationMissingBar(missionId: number): string {
  return `<div class="feedback-bar" id="feedback-bar"><span class="label">Something went wrong. <a href="/missions/${missionId}" style="color:var(--primary);">Back to lessons &rarr;</a></span></div>`;
}

// ── Empty states ──

export function emptyLessonsMessage(missionId: number): string {
  return `<div class="empty">
    <p>No lessons yet. Your AI teacher will create them as you go.</p>
    <p style="margin-top:0.5rem;font-size:0.85rem;">Go to the <a href="/missions/${missionId}/chat">chat</a> to ask for your first lesson.</p>
  </div>`;
}

export function emptyReferencesMessage(): string {
  return `<div class="empty"><p>No reference documents yet. Your AI teacher will create cheat sheets and other references alongside lessons.</p></div>`;
}

export function emptyRecordsMessage(): string {
  return `<div class="empty"><p>No learning records yet. These are created as you demonstrate understanding.</p></div>`;
}

// ── Cards ──

export function lessonCard(missionId: number, lesson: { number: number; subNumber: number | null; title: string; status: string }, opts?: { hasSubLessons?: boolean; isLastSub?: boolean }): string {
  const isSub = lesson.subNumber !== null;
  const displayNum = formatLessonNumber(lesson.number, lesson.subNumber);
  const lid = lessonIdStr(lesson.number, lesson.subNumber);
  const statusLabel = lesson.status === "completed" ? "Completed" : lesson.status === "in_progress" ? "In Progress" : "";
  const badgeClass = lesson.status === "completed" ? "badge-completed" : lesson.status === "in_progress" ? "badge-in-progress" : "badge-active";
  const extraClass = [
    isSub ? "lesson-card--sub" : "",
    opts?.hasSubLessons ? "lesson-card--has-subs" : "",
    opts?.isLastSub ? "lesson-card--last-sub" : "",
  ].filter(Boolean).join(" ");
  return `
    <a href="/missions/${missionId}/lessons/${lid}" class="lesson-card ${extraClass}">
      <div class="info">
        <span class="num">${displayNum}</span>
        <h3>${lesson.title}</h3>
      </div>
      ${statusLabel ? `<span class="badge ${badgeClass}">${statusLabel}</span>` : ""}
    </a>
  `;
}

export function referenceDocCard(missionId: number, ref: { id: number; title: string; docType: string }): string {
  return `
    <a href="/missions/${missionId}/reference/${ref.id}" class="ref-card">
      <span class="type">${ref.docType}</span>
      <h3>${ref.title}</h3>
    </a>
  `;
}

export function learningRecordCard(record: { number: number; title: string; markdownContent: string; status: string; supersededBy: number | null }): string {
  return `
    <div class="record-card">
      <div class="record-header">
        <span class="meta">LR${String(record.number).padStart(4, "0")}</span>
        ${record.status === "superseded" ? `<span class="badge badge-superseded">Superseded by LR${String(record.supersededBy || 0).padStart(4, "0")}</span>` : ""}
      </div>
      <h3>${record.title}</h3>
      <div class="content markdown-body">${record.markdownContent}</div>
    </div>
  `;
}

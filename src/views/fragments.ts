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
    <button class="fb-btn" hx-post="/missions/${missionId}/lessons/${lid}/feedback"
      hx-target="#feedback-bar" hx-swap="outerHTML"
      hx-vals='{"rating":"too_easy"}'>😴 Too Easy</button>
    <button class="fb-btn" hx-post="/missions/${missionId}/lessons/${lid}/feedback"
      hx-target="#feedback-bar" hx-swap="outerHTML"
      hx-vals='{"rating":"just_right"}'>👍 Just Right</button>
    <button class="fb-btn" hx-post="/missions/${missionId}/lessons/${lid}/feedback"
      hx-target="#feedback-bar" hx-swap="outerHTML"
      hx-vals='{"rating":"too_hard"}'>🤯 Too Hard</button>
    <span style="flex:1"></span>
    <button class="btn btn-ghost btn-sm"
      hx-post="/missions/${missionId}/lessons/${lid}/complete"
      hx-target="#feedback-bar" hx-swap="outerHTML">Mark Complete</button>
    <button class="btn btn-secondary btn-sm"
      hx-post="/missions/${missionId}/lessons/${lid}/generate-next"
      hx-target="#feedback-bar" hx-swap="outerHTML">New Lesson</button>
    <button class="btn btn-secondary btn-sm"
      hx-post="/missions/${missionId}/lessons/${lid}/generate-sub-lesson"
      hx-target="#feedback-bar" hx-swap="outerHTML">More on This</button>
  </div>`;
}

export function feedbackThanksBar(rating: string, missionId: number, number: number, subNumber: number | null): string {
  const lid = lessonIdStr(number, subNumber);
  const ratingLabel = rating.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  let extraButtons = "";
  if (rating === "too_easy") {
    extraButtons = `<button class="btn btn-secondary btn-sm"
      hx-post="/missions/${missionId}/lessons/${lid}/regenerate"
      hx-target="#feedback-bar" hx-swap="outerHTML"
      hx-vals='{"direction":"harder"}'>Make Harder</button>`;
  } else if (rating === "too_hard") {
    extraButtons = `<button class="btn btn-secondary btn-sm"
      hx-post="/missions/${missionId}/lessons/${lid}/regenerate"
      hx-target="#feedback-bar" hx-swap="outerHTML"
      hx-vals='{"direction":"easier"}'>Make Easier</button>
    <button class="btn btn-secondary btn-sm"
      hx-post="/missions/${missionId}/lessons/${lid}/generate-bridging"
      hx-target="#feedback-bar" hx-swap="outerHTML">Bridge First</button>`;
  }

  return `<div class="feedback-bar" id="feedback-bar">
    <span class="label">Thanks! You rated this: <strong>${ratingLabel}</strong></span>
    ${extraButtons}
    <span style="flex:1"></span>
    <button class="done-btn"
      hx-post="/missions/${missionId}/lessons/${lid}/complete"
      hx-target="#feedback-bar" hx-swap="outerHTML">Mark Complete</button>
  </div>`;
}

export function completeBar(alreadyCompleted: boolean, missionId: number, number: number, subNumber: number | null): string {
  const lid = lessonIdStr(number, subNumber);
  return `<div class="feedback-bar" id="feedback-bar" style="flex-direction:column;align-items:stretch;gap:0.75rem;">
    <span class="label">
      ${alreadyCompleted
        ? '<span class="badge badge-info">Already completed</span>'
        : '<span class="badge badge-completed">Completed</span>'}
      <span style="margin-left:0.5rem;font-weight:400;">${alreadyCompleted ? "Lesson already completed." : "Lesson completed!"}</span>
    </span>
    <div style="display:flex;gap:0.5rem;align-items:center;">
      <button hx-get="/missions/${missionId}/lessons/${lid}/feedback-modal?mode=next" hx-target="#modal-container" hx-swap="innerHTML" class="btn btn-primary btn-sm">
        Create Next Lesson
      </button>
      <a href="/missions/${missionId}" class="btn btn-ghost btn-sm">Done</a>
    </div>
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
  return `<div class="feedback-bar generation-bar" id="feedback-bar" style="flex-direction:column;align-items:stretch;gap:0.5rem;background:var(--warning-bg);border-color:var(--warning);"
       hx-get="/missions/${missionId}/lessons/${lid}/${suffix}/status"
       hx-trigger="every 1s"
       hx-swap="outerHTML"
       hx-target="#feedback-bar">
    <span class="label" style="color:var(--warning);"><span class="badge badge-in-progress" style="margin-right:0.5rem;">Generating</span> ${label}</span>
    <div style="font-size:0.85rem;color:var(--warning);display:flex;align-items:center;gap:0.5rem;">
      <span class="thinking-dots"><span></span><span></span><span></span></span>
      Starting…
    </div>
  </div>`;
}

export function generationRunningBar(missionId: number, number: number, subNumber: number | null, isSub: boolean, latestMsg: string): string {
  const lid = lessonIdStr(number, subNumber);
  const suffix = isSub ? "generate-sub-lesson" : "generate-next";
  const label = isSub ? "Creating sub-lesson…" : "Creating your next lesson…";
  return `<div class="feedback-bar generation-bar" id="feedback-bar" style="flex-direction:column;align-items:stretch;gap:0.5rem;background:var(--warning-bg);border-color:var(--warning);"
       hx-get="/missions/${missionId}/lessons/${lid}/${suffix}/status"
       hx-trigger="every 1s"
       hx-swap="outerHTML"
       hx-target="#feedback-bar">
    <span class="label" style="color:var(--warning);"><span class="badge badge-in-progress" style="margin-right:0.5rem;">Generating</span> ${label}</span>
    <div style="font-size:0.85rem;color:var(--warning);display:flex;align-items:center;gap:0.5rem;">
      <span class="thinking-dots"><span></span><span></span><span></span></span>
      ${latestMsg}
    </div>
  </div>`;
}

function hideBannerOnSettle(): string {
  return "";
}

export function generationDoneBar(missionId: number, number: number, subNumber: number | null, lessonTitle: string): string {
  const lid = lessonIdStr(number, subNumber);
  const displayNum = formatLessonNumber(number, subNumber);
  return `<div class="feedback-bar" id="feedback-bar"${hideBannerOnSettle()}>
    <span class="label"><span class="badge badge-ready" style="margin-right:0.5rem;">Ready</span> Lesson created! <a href="/missions/${missionId}/lessons/${lid}" style="color:var(--rubric);font-weight:500;">Start Lesson ${displayNum}: ${lessonTitle} &rarr;</a></span>
  </div>`;
}

export function generationErrorBar(missionId: number, error: string): string {
  return `<div class="feedback-bar" id="feedback-bar"${hideBannerOnSettle()}>
    <span class="label"><span class="badge badge-error" style="margin-right:0.5rem;">Error</span> Failed to generate next lesson: ${error}</span>
    <a href="/missions/${missionId}" class="btn btn-ghost btn-sm">Back to lessons &rarr;</a>
  </div>`;
}

export function generationMissingBar(missionId: number): string {
  return `<div class="feedback-bar" id="feedback-bar"${hideBannerOnSettle()}><span class="label">Something went wrong. <a href="/missions/${missionId}" style="color:var(--ink);">Back to lessons &rarr;</a></span></div>`;
}

// ── Lesson regeneration ──

export function regenerationPollingBar(missionId: number, number: number, subNumber: number | null): string {
  const lid = lessonIdStr(number, subNumber);
  return `<div class="feedback-bar generation-bar" id="feedback-bar" style="flex-direction:column;align-items:stretch;gap:0.5rem;background:var(--warning-bg);border-color:var(--warning);"
       hx-get="/missions/${missionId}/lessons/${lid}/regenerate/status"
       hx-trigger="every 1s"
       hx-swap="outerHTML"
       hx-target="#feedback-bar">
    <span class="label" style="color:var(--warning);"><span class="badge badge-in-progress" style="margin-right:0.5rem;">Regenerating</span> Rewriting lesson at new difficulty…</span>
    <div style="font-size:0.85rem;color:var(--warning);display:flex;align-items:center;gap:0.5rem;">
      <span class="thinking-dots"><span></span><span></span><span></span></span>
      Starting…
    </div>
  </div>`;
}

export function regenerationRunningBar(missionId: number, number: number, subNumber: number | null, latestMsg: string): string {
  const lid = lessonIdStr(number, subNumber);
  return `<div class="feedback-bar generation-bar" id="feedback-bar" style="flex-direction:column;align-items:stretch;gap:0.5rem;background:var(--warning-bg);border-color:var(--warning);"
       hx-get="/missions/${missionId}/lessons/${lid}/regenerate/status"
       hx-trigger="every 1s"
       hx-swap="outerHTML"
       hx-target="#feedback-bar">
    <span class="label" style="color:var(--warning);"><span class="badge badge-in-progress" style="margin-right:0.5rem;">Regenerating</span> Rewriting lesson at new difficulty…</span>
    <div style="font-size:0.85rem;color:var(--warning);display:flex;align-items:center;gap:0.5rem;">
      <span class="thinking-dots"><span></span><span></span><span></span></span>
      ${latestMsg}
    </div>
  </div>`;
}

export function regenerationDoneBar(missionId: number, number: number, subNumber: number | null, lessonTitle: string): string {
  const lid = lessonIdStr(number, subNumber);
  const displayNum = formatLessonNumber(number, subNumber);
  return `<div class="feedback-bar" id="feedback-bar"${hideBannerOnSettle()}>
    <span class="label"><span class="badge badge-ready" style="margin-right:0.5rem;">Updated</span> Lesson regenerated! <a href="/missions/${missionId}/lessons/${lid}" style="color:var(--accent);font-weight:500;">View Lesson ${displayNum}: ${lessonTitle} &rarr;</a></span>
  </div>`;
}

export function regenerationErrorBar(missionId: number, error: string): string {
  return `<div class="feedback-bar" id="feedback-bar"${hideBannerOnSettle()}>
    <span class="label"><span class="badge badge-error" style="margin-right:0.5rem;">Error</span> Failed to regenerate lesson: ${error}</span>
    <a href="/missions/${missionId}" class="btn btn-ghost btn-sm">Back to lessons &rarr;</a>
  </div>`;
}

// ── Bridging lesson generation ──

export function bridgingPollingBar(missionId: number, number: number, subNumber: number | null): string {
  const lid = lessonIdStr(number, subNumber);
  return `<div class="feedback-bar generation-bar" id="feedback-bar" style="flex-direction:column;align-items:stretch;gap:0.5rem;background:var(--warning-bg);border-color:var(--warning);"
       hx-get="/missions/${missionId}/lessons/${lid}/generate-bridging/status"
       hx-trigger="every 1s"
       hx-swap="outerHTML"
       hx-target="#feedback-bar">
    <span class="label" style="color:var(--warning);"><span class="badge badge-in-progress" style="margin-right:0.5rem;">Generating</span> Creating bridging lesson…</span>
    <div style="font-size:0.85rem;color:var(--warning);display:flex;align-items:center;gap:0.5rem;">
      <span class="thinking-dots"><span></span><span></span><span></span></span>
      Starting…
    </div>
  </div>`;
}

export function bridgingRunningBar(missionId: number, number: number, subNumber: number | null, latestMsg: string): string {
  const lid = lessonIdStr(number, subNumber);
  return `<div class="feedback-bar generation-bar" id="feedback-bar" style="flex-direction:column;align-items:stretch;gap:0.5rem;background:var(--warning-bg);border-color:var(--warning);"
       hx-get="/missions/${missionId}/lessons/${lid}/generate-bridging/status"
       hx-trigger="every 1s"
       hx-swap="outerHTML"
       hx-target="#feedback-bar">
    <span class="label" style="color:var(--warning);"><span class="badge badge-in-progress" style="margin-right:0.5rem;">Generating</span> Creating bridging lesson…</span>
    <div style="font-size:0.85rem;color:var(--warning);display:flex;align-items:center;gap:0.5rem;">
      <span class="thinking-dots"><span></span><span></span><span></span></span>
      ${latestMsg}
    </div>
  </div>`;
}

export function bridgingDoneBar(missionId: number, number: number, subNumber: number | null, lessonTitle: string): string {
  const lid = lessonIdStr(number, subNumber);
  const displayNum = formatLessonNumber(number, subNumber);
  return `<div class="feedback-bar" id="feedback-bar"${hideBannerOnSettle()}>
    <span class="label"><span class="badge badge-ready" style="margin-right:0.5rem;">Ready</span> Bridging lesson created! <a href="/missions/${missionId}/lessons/${lid}" style="color:var(--accent);font-weight:500;">Start Lesson ${displayNum}: ${lessonTitle} &rarr;</a></span>
  </div>`;
}

export function bridgingErrorBar(missionId: number, error: string): string {
  return `<div class="feedback-bar" id="feedback-bar"${hideBannerOnSettle()}>
    <span class="label"><span class="badge badge-error" style="margin-right:0.5rem;">Error</span> Failed to create bridging lesson: ${error}</span>
    <a href="/missions/${missionId}" class="btn btn-ghost btn-sm">Back to lessons &rarr;</a>
  </div>`;
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

// ── Feedback Modal ──

export function feedbackModal(params: {
  missionId: number;
  number: number;
  subNumber: number | null;
  lessonTitle: string;
  mode: "next" | "more";
}): string {
  const { missionId, number, subNumber, lessonTitle, mode } = params;
  const lid = lessonIdStr(number, subNumber);
  const displayNum = formatLessonNumber(number, subNumber);

  const isNext = mode === "next";
  const title = isNext ? "Before your next lesson…" : "What would you like to explore?";
  const feedbackLabel = isNext
    ? "How was this lesson?"
    : "What aspect would you like to dive deeper into?";
  const feedbackPlaceholder = isNext
    ? "What worked well? What was confusing? What would you like more or less of?"
    : "What specific topic, concept, or skill would you like to explore further?";
  const submitLabel = isNext ? "Generate Next Lesson" : "Ask Teacher";
  const postUrl = isNext
    ? `/missions/${missionId}/lessons/${lid}/generate-next`
    : `/missions/${missionId}/chat`;
  const feedbackFieldName = isNext ? "feedback" : "message";

  const formAttrs = isNext
    ? `hx-post="${postUrl}" hx-target="#feedback-bar" hx-swap="outerHTML" hx-on:htmx:after-request="document.querySelector('#feedback-modal')?.remove()"`
    : `hx-post="${postUrl}" hx-target="#followup-messages" hx-swap="beforeend" hx-on:htmx:before-request="var t=document.querySelector('#feedback-modal textarea[name=message]');addFollowupMessage(t?.value);document.querySelector('#feedback-modal')?.remove()" hx-on:htmx:after-request="cleanupThinking()"`;

  return `<div class="modal-overlay" id="feedback-modal">
  <div class="modal-content">
    <form ${formAttrs}>
      <div class="modal-header">
        <h3>${title}</h3>
        <button type="button" class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label class="field-label">${feedbackLabel}</label>
          <textarea name="${feedbackFieldName}" placeholder="${feedbackPlaceholder}" rows="3"></textarea>
        </div>
        ${isNext ? `
        <div class="field">
          <label class="field-label">What should the next lesson cover? <span style="color:var(--text-muted);font-weight:400;">(optional)</span></label>
          <textarea name="notes" placeholder='e.g. "More hands-on examples" or "Go deeper into chord progressions"' rows="2"></textarea>
        </div>` : ""}
      </div>
      <div class="modal-footer">
        ${isNext
          ? `<input type="hidden" name="fromFeedbackModal" value="1">`
          : `<input type="hidden" name="context" value="Lesson ${displayNum}: ${lessonTitle.replace(/"/g, '&quot;')}">
             <input type="hidden" name="fromFeedbackModal" value="1">`}
        <button type="button" class="btn btn-ghost btn-sm" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button type="submit" class="btn btn-primary btn-sm">${submitLabel}</button>
      </div>
    </form>
  </div>
</div>`;
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

// ── Site-Wide Workflow Indicator ──

export function siteWideIndicator(): string {
  return '<div id="workflow-indicator"></div>';
}

// ── Page-Local Generation Progress Panel ──

export function generationProgressPanel(): string {
  return `<div id="generation-progress" class="generation-progress" style="display:none;">
  <div class="gen-progress-header">
    <span class="spinner"></span>
    <span class="gen-progress-title">Generating lesson...</span>
  </div>
  <div id="gen-progress-detail" class="gen-progress-detail"></div>
</div>
<script>
(function() {
  var panel = document.getElementById("generation-progress");
  if (!panel) return;
  // Poll workflow state to find lesson_generation workflows
  function check() {
    fetch("/workflows/state")
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var genWfs = (data.workflows || []).filter(function(w) { return w.type === "lesson_generation"; });
        if (genWfs.length > 0) {
          panel.style.display = "block";
          var title = panel.querySelector(".gen-progress-title");
          if (title) title.textContent = genWfs[0].label || "Generating lesson...";
        } else {
          panel.style.display = "none";
        }
      })
      .catch(function() {});
  }
  check();
  setInterval(check, 3000);
})();
</script>`;
}

// ── Onboarding Activation Progress Panel ──

export function activationProgressPanel(): string {
  return `<div id="activation-progress" class="activation-progress" style="display:none;">
  <div class="activation-progress-header">
    <span class="spinner"></span>
    <span>Setting up your mission...</span>
  </div>
</div>
<script>
(function() {
  var panel = document.getElementById("activation-progress");
  if (!panel) return;
  var checkCount = 0;
  function check() {
    fetch("/workflows/state")
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var actWfs = (data.workflows || []).filter(function(w) { return w.type === "mission_activation"; });
        checkCount++;
        if (actWfs.length > 0) {
          panel.style.display = "block";
        } else if (checkCount > 3) {
          panel.style.display = "none";
        }
      })
      .catch(function() {});
  }
  check();
  setInterval(check, 2000);
})();
</script>`;
}

import { formatLessonNumber, lessonIdStr } from "../shared/lesson-numbers.js";

/** HTMX fragments used in route handler responses */

// ── Chat ──

export function chatMessageBubble(role: "user" | "assistant", content: string, userInitial?: string): string {
  const avatar = role === "user" ? (userInitial || "Y") : "AI";
  if (role === "user") {
    return `<div class="msg-row user"><div class="msg-avatar">${avatar}</div><div class="msg">${content}</div></div>`;
  }
  return `<div class="msg-row assistant"><div class="msg-avatar">${avatar}</div><div class="msg markdown-body">${content}</div></div>`;
}

// ── Lesson action bars ──

function actionButtons(missionId: number, lid: string): string {
  const promptId = `gen-prompt-${lid}`;
  return `<div class="la-actions">
    <div class="la-action">
      <button class="btn btn-primary btn-sm"
        hx-post="/missions/${missionId}/lessons/${lid}/complete"
        hx-target="#feedback-bar" hx-swap="outerHTML">Mark Complete</button>
      <span class="la-hint">Finish this lesson and choose your next step</span>
    </div>
    <div class="la-gen-prompt">
      <input type="text" id="${promptId}" name="notes"
        placeholder="What should the next lesson cover? (optional)"
        class="la-gen-input"
        autocomplete="off" />
    </div>
    <div class="la-action">
      <button class="btn btn-secondary btn-sm"
        hx-post="/missions/${missionId}/lessons/${lid}/generate-next"
        hx-include="#${promptId}"
        hx-target="#feedback-bar" hx-swap="outerHTML">New Lesson</button>
      <span class="la-hint">Creates the next main lesson in sequence</span>
    </div>
    <div class="la-action">
      <button class="btn btn-secondary btn-sm"
        hx-post="/missions/${missionId}/lessons/${lid}/generate-sub-lesson"
        hx-include="#${promptId}"
        hx-target="#feedback-bar" hx-swap="outerHTML">More Like This</button>
      <span class="la-hint">Creates a sub-lesson nested under this lesson</span>
    </div>
  </div>`;
}

export function lessonActionBar(missionId: number, number: number, subNumber: number | null): string {
  const lid = lessonIdStr(number, subNumber);
  return `<div class="lesson-actions" id="feedback-bar">
    <div class="la-feedback">
      <div class="la-fb-ratings" id="la-fb-ratings">
        <span class="la-label">How was this lesson?</span>
        <div class="la-fb-buttons">
          <button class="fb-btn" data-rating="too_easy">Too easy</button>
          <button class="fb-btn" data-rating="just_right">Just right</button>
          <button class="fb-btn" data-rating="too_hard">Too hard</button>
        </div>
      </div>
      <div class="la-fb-textarea" id="la-fb-textarea" style="display:none;">
        <span class="la-fb-textarea-label" id="la-fb-textarea-label"></span>
        <div class="la-fb-input-row">
          <textarea class="la-fb-input" id="la-fb-input" rows="2"></textarea>
          <button class="btn btn-primary btn-sm la-fb-submit" id="la-fb-submit">Send</button>
        </div>
        <button class="fb-btn la-fb-change" id="la-fb-change">Change rating</button>
      </div>
    </div>
    <div class="la-divider"></div>
    ${actionButtons(missionId, lid)}
  </div>
  <script>
  (function() {
    var bar = document.getElementById("feedback-bar");
    if (!bar || bar._laWired) return;
    bar._laWired = true;
    var ratings = document.getElementById("la-fb-ratings");
    var textareaWrap = document.getElementById("la-fb-textarea");
    var label = document.getElementById("la-fb-textarea-label");
    var input = document.getElementById("la-fb-input");
    var submitBtn = document.getElementById("la-fb-submit");
    var changeBtn = document.getElementById("la-fb-change");
    var selectedRating = "";

    function ratingLabel(r) {
      if (r === "too_easy") return "What made it too easy?";
      if (r === "too_hard") return "What made it too hard?";
      return "What worked well?";
    }

    function showTextarea(rating) {
      selectedRating = rating;
      label.textContent = ratingLabel(rating);
      ratings.style.display = "none";
      textareaWrap.style.display = "block";
      input.focus();
    }

    function submitFeedback() {
      var text = input.value.trim();
      var body = "rating=" + encodeURIComponent(selectedRating);
      if (text) body += "&feedbackText=" + encodeURIComponent(text);
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "/missions/${missionId}/lessons/${lid}/feedback");
      xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
      xhr.setRequestHeader("X-CSRF-Token", (document.cookie.match(/learninator_csrf=([^;]+)/) || [])[1] || "");
      xhr.setRequestHeader("HX-Request", "true");
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          var tmp = document.createElement("div");
          tmp.innerHTML = xhr.responseText;
          var newBar = tmp.querySelector("#feedback-bar");
          if (newBar) bar.parentNode.replaceChild(newBar, bar);
        }
      };
      xhr.send(body);
    }

    ratings.querySelectorAll(".fb-btn").forEach(function(btn) {
      btn.addEventListener("click", function(e) {
        e.preventDefault();
        showTextarea(btn.dataset.rating);
      });
    });

    submitBtn.addEventListener("click", function(e) {
      e.preventDefault();
      submitFeedback();
    });

    input.addEventListener("keydown", function(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitFeedback();
      }
    });

    changeBtn.addEventListener("click", function(e) {
      e.preventDefault();
      ratings.style.display = "";
      textareaWrap.style.display = "none";
    });
  })();
  </script>`;
}

export function feedbackThanksBar(rating: string, missionId: number, number: number, subNumber: number | null, feedbackText?: string): string {
  const lid = lessonIdStr(number, subNumber);
  const ratingLabel = rating.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const escapedText = feedbackText ? feedbackText.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
  const textSnippet = escapedText.length > 120 ? escapedText.slice(0, 120) + "…" : escapedText;

  let adjustmentButtons = "";
  if (rating === "too_easy") {
    adjustmentButtons = `<button class="btn btn-secondary btn-sm"
      hx-post="/missions/${missionId}/lessons/${lid}/regenerate"
      hx-target="#feedback-bar" hx-swap="outerHTML"
      hx-vals='{"direction":"harder"}'>Make Harder</button>`;
  } else if (rating === "too_hard") {
    adjustmentButtons = `<button class="btn btn-secondary btn-sm"
      hx-post="/missions/${missionId}/lessons/${lid}/regenerate"
      hx-target="#feedback-bar" hx-swap="outerHTML"
      hx-vals='{"direction":"easier"}'>Make Easier</button>
    <button class="btn btn-secondary btn-sm"
      hx-post="/missions/${missionId}/lessons/${lid}/generate-bridging"
      hx-target="#feedback-bar" hx-swap="outerHTML">Bridge First</button>`;
  }

  return `<div class="lesson-actions" id="feedback-bar">
    <div class="la-feedback">
      <span class="la-label">Thanks! You rated this <strong>${ratingLabel}</strong>.</span>
      ${escapedText ? `<span class="la-fb-text-preview">"${textSnippet}"</span>` : ""}
      ${adjustmentButtons ? `<div class="la-fb-buttons">${adjustmentButtons}</div>` : ""}
    </div>
    <div class="la-divider"></div>
    ${actionButtons(missionId, lid)}
  </div>`;
}

export function completedLessonBar(missionId: number, number: number, subNumber: number | null): string {
  const lid = lessonIdStr(number, subNumber);
  const promptId = `gen-prompt-${lid}`;
  return `<div class="lesson-actions" id="feedback-bar">
    <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.25rem;">
      <span class="badge badge-completed">Completed</span>
      <strong>What's next?</strong>
      <span style="flex:1"></span>
      <button class="btn btn-ghost btn-sm"
        hx-post="/missions/${missionId}/lessons/${lid}/incomplete"
        hx-target="#feedback-bar" hx-swap="outerHTML">Mark Incomplete</button>
    </div>
    <div class="la-divider"></div>
    <div class="la-gen-prompt">
      <input type="text" id="${promptId}" name="notes"
        placeholder="What should the next lesson cover? (optional)"
        class="la-gen-input"
        autocomplete="off" />
    </div>
    <div class="la-actions">
      <div class="la-action">
        <button class="btn btn-primary btn-sm"
          hx-post="/missions/${missionId}/lessons/${lid}/generate-next"
          hx-include="#${promptId}"
          hx-target="#feedback-bar" hx-swap="outerHTML">Continue Learning</button>
        <span class="la-hint">Creates the next main lesson in sequence</span>
      </div>
      <div class="la-action">
        <button class="btn btn-secondary btn-sm"
          hx-post="/missions/${missionId}/lessons/${lid}/generate-sub-lesson"
          hx-include="#${promptId}"
          hx-target="#feedback-bar" hx-swap="outerHTML">Dive Deeper</button>
        <span class="la-hint">Creates a sub-lesson nested under this lesson</span>
      </div>
      <div class="la-action">
        <a class="btn btn-secondary btn-sm" href="/browse">Explore Something New</a>
        <span class="la-hint">Browse topics to find a new direction</span>
      </div>
    </div>
  </div>`;
}

// ── Lesson generation ──

type LessonInfo = {
  number: number;
  subNumber: number | null;
  title: string;
};

type JobStatus = "polling" | "running" | "done" | "error" | "missing";

interface GenStyle {
  badgeText: string;
  headerText: string;
  statusSuffix: string;
  linkColor: string;
  doneBadgeText: string;
  doneMessage: string;
  doneLinkPrefix: string;
  errorPrefix: string;
  supportsSub: boolean;
  hasMissingBar: boolean;
}

const nextStyle: GenStyle = {
  badgeText: "Generating",
  headerText: "Creating your next lesson…",
  statusSuffix: "generate-next",
  linkColor: "var(--rubric)",
  doneBadgeText: "Ready",
  doneMessage: "Lesson created!",
  doneLinkPrefix: "Start Lesson",
  errorPrefix: "Failed to generate next lesson: ",
  supportsSub: true,
  hasMissingBar: true,
};

const regenStyle: GenStyle = {
  badgeText: "Regenerating",
  headerText: "Rewriting lesson at new difficulty…",
  statusSuffix: "regenerate",
  linkColor: "var(--accent)",
  doneBadgeText: "Updated",
  doneMessage: "Lesson regenerated!",
  doneLinkPrefix: "View Lesson",
  errorPrefix: "Failed to regenerate lesson: ",
  supportsSub: false,
  hasMissingBar: false,
};

const bridgeStyle: GenStyle = {
  badgeText: "Generating",
  headerText: "Creating bridging lesson…",
  statusSuffix: "generate-bridging",
  linkColor: "var(--accent)",
  doneBadgeText: "Ready",
  doneMessage: "Bridging lesson created!",
  doneLinkPrefix: "Start Lesson",
  errorPrefix: "Failed to create bridging lesson: ",
  supportsSub: false,
  hasMissingBar: false,
};

function generationProgressBar(
  style: GenStyle,
  status: JobStatus,
  missionId: number,
  lesson: LessonInfo,
  opts?: { isSub?: boolean; latestMsg?: string }
): string {
  const lid = lessonIdStr(lesson.number, lesson.subNumber);

  if (status === "polling" || status === "running") {
    const isSub = style.supportsSub && opts?.isSub;
    const suffix = isSub ? "generate-sub-lesson" : style.statusSuffix;
    const label = isSub ? "Creating sub-lesson…" : style.headerText;
    const detail = status === "running" && opts?.latestMsg ? opts.latestMsg : "Starting…";
    return `<div class="feedback-bar generation-bar" id="feedback-bar" style="flex-direction:column;align-items:stretch;gap:0.5rem;background:var(--warning-bg);border-color:var(--warning);"
         hx-get="/missions/${missionId}/lessons/${lid}/${suffix}/status"
         hx-trigger="every 1s"
         hx-swap="outerHTML"
         hx-target="#feedback-bar">
      <span class="label" style="color:var(--warning);"><span class="badge badge-in-progress" style="margin-right:0.5rem;">${style.badgeText}</span> ${label}</span>
      <div style="font-size:0.85rem;color:var(--warning);display:flex;align-items:center;gap:0.5rem;">
        <span class="thinking-dots"><span></span><span></span><span></span></span>
        ${detail}
      </div>
    </div>`;
  }

  if (status === "done") {
    const displayNum = formatLessonNumber(lesson.number, lesson.subNumber);
    return `<div class="feedback-bar" id="feedback-bar">
      <span class="label"><span class="badge badge-ready" style="margin-right:0.5rem;">${style.doneBadgeText}</span> ${style.doneMessage} <a href="/missions/${missionId}/lessons/${lid}" style="color:${style.linkColor};font-weight:500;">${style.doneLinkPrefix} ${displayNum}: ${lesson.title} &rarr;</a></span>
    </div>`;
  }

  if (status === "error") {
    return `<div class="feedback-bar" id="feedback-bar">
      <span class="label"><span class="badge badge-error" style="margin-right:0.5rem;">Error</span> ${style.errorPrefix}${opts?.latestMsg || ""}</span>
      <a href="/missions/${missionId}" class="btn btn-ghost btn-sm">Back to lessons &rarr;</a>
    </div>`;
  }

  // missing
  return `<div class="feedback-bar" id="feedback-bar"><span class="label">Something went wrong. <a href="/missions/${missionId}" style="color:var(--ink);">Back to lessons &rarr;</a></span></div>`;
}

// ── Generation bar wrappers (preserve original export names for callers) ──

export function generationPollingBar(missionId: number, number: number, subNumber: number | null, isSub: boolean = false): string {
  return generationProgressBar(nextStyle, "polling", missionId, { number, subNumber, title: "" }, { isSub });
}

export function generationRunningBar(missionId: number, number: number, subNumber: number | null, isSub: boolean, latestMsg: string): string {
  return generationProgressBar(nextStyle, "running", missionId, { number, subNumber, title: "" }, { isSub, latestMsg });
}

export function generationDoneBar(missionId: number, number: number, subNumber: number | null, lessonTitle: string): string {
  return generationProgressBar(nextStyle, "done", missionId, { number, subNumber, title: lessonTitle });
}

export function generationErrorBar(missionId: number, error: string): string {
  return generationProgressBar(nextStyle, "error", missionId, { number: 0, subNumber: null, title: "" }, { latestMsg: error });
}

export function generationMissingBar(missionId: number): string {
  return generationProgressBar(nextStyle, "missing", missionId, { number: 0, subNumber: null, title: "" });
}

export function regenerationPollingBar(missionId: number, number: number, subNumber: number | null): string {
  return generationProgressBar(regenStyle, "polling", missionId, { number, subNumber, title: "" });
}

export function regenerationRunningBar(missionId: number, number: number, subNumber: number | null, latestMsg: string): string {
  return generationProgressBar(regenStyle, "running", missionId, { number, subNumber, title: "" }, { latestMsg });
}

export function regenerationDoneBar(missionId: number, number: number, subNumber: number | null, lessonTitle: string): string {
  return generationProgressBar(regenStyle, "done", missionId, { number, subNumber, title: lessonTitle });
}

export function regenerationErrorBar(missionId: number, error: string): string {
  return generationProgressBar(regenStyle, "error", missionId, { number: 0, subNumber: null, title: "" }, { latestMsg: error });
}

export function bridgingPollingBar(missionId: number, number: number, subNumber: number | null): string {
  return generationProgressBar(bridgeStyle, "polling", missionId, { number, subNumber, title: "" });
}

export function bridgingRunningBar(missionId: number, number: number, subNumber: number | null, latestMsg: string): string {
  return generationProgressBar(bridgeStyle, "running", missionId, { number, subNumber, title: "" }, { latestMsg });
}

export function bridgingDoneBar(missionId: number, number: number, subNumber: number | null, lessonTitle: string): string {
  return generationProgressBar(bridgeStyle, "done", missionId, { number, subNumber, title: lessonTitle });
}

export function bridgingErrorBar(missionId: number, error: string): string {
  return generationProgressBar(bridgeStyle, "error", missionId, { number: 0, subNumber: null, title: "" }, { latestMsg: error });
}

// ── Convenience wrappers with cleaner API (for future use) ──

export function generateNextBar(status: JobStatus, missionId: number, lesson: LessonInfo, isSub?: boolean, latestMsg?: string): string {
  return generationProgressBar(nextStyle, status, missionId, lesson, { isSub, latestMsg });
}

export function regenerateBar(status: JobStatus, missionId: number, lesson: LessonInfo, latestMsg?: string): string {
  return generationProgressBar(regenStyle, status, missionId, lesson, { latestMsg });
}

export function bridgingBar(status: JobStatus, missionId: number, lesson: LessonInfo, latestMsg?: string): string {
  return generationProgressBar(bridgeStyle, status, missionId, lesson, { latestMsg });
}

// ── Empty states ──

export function emptyLessonsMessage(missionId: number): string {
  return `<div class="empty" style="padding-bottom:1.5rem;">
    <p>No lessons yet. Ask your AI teacher what you'd like to learn!</p>
  </div>
  <div id="empty-chat-messages"></div>
  <form class="chat-form" id="empty-chat-form"
    hx-post="/missions/${missionId}/chat"
    hx-target="#empty-chat-messages"
    hx-swap="beforeend"
    hx-on::before-request="optimisticChat(this)"
    hx-on::after-request="this.reset(); scheduleLessonCheck(${missionId})">
    <div class="textarea-wrapper">
      <textarea name="message" placeholder="What would you like to learn?" rows="2" oninput="autoResize(this)"></textarea>
      <span class="textarea-hint">Press Enter to send &middot; Shift + Enter for newline</span>
    </div>
    <button type="submit">Send</button>
  </form>
  <script>
  window._lessonCheckInterval = window._lessonCheckInterval || null;
  function scheduleLessonCheck(mid) {
    if (window._lessonCheckInterval) return;
    var tries = 0, maxTries = 30;
    function doCheck() {
      tries++;
      if (tries > maxTries) { clearInterval(window._lessonCheckInterval); window._lessonCheckInterval = null; return; }
      fetch("/missions/" + mid + "/lessons/check")
        .then(function(r) { return r.status === 204 ? null : r.text(); })
        .then(function(html) {
          if (html) {
            clearInterval(window._lessonCheckInterval);
            window._lessonCheckInterval = null;
            var el = document.getElementById("empty-lessons-state");
            if (el) el.outerHTML = html;
          }
        })
        .catch(function() {});
    }
    doCheck();
    window._lessonCheckInterval = setInterval(doCheck, 2000);
  }
  </script>`;
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

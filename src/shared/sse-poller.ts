/** SSE reconnection helper for site-wide workflow indicator.
 * Returns a <script> tag that manages an EventSource with exponential backoff
 * reconnection and a disconnect/reconnect UI in the workflow indicator.
 */
export function ssePollerScript(): string {
  return `<script>
(function() {
  var indicator = document.getElementById("workflow-indicator");
  if (!indicator) return;

  var es = null;
  var retryMs = 1000;
  var maxRetry = 30000;
  var reconnectTimer = null;

  function connect() {
    if (es) {
      es.close();
      es = null;
    }
    es = new EventSource("/workflows/events");

    es.addEventListener("workflow_start", function(e) {
      try {
        var d = JSON.parse(e.data);
        addWorkflow(d);
      } catch(ex) {}
    });

    es.addEventListener("workflow_step", function(e) {
      try {
        var d = JSON.parse(e.data);
        updateStep(d);
      } catch(ex) {}
    });

    es.addEventListener("workflow_complete", function(e) {
      try {
        var d = JSON.parse(e.data);
        markComplete(d.workflowId);
      } catch(ex) {}
    });

    es.addEventListener("workflow_error", function(e) {
      try {
        var d = JSON.parse(e.data);
        markError(d);
      } catch(ex) {}
    });

    es.addEventListener("open", function() {
      retryMs = 1000;
      clearDisconnected();
      // Catch up on any state we missed while disconnected
      fetch("/workflows/state")
        .then(function(r) { return r.json(); })
        .then(function(data) { renderAll(data.workflows || []); })
        .catch(function() {});
    });

    es.addEventListener("error", function() {
      showDisconnected();
      es.close();
      es = null;
      scheduleReconnect();
    });
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(function() {
      reconnectTimer = null;
      connect();
      retryMs = Math.min(retryMs * 2, maxRetry);
    }, retryMs);
  }

  function showDisconnected() {
    indicator.classList.add("disconnected");
    var summary = indicator.querySelector(".wf-summary");
    if (summary) summary.textContent = "Connection lost. Reconnecting...";
  }

  function clearDisconnected() {
    indicator.classList.remove("disconnected");
  }

  // DOM helpers — updated by inline script in shared.ts
  window._wfState = { workflows: [] };

  function addWorkflow(d) {
    var found = window._wfState.workflows.find(function(w) { return w.id === d.workflowId; });
    if (!found) {
      window._wfState.workflows.push({
        id: d.workflowId,
        type: d.type || "chat",
        label: d.label,
        status: "running",
        linkUrl: d.linkUrl || "",
      });
    }
    render();
  }

  function updateStep(d) {
    render();
  }

  function markComplete(id) {
    var w = window._wfState.workflows.find(function(wf) { return wf.id === id; });
    if (w) w.status = "completed";
    render();
    // Auto-dismiss after brief show
    var stillRunning = window._wfState.workflows.some(function(wf) { return wf.status === "running"; });
    if (!stillRunning) {
      setTimeout(function() {
        window._wfState.workflows = window._wfState.workflows.filter(function(wf) { return wf.status !== "completed"; });
        render();
      }, 2000);
    }
  }

  function markError(d) {
    var w = window._wfState.workflows.find(function(wf) { return wf.id === d.workflowId; });
    if (w) { w.status = "failed"; w.error = d.error || ""; }
    render();
  }

  function renderAll(workflows) {
    window._wfState.workflows = workflows.map(function(w) {
      return { id: w.id, type: w.type, label: w.label, status: w.status, linkUrl: w.linkUrl, error: w.error };
    });
    render();
  }

  function render() {
    var wfs = window._wfState.workflows;
    if (wfs.length === 0) {
      indicator.classList.remove("visible", "error");
      indicator.innerHTML = "";
      return;
    }
    var running = wfs.filter(function(w) { return w.status === "running"; });
    var failed = wfs.filter(function(w) { return w.status === "failed"; });
    var html = "";
    if (failed.length > 0) {
      indicator.classList.add("error");
      html = failed.map(function(w) {
        return '<span class="wf-item wf-error">' + esc(w.label) + ' — <em>' + esc(w.error || "Failed") + '</em></span>';
      }).join("");
    } else if (running.length > 0) {
      indicator.classList.remove("error");
      html = running.map(function(w) {
        var label = w.type === "lesson_generation" ? "Generating" : w.type === "mission_activation" ? "Activating" : "Working";
        var link = w.linkUrl ? ' href="' + w.linkUrl + '"' : '';
        return '<a class="wf-item"' + link + '><span class="spinner"></span> <span class="wf-label">' + esc(w.label) + '</span></a>';
      }).join("");
    } else {
      indicator.classList.remove("visible", "error");
      indicator.innerHTML = "";
      return;
    }
    indicator.innerHTML = html;
    indicator.classList.add("visible");
  }

  function esc(s) {
    return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Kick off
  fetch("/workflows/state")
    .then(function(r) { return r.json(); })
    .then(function(data) { renderAll(data.workflows || []); })
    .catch(function() {})
    .finally(function() { connect(); });
})();
</script>`;
}

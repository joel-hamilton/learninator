/** Workflow progress indicator — polling-based to avoid persistent connection accumulation.
 * Polls /workflows/state only when workflows are known to be active. Stops when idle.
 */
export function ssePollerScript(): string {
  return `<script>
(function() {
  var indicator = document.getElementById("workflow-indicator");
  if (!indicator) return;

  var interval = null;
  var consecutiveErrors = 0;

  function startPolling() {
    if (interval) return;
    fetchState(); // immediate first fetch
    // Don't set interval yet — fetchState will decide whether to keep polling
  }

  function stopPolling() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  function scheduleNext() {
    stopPolling();
    interval = setInterval(fetchState, 5000);
  }

  function fetchState() {
    fetch("/workflows/state")
      .then(function(r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function(data) {
        consecutiveErrors = 0;
        clearDisconnected();
        renderAll(data.workflows || []);
        // Only keep polling if there are running workflows
        var hasRunning = (data.workflows || []).some(function(w) { return w.status === "running"; });
        if (hasRunning) {
          scheduleNext();
        } else {
          stopPolling();
        }
      })
      .catch(function() {
        consecutiveErrors++;
        if (consecutiveErrors >= 3) {
          showDisconnected();
          stopPolling();
        }
      });
  }

  // Stop polling when page is hidden (bfcache / tab switch), restart when shown
  document.addEventListener("visibilitychange", function() {
    if (document.hidden) {
      stopPolling();
    } else {
      consecutiveErrors = 0;
      startPolling();
    }
  });

  // Stop polling when page is unloaded
  window.addEventListener("pagehide", function() {
    stopPolling();
  });

  function showDisconnected() {
    indicator.classList.add("disconnected");
  }

  function clearDisconnected() {
    indicator.classList.remove("disconnected");
  }

  window._wfState = { workflows: [] };

  function addWorkflow(d) {
    // Not called via SSE events anymore; state is fully replaced by renderAll
  }

  function updateStep(d) {}

  function markComplete(id) {
    // Handled by renderAll now; auto-dismiss is in render()
  }

  function markError(d) {
    // Handled by renderAll now
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
  startPolling();
})();
</script>`;
}

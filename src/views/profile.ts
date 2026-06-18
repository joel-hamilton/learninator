import type { ProfileReportRow } from "../types.js";

export function profileReport(rows: ProfileReportRow[]): string {
  const rowHtml =
    rows.length === 0
      ? `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted, #888);">No requests recorded yet.</td></tr>`
      : rows
          .map((r) => {
            const avg = r.avgMs.toFixed(1);
            const min = r.minMs.toFixed(1);
            const max = r.maxMs.toFixed(1);
            const slowHtml = r.recentSlow
              .slice(0, 5)
              .map(
                (s) =>
                  `<span style="display:block;font-size:0.8em;color:var(--text-muted, #888);">${s.durationMs.toFixed(1)}ms — ${s.url}</span>`,
              )
              .join("");
            return `<tr>
              <td style="font-family:monospace;">${r.routePattern}</td>
              <td style="text-align:right;">${r.count}</td>
              <td style="text-align:right;">${avg}ms</td>
              <td style="text-align:right;">${min}ms</td>
              <td style="text-align:right;">${max}ms</td>
            </tr>`;
          })
          .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Profile Report — Learninator</title>
<style>
  body {
    font-family: system-ui, -apple-system, sans-serif;
    background: var(--bg, #1a1a2e);
    color: var(--text, #e0e0e0);
    max-width: 960px;
    margin: 0 auto;
    padding: 2rem;
  }
  h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
  .meta { color: var(--text-muted, #888); font-size: 0.85rem; margin-bottom: 2rem; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 2rem;
  }
  th, td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border, #333);
    text-align: left;
  }
  th {
    font-weight: 600;
    color: var(--text-muted, #888);
    font-size: 0.85rem;
    text-transform: uppercase;
  }
  tr:hover { background: var(--surface, rgba(255,255,255,0.03)); }
  .slow-section { margin-top: 2rem; }
  .slow-section h2 { font-size: 1.1rem; margin-bottom: 0.5rem; }
</style>
</head>
<body>
<h1>Endpoint Profile Report</h1>
<p class="meta">Accumulated since server start. Sorted by total time.</p>
<table>
<thead>
<tr><th>Endpoint</th><th>Count</th><th>Avg</th><th>Min</th><th>Max</th></tr>
</thead>
<tbody>
${rowHtml}
</tbody>
</table>
<div class="slow-section">
<h2>Recent Slow Requests</h2>
${slowRequestSection(rows)}
</div>
<p class="meta">Generated at ${new Date().toISOString()}</p>
</body>
</html>`;
}

function slowRequestSection(rows: ProfileReportRow[]): string {
  const allSlow = rows
    .flatMap((r) =>
      r.recentSlow.map((s) => ({ ...s, endpoint: r.routePattern })),
    )
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 20);

  if (allSlow.length === 0) {
    return `<p style="color:var(--text-muted, #888);">No slow requests recorded yet.</p>`;
  }

  return `<table>
<thead><tr><th>Endpoint</th><th>Duration</th><th>URL</th></tr></thead>
<tbody>
${allSlow
  .map(
    (s) => `<tr>
  <td style="font-family:monospace;">${s.endpoint}</td>
  <td style="text-align:right;">${s.durationMs.toFixed(1)}ms</td>
  <td style="font-family:monospace;font-size:0.85em;">${s.url}</td>
</tr>`,
  )
  .join("")}
</tbody></table>`;
}

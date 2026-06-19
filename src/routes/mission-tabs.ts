import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import type { AppVariables } from "../types.js";
import { requireMissionAccess } from "../shared/require-mission-access.js";
import { formatMarkdown } from "../shared/markdown.js";
import { missionLayout } from "../views/mission.js";
import { emptyReferencesMessage, emptyRecordsMessage, referenceDocCard, learningRecordCard } from "../views/fragments.js";

type Ctx = Context<{ Variables: AppVariables }>;
export const missionTabRoutes = new Hono<{ Variables: AppVariables }>();

// ── Reference docs ──
missionTabRoutes.get("/:missionId/reference", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const id = parseInt(c.req.param("missionId")!);

  const mission = await requireMissionAccess(store, id, user.id);
  if (!mission) return c.text("Not found", 404);

  const refs = await store.listReferenceDocs(id);

  if (refs.length === 0) {
    return c.html(missionLayout(user, mission, emptyReferencesMessage(), "reference", `/missions/${id}`, "Mission"));
  }

  const cards = refs.map((r) => referenceDocCard(id, r)).join("");

  return c.html(missionLayout(user, mission, `
    <div class="section-header">
      <h2>Reference Documents</h2>
    </div>
    <div class="ref-list stagger">${cards}</div>
  `, "reference", `/missions/${id}`, "Mission"));
});

// ── View single reference doc ──
missionTabRoutes.get("/:missionId/reference/:refId", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const refId = parseInt(c.req.param("refId")!);

  const mission = await requireMissionAccess(store, missionId, user.id);
  if (!mission) return c.text("Not found", 404);

  const ref = await store.getReferenceDoc(refId, missionId);
  if (!ref) return c.text("Not found", 404);

  const safeHtml = ref.htmlContent.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/<\/body>/i, `<script>function r(){const h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);parent.postMessage({type:'lessonResize',height:h},'*');}new ResizeObserver(r).observe(document.body);r();<\/script></body>`);
  return c.html(missionLayout(user, mission, `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
      <h2 style="font-size:1.15rem;font-weight:600;">${ref.title}</h2>
      <span class="badge badge-default">${ref.docType}</span>
    </div>
    <div class="ref-iframe-container" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;">
      <iframe id="ref-frame" scrolling="no" srcdoc="${safeHtml}" style="width:100%;border:none;display:block;min-height:400px;"></iframe>
    </div>
    <script>
    const refFrame = document.getElementById('ref-frame');
    window.addEventListener('message', function(e) {
      if (e.data?.type === 'lessonResize' && e.data.height) {
        refFrame.style.height = e.data.height + 'px';
        refFrame.style.minHeight = '0';
      }
    });
    </script>
  `, "reference", `/missions/${missionId}/reference`, "Reference"));
});

// ── Learning records ──
missionTabRoutes.get("/:missionId/records", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const id = parseInt(c.req.param("missionId")!);

  const mission = await requireMissionAccess(store, id, user.id);
  if (!mission) return c.text("Not found", 404);

  const records = await store.listLearningRecords(id);

  if (records.length === 0) {
    return c.html(missionLayout(user, mission, emptyRecordsMessage(), "records", `/missions/${id}`, "Mission"));
  }

  const cards = records.map((r) => learningRecordCard({
    number: r.number,
    title: r.title,
    markdownContent: formatMarkdown(r.markdownContent),
    status: r.status,
    supersededBy: r.supersededBy,
  })).join("");

  return c.html(missionLayout(user, mission, `
    <div class="section-header">
      <h2>Learning Records</h2>
    </div>
    <div class="record-list stagger">${cards}</div>
  `, "records", `/missions/${id}`, "Mission"));
});

// ── Resources ──
missionTabRoutes.get("/:missionId/resources", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const id = parseInt(c.req.param("missionId")!);

  const mission = await requireMissionAccess(store, id, user.id);
  if (!mission) return c.text("Not found", 404);

  const resources = await store.getMissionContent(id, "resources");

  return c.html(missionLayout(user, mission, `
    <div class="section-header">
      <h2>Resources</h2>
    </div>
    <div class="resource-markdown markdown-body">${formatMarkdown(resources?.markdownContent || "No resources curated yet.")}</div>
  `, "resources", `/missions/${id}`, "Mission"));
});

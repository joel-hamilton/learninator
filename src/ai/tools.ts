import type { DrizzleMissionStore } from "../db/store.js";
import type { ToolHandler, ToolHandlerContext, ToolExecutor, AiToolUseBlock, AiToolResultBlockParam } from "./types.js";

// ── Individual tool handlers ──────────────────────────────────────────

async function readMissionContent(ctx: ToolHandlerContext): Promise<string> {
  const { store, missionId, input } = ctx;
  const row = await store.getMissionContent(missionId, input.content_type as string);
  return row?.markdownContent || "(empty)";
}

async function writeMissionContent(ctx: ToolHandlerContext): Promise<string> {
  const { store, missionId, input } = ctx;
  await store.upsertMissionContent({
    missionId,
    contentType: input.content_type as string,
    markdownContent: input.markdown_content as string,
  });
  return `Saved ${input.content_type} content.`;
}

async function createLesson(ctx: ToolHandlerContext): Promise<string> {
  const { store, missionId, input } = ctx;
  const mainCount = await store.getMainLessonCount(missionId);
  const num = mainCount + 1;

  await store.createLesson({
    missionId,
    number: num,
    title: input.title as string,
    slug: input.slug as string,
    htmlContent: input.html_content as string,
  });

  return `Created lesson ${String(num).padStart(4, "0")}: "${input.title}". The user can now view it.`;
}

async function createSubLesson(ctx: ToolHandlerContext): Promise<string> {
  const { store, missionId, input } = ctx;
  const parentNumber = input.parent_lesson_number as number;

  const parent = await store.getLesson(missionId, parentNumber, null);
  if (!parent) return `Parent lesson ${parentNumber} not found.`;

  const subCount = await store.getSubLessonCount(missionId, parent.id);
  const subNum = subCount + 1;

  await store.createLesson({
    missionId,
    number: parentNumber,
    subNumber: subNum,
    parentLessonId: parent.id,
    title: input.title as string,
    slug: input.slug as string,
    htmlContent: input.html_content as string,
  });

  const displayNum = `${String(parentNumber).padStart(4, "0")}.${subNum}`;
  return `Created sub-lesson ${displayNum}: "${input.title}". The user can now view it.`;
}

async function readLesson(ctx: ToolHandlerContext): Promise<string> {
  const { store, missionId, input } = ctx;
  const lessonNumber = input.number as number;
  const subNumber = (input.sub_number as number | undefined) ?? null;

  const lesson = await store.getLesson(missionId, lessonNumber, subNumber);
  if (!lesson) return "Lesson not found.";
  return JSON.stringify({
    number: lesson.number,
    sub_number: lesson.subNumber,
    title: lesson.title,
    slug: lesson.slug,
    status: lesson.status,
    html_content: lesson.htmlContent,
  });
}

async function listLessons(ctx: ToolHandlerContext): Promise<string> {
  const { store, missionId } = ctx;
  const rows = await store.listLessons(missionId);
  return JSON.stringify(rows.map(r => ({
    number: r.number,
    subNumber: r.subNumber,
    title: r.title,
    slug: r.slug,
    status: r.status,
    createdAt: r.createdAt,
  })));
}

async function createReferenceDoc(ctx: ToolHandlerContext): Promise<string> {
  const { store, missionId, input } = ctx;
  await store.createReferenceDoc({
    missionId,
    title: input.title as string,
    slug: input.slug as string,
    htmlContent: input.html_content as string,
    docType: (input.doc_type as string) || "other",
  });
  return `Created reference doc: "${input.title}" (${input.doc_type}).`;
}

async function listReferenceDocs(ctx: ToolHandlerContext): Promise<string> {
  const { store, missionId } = ctx;
  const rows = await store.listReferenceDocs(missionId);
  return JSON.stringify(rows.map(r => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    docType: r.docType,
    createdAt: r.createdAt,
  })));
}

async function createLearningRecord(ctx: ToolHandlerContext): Promise<string> {
  const { store, missionId, input } = ctx;
  const recordCount = await store.getLearningRecordCount(missionId);
  const num = recordCount + 1;

  await store.createLearningRecord({
    missionId,
    number: num,
    title: input.title as string,
    markdownContent: input.markdown_content as string,
  });

  return `Created learning record LR${String(num).padStart(4, "0")}: "${input.title}".`;
}

async function listLearningRecords(ctx: ToolHandlerContext): Promise<string> {
  const { store, missionId } = ctx;
  const rows = await store.listLearningRecords(missionId);
  return JSON.stringify(rows.map(r => ({
    number: r.number,
    title: r.title,
    status: r.status,
    supersededBy: r.supersededBy,
    createdAt: r.createdAt,
  })));
}

async function updateLearningRecord(ctx: ToolHandlerContext): Promise<string> {
  const { store, missionId, input } = ctx;
  const records = await store.listLearningRecords(missionId);
  const record = records.find(r => r.number === (input.number as number));
  if (!record) return `Learning record ${input.number} not found.`;

  const updateValues: { status?: string; supersededBy?: number | null } = { status: input.status as string };
  if (input.status === "superseded" && input.superseded_by) {
    updateValues.supersededBy = input.superseded_by as number;
  }
  await store.updateLearningRecord(record.id, updateValues);

  return `Updated learning record LR${String(input.number).padStart(4, "0")} status to ${input.status}.`;
}

async function markMissionActive(ctx: ToolHandlerContext): Promise<string> {
  const { store, missionId } = ctx;
  await store.updateMissionStatus(missionId, "active");
  return "Mission is now active. You can begin creating lessons.";
}

async function readResources(ctx: ToolHandlerContext): Promise<string> {
  return readMissionContent({ ...ctx, input: { content_type: "resources" } });
}

async function writeResources(ctx: ToolHandlerContext): Promise<string> {
  return writeMissionContent({ ...ctx, input: { ...ctx.input, content_type: "resources" } });
}

async function askGuidedQuestion(ctx: ToolHandlerContext): Promise<string> {
  const { store, missionId, input } = ctx;
  const options = [...(input.options as string[]), "Other (please specify)"];
  await store.createGuidedQuestion({
    missionId,
    question: input.question as string,
    options: JSON.stringify(options),
  });
  return `Question saved. Waiting for user answer.`;
}

async function listFeedbackHistory(ctx: ToolHandlerContext): Promise<string> {
  const { store, missionId } = ctx;
  const rows = await store.listLessonFeedback(missionId);
  if (rows.length === 0) return "No feedback yet.";

  return rows.map(r => {
    const displayNum = String(r.number).padStart(4, "0") + (r.subNumber ? `.${r.subNumber}` : "");
    const rating = r.feedbackRating ?? "no rating";
    const line = `Lesson ${displayNum}: "${r.title}" — ${rating}`;
    const text = r.feedbackText ? `\n  Feedback: "${r.feedbackText}"` : "";
    return line + text;
  }).join("\n");
}

async function regenerateLesson(ctx: ToolHandlerContext): Promise<string> {
  const { store, missionId, input } = ctx;
  const number = input.number as number;
  const subNumber = (input.sub_number as number | undefined) ?? null;
  const title = input.title as string;
  const slug = input.slug as string;
  const htmlContent = input.html_content as string;

  const existing = await store.getLesson(missionId, number, subNumber);
  if (!existing) {
    const displayNum = String(number).padStart(4, "0");
    return `Lesson ${displayNum} not found.`;
  }

  await store.updateLessonContent(missionId, number, subNumber, title, slug, htmlContent);

  const displayNum = String(number).padStart(4, "0") + (subNumber ? `.${subNumber}` : "");
  return `Regenerated lesson ${displayNum}: "${title}".`;
}

// ── Friendly display names for UI ──────────────────────────────────────

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  read_mission_content: "Reading content",
  write_mission_content: "Writing content",
  create_lesson: "Creating lesson",
  create_sub_lesson: "Creating sub-lesson",
  read_lesson: "Reading lesson",
  list_lessons: "Listing lessons",
  create_reference_doc: "Creating reference",
  list_reference_docs: "Listing references",
  create_learning_record: "Creating record",
  list_learning_records: "Listing records",
  update_learning_record: "Updating record",
  mark_mission_active: "Activating mission",
  read_resources: "Reading resources",
  write_resources: "Writing resources",
  ask_guided_question: "Asking question",
  list_feedback_history: "Listing feedback",
  regenerate_lesson: "Regenerating lesson",
};

// ── Handler map ───────────────────────────────────────────────────────

function buildHandlerMap(): Map<string, ToolHandler> {
  return new Map([
    ["read_mission_content", readMissionContent],
    ["write_mission_content", writeMissionContent],
    ["create_lesson", createLesson],
    ["create_sub_lesson", createSubLesson],
    ["read_lesson", readLesson],
    ["list_lessons", listLessons],
    ["create_reference_doc", createReferenceDoc],
    ["list_reference_docs", listReferenceDocs],
    ["create_learning_record", createLearningRecord],
    ["list_learning_records", listLearningRecords],
    ["update_learning_record", updateLearningRecord],
    ["mark_mission_active", markMissionActive],
    ["read_resources", readResources],
    ["write_resources", writeResources],
    ["ask_guided_question", askGuidedQuestion],
    ["list_feedback_history", listFeedbackHistory],
    ["regenerate_lesson", regenerateLesson],
  ]);
}

// ── Factory ───────────────────────────────────────────────────────────

export function createToolExecutor(store: DrizzleMissionStore): ToolExecutor {
  const handlers = buildHandlerMap();

  return {
    async executeTool(
      missionId: number,
      toolName: string,
      input: Record<string, unknown>
    ): Promise<string> {
      const handler = handlers.get(toolName);
      if (!handler) return `Unknown tool: ${toolName}`;
      try {
        return await handler({ store, missionId, input });
      } catch (err) {
        return `Error executing ${toolName}: ${err}`;
      }
    },

    async executeToolCalls(
      missionId: number,
      toolUseBlocks: AiToolUseBlock[]
    ): Promise<AiToolResultBlockParam[]> {
      const results: AiToolResultBlockParam[] = [];
      for (const block of toolUseBlocks) {
        const result = await this.executeTool(missionId, block.name, block.input);
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
      return results;
    },
  };
}

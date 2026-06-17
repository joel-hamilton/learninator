import type { ToolHandler, ToolHandlerContext, ToolExecutor, AiToolUseBlock, AiToolResultBlockParam } from "./types.js"
import type { MissionStore } from "../db/store.js"

// ── Individual tool handlers ──────────────────────────────────────────

async function readMissionContent(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId, input } = ctx
  const content = await db.readMissionContent(missionId, input.content_type as string)
  return content ?? "(empty)"
}

async function writeMissionContent(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId, input } = ctx
  await db.upsertMissionContent(missionId, input.content_type as string, input.markdown_content as string)
  return `Saved ${input.content_type} content.`
}

async function createLesson(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId, input } = ctx
  const count = await db.getMainLessonCount(missionId)
  const num = count + 1
  await db.insertLesson({
    missionId,
    number: num,
    title: input.title as string,
    slug: input.slug as string,
    htmlContent: input.html_content as string,
  })
  return `Created lesson ${String(num).padStart(4, "0")}: "${input.title}". The user can now view it.`
}

async function createSubLesson(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId, input } = ctx
  const parentNumber = input.parent_lesson_number as number

  const parent = await db.getMainLessonByNumber(missionId, parentNumber)
  if (!parent) return `Parent lesson ${parentNumber} not found.`

  const maxSub = await db.getMaxSubNumber(parent.id)
  const subNum = (maxSub ?? 0) + 1

  await db.insertLesson({
    missionId,
    number: parentNumber,
    subNumber: subNum,
    parentLessonId: parent.id,
    title: input.title as string,
    slug: input.slug as string,
    htmlContent: input.html_content as string,
  })

  const displayNum = `${String(parentNumber).padStart(4, "0")}.${subNum}`
  return `Created sub-lesson ${displayNum}: "${input.title}". The user can now view it.`
}

async function readLesson(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId, input } = ctx
  const lessonNumber = input.number as number
  const subNumber = input.sub_number as number | undefined

  const lesson = await db.getLesson(missionId, lessonNumber, subNumber)
  if (!lesson) return "Lesson not found."

  return JSON.stringify({
    number: lesson.number,
    sub_number: lesson.subNumber,
    title: lesson.title,
    slug: lesson.slug,
    status: lesson.status,
    html_content: lesson.htmlContent,
  })
}

async function listLessons(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId } = ctx
  const rows = await db.listLessons(missionId)
  return JSON.stringify(rows)
}

async function createReferenceDoc(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId, input } = ctx
  await db.insertReferenceDoc({
    missionId,
    title: input.title as string,
    slug: input.slug as string,
    htmlContent: input.html_content as string,
    docType: (input.doc_type as string) || "other",
  })
  return `Created reference doc: "${input.title}" (${input.doc_type}).`
}

async function listReferenceDocs(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId } = ctx
  const rows = await db.listReferenceDocs(missionId)
  return JSON.stringify(rows)
}

async function createLearningRecord(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId, input } = ctx
  const count = await db.getLearningRecordCount(missionId)
  const num = count + 1

  await db.insertLearningRecord({
    missionId,
    number: num,
    title: input.title as string,
    markdownContent: input.markdown_content as string,
  })

  return `Created learning record LR${String(num).padStart(4, "0")}: "${input.title}".`
}

async function listLearningRecords(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId } = ctx
  const rows = await db.listLearningRecords(missionId)
  return JSON.stringify(rows)
}

async function updateLearningRecord(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId, input } = ctx
  await db.updateLearningRecord(missionId, input.number as number, {
    status: input.status as string,
    supersededBy: input.superseded_by as number | undefined,
  })

  return `Updated learning record LR${String(input.number).padStart(4, "0")} status to ${input.status}.`
}

async function markMissionActive(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId } = ctx
  await db.updateMissionStatus(missionId, "active")
  return "Mission is now active. You can begin creating lessons."
}

async function readResources(ctx: ToolHandlerContext): Promise<string> {
  return readMissionContent({ ...ctx, input: { content_type: "resources" } })
}

async function writeResources(ctx: ToolHandlerContext): Promise<string> {
  return writeMissionContent({ ...ctx, input: { ...ctx.input, content_type: "resources" } })
}

async function listFeedbackHistory(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId } = ctx
  const rows = await db.listLessonFeedback(missionId)

  const withFeedback = rows.filter(r => r.feedbackRating !== null)
  if (withFeedback.length === 0) return "No feedback has been recorded yet."

  return JSON.stringify(withFeedback.map(r => ({
    lesson: `${String(r.number).padStart(4, "0")}${r.subNumber !== null ? `.${r.subNumber}` : ""}`,
    title: r.title,
    status: r.status,
    rating: r.feedbackRating,
    text: r.feedbackText || null,
  })))
}

async function regenerateLesson(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId, input } = ctx
  const lessonNumber = input.number as number

  const lesson = await db.getLesson(missionId, lessonNumber)
  if (!lesson) return `Lesson ${lessonNumber} not found.`

  await db.updateLesson(missionId, lessonNumber, {
    title: input.title as string,
    slug: input.slug as string,
    htmlContent: input.html_content as string,
  })

  return `Updated lesson ${String(lessonNumber).padStart(4, "0")}: "${input.title}". The new content is ready — the student should reload the lesson page to see it.`
}

async function askGuidedQuestion(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId, input } = ctx
  const options = [...(input.options as string[]), "Other (please specify)"]
  await db.insertGuidedQuestion({
    missionId,
    question: input.question as string,
    options: JSON.stringify(options),
  })
  return `Question saved. Waiting for user answer.`
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
  list_feedback_history: "Checking feedback history",
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
  ])
}

// ── Factory ───────────────────────────────────────────────────────────

export function createToolExecutor(store: MissionStore): ToolExecutor {
  const handlers = buildHandlerMap()

  return {
    async executeTool(
      missionId: number,
      toolName: string,
      input: Record<string, unknown>
    ): Promise<string> {
      const handler = handlers.get(toolName)
      if (!handler) return `Unknown tool: ${toolName}`
      try {
        return await handler({ db: store, missionId, input })
      } catch (err) {
        return `Error executing ${toolName}: ${err}`
      }
    },

    async executeToolCalls(
      missionId: number,
      toolUseBlocks: AiToolUseBlock[]
    ): Promise<AiToolResultBlockParam[]> {
      const results: AiToolResultBlockParam[] = []
      for (const block of toolUseBlocks) {
        const result = await this.executeTool(missionId, block.name, block.input)
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        })
      }
      return results
    },
  }
}

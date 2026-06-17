import { schema, db } from "../db/index.js"
import { eq, and, asc, count, isNull, max } from "drizzle-orm"
import type { ToolHandler, ToolHandlerContext, ToolExecutor, AiToolUseBlock, AiToolResultBlockParam } from "./types.js"

// ── Individual tool handlers ──────────────────────────────────────────

async function readMissionContent(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId, input } = ctx
  const [row] = await db
    .select()
    .from(schema.missionContent)
    .where(
      and(
        eq(schema.missionContent.missionId, missionId),
        eq(
          schema.missionContent.contentType,
          input.content_type as "mission" | "notes" | "resources" | "glossary"
        )
      )
    )
    .limit(1)
  return row?.markdownContent || "(empty)"
}

async function writeMissionContent(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId, input } = ctx
  const [existing] = await db
    .select()
    .from(schema.missionContent)
    .where(
      and(
        eq(schema.missionContent.missionId, missionId),
        eq(
          schema.missionContent.contentType,
          input.content_type as "mission" | "notes" | "resources" | "glossary"
        )
      )
    )
    .limit(1)

  if (existing) {
    await db
      .update(schema.missionContent)
      .set({
        markdownContent: input.markdown_content as string,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.missionContent.id, existing.id))
  } else {
    await db.insert(schema.missionContent).values({
      missionId,
      contentType: input.content_type as "mission" | "notes" | "resources" | "glossary",
      markdownContent: input.markdown_content as string,
    })
  }
  return `Saved ${input.content_type} content.`
}

async function createLesson(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId, input } = ctx
  const [lastMain] = await db
    .select({ count: count() })
    .from(schema.lessons)
    .where(
      and(
        eq(schema.lessons.missionId, missionId),
        isNull(schema.lessons.parentLessonId),
      )
    )

  const num = (lastMain?.count || 0) + 1

  await db.insert(schema.lessons).values({
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

  const [parent] = await db
    .select()
    .from(schema.lessons)
    .where(
      and(
        eq(schema.lessons.missionId, missionId),
        eq(schema.lessons.number, parentNumber),
        isNull(schema.lessons.parentLessonId),
      )
    )
    .limit(1)
  if (!parent) return `Parent lesson ${parentNumber} not found.`

  const [lastSub] = await db
    .select({ max: max(schema.lessons.subNumber) })
    .from(schema.lessons)
    .where(eq(schema.lessons.parentLessonId, parent.id))

  const subNum = (lastSub?.max || 0) + 1

  await db.insert(schema.lessons).values({
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

  const conditions = [
    eq(schema.lessons.missionId, missionId),
    eq(schema.lessons.number, lessonNumber),
  ]
  if (subNumber !== undefined) {
    conditions.push(eq(schema.lessons.subNumber, subNumber))
  } else {
    conditions.push(isNull(schema.lessons.parentLessonId))
  }

  const [lesson] = await db
    .select()
    .from(schema.lessons)
    .where(and(...conditions))
    .limit(1)

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
  const rows = await db
    .select({
      number: schema.lessons.number,
      subNumber: schema.lessons.subNumber,
      title: schema.lessons.title,
      slug: schema.lessons.slug,
      status: schema.lessons.status,
      createdAt: schema.lessons.createdAt,
    })
    .from(schema.lessons)
    .where(eq(schema.lessons.missionId, missionId))
    .orderBy(asc(schema.lessons.number), asc(schema.lessons.subNumber))

  return JSON.stringify(rows)
}

async function createReferenceDoc(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId, input } = ctx
  await db.insert(schema.referenceDocs).values({
    missionId,
    title: input.title as string,
    slug: input.slug as string,
    htmlContent: input.html_content as string,
    docType:
      (input.doc_type as "cheatsheet" | "algorithm" | "routine" | "sequence" | "other") || "other",
  })
  return `Created reference doc: "${input.title}" (${input.doc_type}).`
}

async function listReferenceDocs(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId } = ctx
  const rows = await db
    .select({
      id: schema.referenceDocs.id,
      title: schema.referenceDocs.title,
      slug: schema.referenceDocs.slug,
      docType: schema.referenceDocs.docType,
      createdAt: schema.referenceDocs.createdAt,
    })
    .from(schema.referenceDocs)
    .where(eq(schema.referenceDocs.missionId, missionId))
    .orderBy(asc(schema.referenceDocs.createdAt))

  return JSON.stringify(rows)
}

async function createLearningRecord(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId, input } = ctx
  const [last] = await db
    .select({ count: count() })
    .from(schema.learningRecords)
    .where(eq(schema.learningRecords.missionId, missionId))

  const num = (last?.count || 0) + 1

  await db.insert(schema.learningRecords).values({
    missionId,
    number: num,
    title: input.title as string,
    markdownContent: input.markdown_content as string,
  })

  return `Created learning record LR${String(num).padStart(4, "0")}: "${input.title}".`
}

async function listLearningRecords(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId } = ctx
  const rows = await db
    .select({
      number: schema.learningRecords.number,
      title: schema.learningRecords.title,
      status: schema.learningRecords.status,
      supersededBy: schema.learningRecords.supersededBy,
      createdAt: schema.learningRecords.createdAt,
    })
    .from(schema.learningRecords)
    .where(eq(schema.learningRecords.missionId, missionId))
    .orderBy(asc(schema.learningRecords.number))

  return JSON.stringify(rows)
}

async function updateLearningRecord(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId, input } = ctx
  const updateData: Record<string, unknown> = { status: input.status }
  if (input.status === "superseded" && input.superseded_by) {
    updateData.supersededBy = input.superseded_by
  }

  await db
    .update(schema.learningRecords)
    .set(updateData)
    .where(
      and(
        eq(schema.learningRecords.missionId, missionId),
        eq(schema.learningRecords.number, input.number as number)
      )
    )

  return `Updated learning record LR${String(input.number).padStart(4, "0")} status to ${input.status}.`
}

async function markMissionActive(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId } = ctx
  await db
    .update(schema.missions)
    .set({ status: "active", updatedAt: new Date().toISOString() })
    .where(eq(schema.missions.id, missionId))

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
  const rows = await db
    .select({
      number: schema.lessons.number,
      subNumber: schema.lessons.subNumber,
      title: schema.lessons.title,
      status: schema.lessons.status,
      feedbackRating: schema.lessons.feedbackRating,
      feedbackText: schema.lessons.feedbackText,
    })
    .from(schema.lessons)
    .where(eq(schema.lessons.missionId, missionId))
    .orderBy(asc(schema.lessons.number), asc(schema.lessons.subNumber))

  const withFeedback = rows.filter((r: { feedbackRating: string | null }) => r.feedbackRating !== null)
  if (withFeedback.length === 0) return "No feedback has been recorded yet."

  return JSON.stringify(withFeedback.map((r: { number: number; subNumber: number | null; title: string; status: string; feedbackRating: string | null; feedbackText: string | null }) => ({
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

  const [lesson] = await db
    .select()
    .from(schema.lessons)
    .where(
      and(
        eq(schema.lessons.missionId, missionId),
        eq(schema.lessons.number, lessonNumber),
        isNull(schema.lessons.parentLessonId),
      )
    )
    .limit(1)

  if (!lesson) return `Lesson ${lessonNumber} not found.`

  await db
    .update(schema.lessons)
    .set({
      title: input.title as string,
      slug: input.slug as string,
      htmlContent: input.html_content as string,
      feedbackRating: null,
      feedbackText: null,
    })
    .where(eq(schema.lessons.id, lesson.id))

  return `Updated lesson ${String(lessonNumber).padStart(4, "0")}: "${input.title}". The new content is ready — the student should reload the lesson page to see it.`
}

async function askGuidedQuestion(ctx: ToolHandlerContext): Promise<string> {
  const { db, missionId, input } = ctx
  const options = [...(input.options as string[]), "Other (please specify)"]
  await db.insert(schema.guidedQuestions).values({
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

export function createToolExecutor(database: typeof db): ToolExecutor {
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
        return await handler({ db: database, missionId, input })
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
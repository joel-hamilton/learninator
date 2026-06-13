import { db, schema } from "../db/index.js";
import { eq, and, asc, count } from "drizzle-orm";
import type Anthropic from "@anthropic-ai/sdk";

type ToolInput = Record<string, unknown>;

export async function executeTool(
  missionId: number,
  toolName: string,
  input: ToolInput
): Promise<string> {
  switch (toolName) {
    case "read_mission_content": {
      const [row] = await db
        .select()
        .from(schema.missionContent)
        .where(
          and(
            eq(schema.missionContent.missionId, missionId),
            eq(schema.missionContent.contentType, input.content_type as "mission" | "notes" | "resources" | "glossary")
          )
        )
        .limit(1);
      return row?.markdownContent || "(empty)";
    }

    case "write_mission_content": {
      const [existing] = await db
        .select()
        .from(schema.missionContent)
        .where(
          and(
            eq(schema.missionContent.missionId, missionId),
            eq(schema.missionContent.contentType, input.content_type as "mission" | "notes" | "resources" | "glossary")
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(schema.missionContent)
          .set({ markdownContent: input.markdown_content as string, updatedAt: new Date().toISOString() })
          .where(eq(schema.missionContent.id, existing.id));
      } else {
        await db.insert(schema.missionContent).values({
          missionId,
          contentType: input.content_type as "mission" | "notes" | "resources" | "glossary",
          markdownContent: input.markdown_content as string,
        });
      }
      return `Saved ${input.content_type} content.`;
    }

    case "create_lesson": {
      const [lastLesson] = await db
        .select({ count: count() })
        .from(schema.lessons)
        .where(eq(schema.lessons.missionId, missionId));

      const num = (lastLesson?.count || 0) + 1;

      await db.insert(schema.lessons).values({
        missionId,
        number: num,
        title: input.title as string,
        slug: input.slug as string,
        htmlContent: input.html_content as string,
      });

      return `Created lesson ${String(num).padStart(4, "0")}: "${input.title}". The user can now view it.`;
    }

    case "read_lesson": {
      const [lesson] = await db
        .select()
        .from(schema.lessons)
        .where(
          and(
            eq(schema.lessons.missionId, missionId),
            eq(schema.lessons.number, input.number as number)
          )
        )
        .limit(1);

      if (!lesson) return "Lesson not found.";
      return JSON.stringify({
        number: lesson.number,
        title: lesson.title,
        slug: lesson.slug,
        status: lesson.status,
        html_content: lesson.htmlContent,
      });
    }

    case "list_lessons": {
      const rows = await db
        .select({
          number: schema.lessons.number,
          title: schema.lessons.title,
          slug: schema.lessons.slug,
          status: schema.lessons.status,
          createdAt: schema.lessons.createdAt,
        })
        .from(schema.lessons)
        .where(eq(schema.lessons.missionId, missionId))
        .orderBy(asc(schema.lessons.number));

      return JSON.stringify(rows);
    }

    case "create_reference_doc": {
      await db.insert(schema.referenceDocs).values({
        missionId,
        title: input.title as string,
        slug: input.slug as string,
        htmlContent: input.html_content as string,
        docType: (input.doc_type as "cheatsheet" | "algorithm" | "routine" | "sequence" | "other") || "other",
      });
      return `Created reference doc: "${input.title}" (${input.doc_type}).`;
    }

    case "list_reference_docs": {
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
        .orderBy(asc(schema.referenceDocs.createdAt));

      return JSON.stringify(rows);
    }

    case "create_learning_record": {
      const [last] = await db
        .select({ count: count() })
        .from(schema.learningRecords)
        .where(eq(schema.learningRecords.missionId, missionId));

      const num = (last?.count || 0) + 1;

      await db.insert(schema.learningRecords).values({
        missionId,
        number: num,
        title: input.title as string,
        markdownContent: input.markdown_content as string,
      });

      return `Created learning record LR${String(num).padStart(4, "0")}: "${input.title}".`;
    }

    case "list_learning_records": {
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
        .orderBy(asc(schema.learningRecords.number));

      return JSON.stringify(rows);
    }

    case "update_learning_record": {
      const updateData: Record<string, unknown> = { status: input.status };
      if (input.status === "superseded" && input.superseded_by) {
        updateData.supersededBy = input.superseded_by;
      }

      await db
        .update(schema.learningRecords)
        .set(updateData)
        .where(
          and(
            eq(schema.learningRecords.missionId, missionId),
            eq(schema.learningRecords.number, input.number as number)
          )
        );

      return `Updated learning record LR${String(input.number).padStart(4, "0")} status to ${input.status}.`;
    }

    case "mark_mission_active": {
      await db
        .update(schema.missions)
        .set({ status: "active", updatedAt: new Date().toISOString() })
        .where(eq(schema.missions.id, missionId));

      return "Mission is now active. You can begin creating lessons.";
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}

export async function executeToolCalls(
  missionId: number,
  toolUseBlocks: Anthropic.ToolUseBlock[]
): Promise<Anthropic.ToolResultBlockParam[]> {
  const results: Anthropic.ToolResultBlockParam[] = [];

  for (const block of toolUseBlocks) {
    const result = await executeTool(missionId, block.name, block.input as Record<string, unknown>);
    results.push({
      type: "tool_result",
      tool_use_id: block.id,
      content: result,
    });
  }

  return results;
}

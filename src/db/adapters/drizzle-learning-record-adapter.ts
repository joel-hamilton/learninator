import { eq, asc, count } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "../schema.js";
import type { LearningRecordStore } from "../store.js";

export class DrizzleLearningRecordAdapter implements LearningRecordStore {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async createLearningRecord(values: {
    missionId: number; number: number; title: string;
    markdownContent: string; status?: string; supersededBy?: number | null;
  }) {
    const [row] = await this.db.insert(schema.learningRecords).values({
      missionId: values.missionId,
      number: values.number,
      title: values.title,
      markdownContent: values.markdownContent,
      status: (values.status as any) ?? "active",
      supersededBy: values.supersededBy ?? null,
    }).returning();
    return row;
  }

  async listLearningRecords(missionId: number) {
    return this.db.select().from(schema.learningRecords)
      .where(eq(schema.learningRecords.missionId, missionId))
      .orderBy(asc(schema.learningRecords.number));
  }

  async updateLearningRecord(id: number, values: { status?: string; supersededBy?: number | null }) {
    const setData: Record<string, unknown> = {};
    if (values.status !== undefined) setData.status = values.status;
    if (values.supersededBy !== undefined) setData.supersededBy = values.supersededBy;
    await this.db.update(schema.learningRecords).set(setData).where(eq(schema.learningRecords.id, id));
  }

  async getLearningRecordCount(missionId: number) {
    const [row] = await this.db.select({ c: count() })
      .from(schema.learningRecords)
      .where(eq(schema.learningRecords.missionId, missionId));
    return (row?.c as number) ?? 0;
  }
}

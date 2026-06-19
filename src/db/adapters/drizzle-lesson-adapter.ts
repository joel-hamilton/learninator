import { eq, and, asc, desc, isNull, count, max } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "../schema.js";
import type { LessonStore, LessonRow } from "../store.js";

export class DrizzleLessonAdapter implements LessonStore {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async createLesson(values: {
    missionId: number; number: number; title: string; slug: string;
    htmlContent: string; status?: string; parentLessonId?: number; subNumber?: number;
  }) {
    const [row] = await this.db.insert(schema.lessons).values({
      missionId: values.missionId,
      number: values.number,
      title: values.title,
      slug: values.slug,
      htmlContent: values.htmlContent,
      status: (values.status as any) ?? "active",
      parentLessonId: values.parentLessonId ?? null,
      subNumber: values.subNumber ?? null,
    }).returning();
    return row;
  }

  async getLesson(missionId: number, number: number, subNumber?: number | null) {
    const conditions = [eq(schema.lessons.missionId, missionId), eq(schema.lessons.number, number)];
    if (subNumber != null) {
      conditions.push(eq(schema.lessons.subNumber, subNumber));
    } else {
      conditions.push(isNull(schema.lessons.parentLessonId));
    }
    const [row] = await this.db.select().from(schema.lessons).where(and(...conditions)).limit(1);
    return row;
  }

  async getLatestLesson(missionId: number) {
    const [row] = await this.db.select().from(schema.lessons)
      .where(eq(schema.lessons.missionId, missionId))
      .orderBy(desc(schema.lessons.id))
      .limit(1);
    return row;
  }

  async listLessons(missionId: number) {
    return this.db.select().from(schema.lessons)
      .where(eq(schema.lessons.missionId, missionId))
      .orderBy(asc(schema.lessons.number), asc(schema.lessons.subNumber));
  }

  async listLessonSummaries(missionId: number) {
    return this.db.select({
      number: schema.lessons.number,
      subNumber: schema.lessons.subNumber,
      title: schema.lessons.title,
      status: schema.lessons.status,
    }).from(schema.lessons)
      .where(eq(schema.lessons.missionId, missionId))
      .orderBy(asc(schema.lessons.number), asc(schema.lessons.subNumber));
  }

  async getMaxLessonNumber(missionId: number) {
    const [row] = await this.db.select({ m: max(schema.lessons.number) })
      .from(schema.lessons)
      .where(eq(schema.lessons.missionId, missionId));
    return (row?.m as number) ?? 0;
  }

  async getSubLessonCount(missionId: number, parentLessonId: number) {
    const [row] = await this.db.select({ c: count() })
      .from(schema.lessons)
      .where(and(
        eq(schema.lessons.missionId, missionId),
        eq(schema.lessons.parentLessonId, parentLessonId),
      ));
    return (row?.c as number) ?? 0;
  }

  async getLessonCount(missionId: number) {
    const [row] = await this.db.select({ c: count() })
      .from(schema.lessons)
      .where(eq(schema.lessons.missionId, missionId));
    return (row?.c as number) ?? 0;
  }

  async getMainLessonCount(missionId: number) {
    const [row] = await this.db.select({ c: count() })
      .from(schema.lessons)
      .where(and(
        eq(schema.lessons.missionId, missionId),
        isNull(schema.lessons.parentLessonId),
      ));
    return (row?.c as number) ?? 0;
  }

  async getMaxSubNumber(parentLessonId: number) {
    const [row] = await this.db.select({ m: max(schema.lessons.subNumber) })
      .from(schema.lessons)
      .where(eq(schema.lessons.parentLessonId, parentLessonId));
    return (row?.m as number) ?? null;
  }

  async findLessonBySlug(missionId: number, slug: string) {
    const [row] = await this.db.select().from(schema.lessons)
      .where(and(eq(schema.lessons.missionId, missionId), eq(schema.lessons.slug, slug)))
      .limit(1);
    return row;
  }

  async updateLessonStatus(missionId: number, number: number, subNumber: number | null, status: string, completedAt?: string | null) {
    const conditions = [eq(schema.lessons.missionId, missionId), eq(schema.lessons.number, number)];
    if (subNumber !== null) {
      conditions.push(eq(schema.lessons.subNumber, subNumber));
    } else {
      conditions.push(isNull(schema.lessons.parentLessonId));
    }
    const setData: Record<string, unknown> = { status };
    if (completedAt !== undefined) setData.completedAt = completedAt;
    await this.db.update(schema.lessons).set(setData).where(and(...conditions));
  }

  async updateLessonFeedback(missionId: number, number: number, subNumber: number | null, rating: string, text?: string) {
    const conditions = [eq(schema.lessons.missionId, missionId), eq(schema.lessons.number, number)];
    if (subNumber !== null) {
      conditions.push(eq(schema.lessons.subNumber, subNumber));
    } else {
      conditions.push(isNull(schema.lessons.parentLessonId));
    }
    const setData: Record<string, unknown> = { feedbackRating: rating };
    if (text) setData.feedbackText = text;
    await this.db.update(schema.lessons).set(setData).where(and(...conditions));
  }

  async listLessonFeedback(missionId: number) {
    return this.db.select({
      number: schema.lessons.number,
      subNumber: schema.lessons.subNumber,
      title: schema.lessons.title,
      status: schema.lessons.status,
      feedbackRating: schema.lessons.feedbackRating,
      feedbackText: schema.lessons.feedbackText,
    }).from(schema.lessons)
      .where(eq(schema.lessons.missionId, missionId))
      .orderBy(asc(schema.lessons.number), asc(schema.lessons.subNumber));
  }

  async updateLessonContent(missionId: number, number: number, subNumber: number | null, title: string, slug: string, htmlContent: string) {
    const conditions = [eq(schema.lessons.missionId, missionId), eq(schema.lessons.number, number)];
    if (subNumber !== null) {
      conditions.push(eq(schema.lessons.subNumber, subNumber));
    } else {
      conditions.push(isNull(schema.lessons.parentLessonId));
    }
    await this.db.update(schema.lessons)
      .set({ title, slug, htmlContent })
      .where(and(...conditions));
  }
}

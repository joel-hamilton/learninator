import { eq, and, asc, count, isNull, max } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

// ── Data transfer types ──────────────────────────────────────────

export interface LessonRow {
  number: number;
  subNumber: number | null;
  title: string;
  slug: string;
  status: string;
  htmlContent: string;
}

export interface LessonSummary {
  number: number;
  subNumber: number | null;
  title: string;
  slug: string;
  status: string;
  createdAt: string;
}

export interface ReferenceDocSummary {
  id: number;
  title: string;
  slug: string;
  docType: string;
  createdAt: string;
}

export interface LearningRecordSummary {
  number: number;
  title: string;
  status: string;
  supersededBy: number | null;
  createdAt: string;
}

export interface InsertLessonData {
  missionId: number;
  number: number;
  title: string;
  slug: string;
  htmlContent: string;
  parentLessonId?: number | null;
  subNumber?: number | null;
}

export interface InsertReferenceDocData {
  missionId: number;
  title: string;
  slug: string;
  htmlContent: string;
  docType: string;
}

export interface InsertLearningRecordData {
  missionId: number;
  number: number;
  title: string;
  markdownContent: string;
}

export interface UpdateLearningRecordData {
  status: string;
  supersededBy?: number | null;
}

export interface InsertGuidedQuestionData {
  missionId: number;
  question: string;
  options: string;
}

// ── MissionStore interface ───────────────────────────────────────

export interface MissionStore {
  readMissionContent(
    missionId: number,
    contentType: string,
  ): Promise<string | null>;

  upsertMissionContent(
    missionId: number,
    contentType: string,
    markdown: string,
  ): Promise<void>;

  getMainLessonCount(missionId: number): Promise<number>;

  getMainLessonByNumber(
    missionId: number,
    number: number,
  ): Promise<{ id: number } | null>;

  getMaxSubNumber(parentLessonId: number): Promise<number | null>;

  insertLesson(data: InsertLessonData): Promise<void>;

  getLesson(
    missionId: number,
    number: number,
    subNumber?: number,
  ): Promise<LessonRow | null>;

  listLessons(missionId: number): Promise<LessonSummary[]>;

  insertReferenceDoc(data: InsertReferenceDocData): Promise<void>;

  listReferenceDocs(missionId: number): Promise<ReferenceDocSummary[]>;

  getLearningRecordCount(missionId: number): Promise<number>;

  insertLearningRecord(data: InsertLearningRecordData): Promise<void>;

  listLearningRecords(missionId: number): Promise<LearningRecordSummary[]>;

  updateLearningRecord(
    missionId: number,
    number: number,
    data: UpdateLearningRecordData,
  ): Promise<void>;

  updateMissionStatus(missionId: number, status: string): Promise<void>;

  insertGuidedQuestion(data: InsertGuidedQuestionData): Promise<void>;
}

// ── Drizzle adapter ──────────────────────────────────────────────

export class DrizzleMissionStore implements MissionStore {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async readMissionContent(
    missionId: number,
    contentType: string,
  ): Promise<string | null> {
    const [row] = await this.db
      .select()
      .from(schema.missionContent)
      .where(
        and(
          eq(schema.missionContent.missionId, missionId),
          eq(schema.missionContent.contentType, contentType as any),
        ),
      )
      .limit(1);
    return row?.markdownContent ?? null;
  }

  async upsertMissionContent(
    missionId: number,
    contentType: string,
    markdown: string,
  ): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(schema.missionContent)
      .where(
        and(
          eq(schema.missionContent.missionId, missionId),
          eq(schema.missionContent.contentType, contentType as any),
        ),
      )
      .limit(1);

    if (existing) {
      await this.db
        .update(schema.missionContent)
        .set({
          markdownContent: markdown,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.missionContent.id, existing.id));
    } else {
      await this.db.insert(schema.missionContent).values({
        missionId,
        contentType: contentType as any,
        markdownContent: markdown,
      });
    }
  }

  async getMainLessonCount(missionId: number): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(schema.lessons)
      .where(
        and(
          eq(schema.lessons.missionId, missionId),
          isNull(schema.lessons.parentLessonId),
        ),
      );
    return result?.count ?? 0;
  }

  async getMainLessonByNumber(
    missionId: number,
    number: number,
  ): Promise<{ id: number } | null> {
    const [lesson] = await this.db
      .select({ id: schema.lessons.id })
      .from(schema.lessons)
      .where(
        and(
          eq(schema.lessons.missionId, missionId),
          eq(schema.lessons.number, number),
          isNull(schema.lessons.parentLessonId),
        ),
      )
      .limit(1);
    return lesson ?? null;
  }

  async getMaxSubNumber(parentLessonId: number): Promise<number | null> {
    const [result] = await this.db
      .select({ max: max(schema.lessons.subNumber) })
      .from(schema.lessons)
      .where(eq(schema.lessons.parentLessonId, parentLessonId));
    return result?.max ?? null;
  }

  async insertLesson(data: InsertLessonData): Promise<void> {
    await this.db.insert(schema.lessons).values({
      missionId: data.missionId,
      number: data.number,
      title: data.title,
      slug: data.slug,
      htmlContent: data.htmlContent,
      parentLessonId: data.parentLessonId ?? null,
      subNumber: data.subNumber ?? null,
    });
  }

  async getLesson(
    missionId: number,
    number: number,
    subNumber?: number,
  ): Promise<LessonRow | null> {
    const conditions = [
      eq(schema.lessons.missionId, missionId),
      eq(schema.lessons.number, number),
    ];
    if (subNumber !== undefined) {
      conditions.push(eq(schema.lessons.subNumber, subNumber));
    } else {
      conditions.push(isNull(schema.lessons.parentLessonId));
    }

    const [lesson] = await this.db
      .select()
      .from(schema.lessons)
      .where(and(...conditions))
      .limit(1);

    if (!lesson) return null;
    return {
      number: lesson.number,
      subNumber: lesson.subNumber,
      title: lesson.title,
      slug: lesson.slug,
      status: lesson.status,
      htmlContent: lesson.htmlContent,
    };
  }

  async listLessons(missionId: number): Promise<LessonSummary[]> {
    return await this.db
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
      .orderBy(asc(schema.lessons.number), asc(schema.lessons.subNumber));
  }

  async insertReferenceDoc(data: InsertReferenceDocData): Promise<void> {
    await this.db.insert(schema.referenceDocs).values({
      missionId: data.missionId,
      title: data.title,
      slug: data.slug,
      htmlContent: data.htmlContent,
      docType: data.docType as any,
    });
  }

  async listReferenceDocs(
    missionId: number,
  ): Promise<ReferenceDocSummary[]> {
    return await this.db
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
  }

  async getLearningRecordCount(missionId: number): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(schema.learningRecords)
      .where(eq(schema.learningRecords.missionId, missionId));
    return result?.count ?? 0;
  }

  async insertLearningRecord(
    data: InsertLearningRecordData,
  ): Promise<void> {
    await this.db.insert(schema.learningRecords).values({
      missionId: data.missionId,
      number: data.number,
      title: data.title,
      markdownContent: data.markdownContent,
    });
  }

  async listLearningRecords(
    missionId: number,
  ): Promise<LearningRecordSummary[]> {
    return await this.db
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
  }

  async updateLearningRecord(
    missionId: number,
    number: number,
    data: UpdateLearningRecordData,
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status: data.status };
    if (data.supersededBy !== undefined) {
      updateData.supersededBy = data.supersededBy;
    }

    await this.db
      .update(schema.learningRecords)
      .set(updateData)
      .where(
        and(
          eq(schema.learningRecords.missionId, missionId),
          eq(schema.learningRecords.number, number),
        ),
      );
  }

  async updateMissionStatus(
    missionId: number,
    status: string,
  ): Promise<void> {
    await this.db
      .update(schema.missions)
      .set({ status: status as any, updatedAt: new Date().toISOString() })
      .where(eq(schema.missions.id, missionId));
  }

  async insertGuidedQuestion(
    data: InsertGuidedQuestionData,
  ): Promise<void> {
    await this.db.insert(schema.guidedQuestions).values({
      missionId: data.missionId,
      question: data.question,
      options: data.options,
    });
  }
}

// ── In-memory adapter (for tests) ────────────────────────────────

export class InMemoryMissionStore implements MissionStore {
  private missionContents = new Map<
    string,
    { markdownContent: string; contentType: string }
  >();
  private lessons: Array<{
    id: number;
    missionId: number;
    number: number;
    subNumber: number | null;
    parentLessonId: number | null;
    title: string;
    slug: string;
    htmlContent: string;
    status: string;
    createdAt: string;
  }> = [];
  private referenceDocs: Array<{
    id: number;
    missionId: number;
    title: string;
    slug: string;
    htmlContent: string;
    docType: string;
    createdAt: string;
  }> = [];
  private learningRecords: Array<{
    missionId: number;
    number: number;
    title: string;
    markdownContent: string;
    status: string;
    supersededBy: number | null;
    createdAt: string;
  }> = [];
  private guidedQuestions: Array<{
    id: number;
    missionId: number;
    question: string;
    options: string;
  }> = [];

  private nextLessonId = 1;
  private nextRefDocId = 1;
  private nextGuidedQuestionId = 1;

  async readMissionContent(
    missionId: number,
    contentType: string,
  ): Promise<string | null> {
    return (
      this.missionContents.get(`${missionId}:${contentType}`)
        ?.markdownContent ?? null
    );
  }

  async upsertMissionContent(
    missionId: number,
    contentType: string,
    markdown: string,
  ): Promise<void> {
    this.missionContents.set(`${missionId}:${contentType}`, {
      markdownContent: markdown,
      contentType,
    });
  }

  async getMainLessonCount(missionId: number): Promise<number> {
    return this.lessons.filter(
      (l) => l.missionId === missionId && l.parentLessonId === null,
    ).length;
  }

  async getMainLessonByNumber(
    missionId: number,
    number: number,
  ): Promise<{ id: number } | null> {
    const lesson = this.lessons.find(
      (l) =>
        l.missionId === missionId &&
        l.number === number &&
        l.parentLessonId === null,
    );
    return lesson ? { id: lesson.id } : null;
  }

  async getMaxSubNumber(parentLessonId: number): Promise<number | null> {
    const subs = this.lessons.filter(
      (l) => l.parentLessonId === parentLessonId,
    );
    if (subs.length === 0) return null;
    return Math.max(...subs.map((s) => s.subNumber ?? 0));
  }

  async insertLesson(data: InsertLessonData): Promise<void> {
    const id = this.nextLessonId++;
    this.lessons.push({
      id,
      missionId: data.missionId,
      number: data.number,
      subNumber: data.subNumber ?? null,
      parentLessonId: data.parentLessonId ?? null,
      title: data.title,
      slug: data.slug,
      htmlContent: data.htmlContent,
      status: "active",
      createdAt: new Date().toISOString(),
    });
  }

  async getLesson(
    missionId: number,
    number: number,
    subNumber?: number,
  ): Promise<LessonRow | null> {
    const lesson = this.lessons.find((l) => {
      if (l.missionId !== missionId || l.number !== number) return false;
      if (subNumber !== undefined) return l.subNumber === subNumber;
      return l.parentLessonId === null;
    });
    if (!lesson) return null;
    return {
      number: lesson.number,
      subNumber: lesson.subNumber,
      title: lesson.title,
      slug: lesson.slug,
      status: lesson.status,
      htmlContent: lesson.htmlContent,
    };
  }

  async listLessons(missionId: number): Promise<LessonSummary[]> {
    return this.lessons
      .filter((l) => l.missionId === missionId)
      .sort((a, b) => {
        if (a.number !== b.number) return a.number - b.number;
        return (a.subNumber ?? -1) - (b.subNumber ?? -1);
      })
      .map((l) => ({
        number: l.number,
        subNumber: l.subNumber,
        title: l.title,
        slug: l.slug,
        status: l.status,
        createdAt: l.createdAt,
      }));
  }

  async insertReferenceDoc(data: InsertReferenceDocData): Promise<void> {
    const id = this.nextRefDocId++;
    this.referenceDocs.push({
      id,
      missionId: data.missionId,
      title: data.title,
      slug: data.slug,
      htmlContent: data.htmlContent,
      docType: data.docType,
      createdAt: new Date().toISOString(),
    });
  }

  async listReferenceDocs(
    missionId: number,
  ): Promise<ReferenceDocSummary[]> {
    return this.referenceDocs
      .filter((d) => d.missionId === missionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((d) => ({
        id: d.id,
        title: d.title,
        slug: d.slug,
        docType: d.docType,
        createdAt: d.createdAt,
      }));
  }

  async getLearningRecordCount(missionId: number): Promise<number> {
    return this.learningRecords.filter((r) => r.missionId === missionId)
      .length;
  }

  async insertLearningRecord(
    data: InsertLearningRecordData,
  ): Promise<void> {
    this.learningRecords.push({
      missionId: data.missionId,
      number: data.number,
      title: data.title,
      markdownContent: data.markdownContent,
      status: "active",
      supersededBy: null,
      createdAt: new Date().toISOString(),
    });
  }

  async listLearningRecords(
    missionId: number,
  ): Promise<LearningRecordSummary[]> {
    return this.learningRecords
      .filter((r) => r.missionId === missionId)
      .sort((a, b) => a.number - b.number)
      .map((r) => ({
        number: r.number,
        title: r.title,
        status: r.status,
        supersededBy: r.supersededBy,
        createdAt: r.createdAt,
      }));
  }

  async updateLearningRecord(
    missionId: number,
    number: number,
    data: UpdateLearningRecordData,
  ): Promise<void> {
    const record = this.learningRecords.find(
      (r) => r.missionId === missionId && r.number === number,
    );
    if (record) {
      record.status = data.status;
      if (data.supersededBy !== undefined) {
        record.supersededBy = data.supersededBy;
      }
    }
  }

  async updateMissionStatus(
    _missionId: number,
    _status: string,
  ): Promise<void> {
    // In-memory store does not manage missions; no-op is fine for tests.
  }

  async insertGuidedQuestion(
    data: InsertGuidedQuestionData,
  ): Promise<void> {
    const id = this.nextGuidedQuestionId++;
    this.guidedQuestions.push({
      id,
      missionId: data.missionId,
      question: data.question,
      options: data.options,
    });
  }
}

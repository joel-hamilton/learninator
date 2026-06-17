import { eq, and, asc, desc, isNull, count, max, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

// ── Re-export schema for Drizzle query building ──
export { schema };

// ── Domain types ──────────────────────────────────────────────────────

export type MissionRow = typeof schema.missions.$inferSelect;
export type NewMission = typeof schema.missions.$inferInsert;
export type LessonRow = typeof schema.lessons.$inferSelect;
export type NewLesson = typeof schema.lessons.$inferInsert;
export type LessonSummary = Pick<LessonRow, "number" | "subNumber" | "title" | "status">;
export type ChatMessageRow = typeof schema.chatMessages.$inferSelect;
export type NewChatMessage = typeof schema.chatMessages.$inferInsert;
export type GuidedQuestionRow = typeof schema.guidedQuestions.$inferSelect;
export type ReferenceDocRow = typeof schema.referenceDocs.$inferSelect;
export type NewReferenceDoc = typeof schema.referenceDocs.$inferInsert;
export type LearningRecordRow = typeof schema.learningRecords.$inferSelect;
export type NewLearningRecord = typeof schema.learningRecords.$inferInsert;
export type MissionContentRow = typeof schema.missionContent.$inferSelect;
export type NewMissionContent = typeof schema.missionContent.$inferInsert;
export type UserRow = typeof schema.users.$inferSelect;

// ── Store interface ───────────────────────────────────────────────────

export interface MissionStore {
  // Missions
  createMission(values: { userId: number; title: string; slug: string; status?: string; onboardingMode?: string }): Promise<MissionRow>;
  getMission(id: number, userId: number): Promise<MissionRow | undefined>;
  listMissions(userId: number, opts?: { status?: string; limit?: number }): Promise<MissionRow[]>;
  updateMissionTitle(id: number, title: string): Promise<void>;
  updateMissionOnboardingMode(id: number, mode: "guided" | "chat"): Promise<void>;
  updateMissionStatus(id: number, status: "onboarding" | "active" | "archived"): Promise<void>;
  deleteMission(id: number): Promise<void>;

  // Chat messages
  saveChatMessage(values: { missionId: number; role: "user" | "assistant"; content: string }): Promise<void>;
  getChatMessages(missionId: number): Promise<ChatMessageRow[]>;

  // Lessons
  createLesson(values: {
    missionId: number; number: number; title: string; slug: string;
    htmlContent: string; status?: string; parentLessonId?: number; subNumber?: number;
  }): Promise<LessonRow>;
  getLesson(missionId: number, number: number, subNumber: number | null): Promise<LessonRow | undefined>;
  getLatestLesson(missionId: number): Promise<LessonRow | undefined>;
  listLessons(missionId: number): Promise<LessonRow[]>;
  listLessonSummaries(missionId: number): Promise<LessonSummary[]>;
  getMaxLessonNumber(missionId: number): Promise<number>;
  getSubLessonCount(missionId: number, parentLessonId: number): Promise<number>;
  getLessonCount(missionId: number): Promise<number>;
  getMainLessonCount(missionId: number): Promise<number>;
  getLearningRecordCount(missionId: number): Promise<number>;
  findLessonBySlug(missionId: number, slug: string): Promise<LessonRow | undefined>;
  updateLessonStatus(missionId: number, number: number, subNumber: number | null, status: string, completedAt?: string | null): Promise<void>;
  updateLessonFeedback(missionId: number, number: number, subNumber: number | null, rating: string, text?: string): Promise<void>;

  // Guided questions
  createGuidedQuestion(values: { missionId: number; question: string; options: string }): Promise<GuidedQuestionRow>;
  getPendingQuestion(missionId: number): Promise<GuidedQuestionRow | undefined>;
  answerQuestion(id: number, answer: string, answerText?: string | null): Promise<void>;
  skipPendingQuestions(missionId: number): Promise<void>;

  // Reference docs
  createReferenceDoc(values: {
    missionId: number; title: string; slug: string;
    htmlContent: string; docType: string;
  }): Promise<ReferenceDocRow>;
  getReferenceDoc(id: number, missionId: number): Promise<ReferenceDocRow | undefined>;
  listReferenceDocs(missionId: number): Promise<ReferenceDocRow[]>;

  // Learning records
  createLearningRecord(values: {
    missionId: number; number: number; title: string;
    markdownContent: string; status?: string; supersededBy?: number | null;
  }): Promise<LearningRecordRow>;
  listLearningRecords(missionId: number): Promise<LearningRecordRow[]>;
  updateLearningRecord(id: number, values: { status?: string; supersededBy?: number | null }): Promise<void>;

  // Mission content
  getMissionContent(missionId: number, contentType: string): Promise<MissionContentRow | undefined>;
  upsertMissionContent(values: {
    missionId: number; contentType: string; markdownContent: string;
  }): Promise<void>;

  // Users
  getUser(id: number): Promise<UserRow | undefined>;
  getUserByEmail(email: string): Promise<UserRow | undefined>;
  createUser(values: { email: string; passwordHash: string; name?: string }): Promise<UserRow>;
  updateUser(id: number, values: { name?: string; email?: string; passwordHash?: string }): Promise<void>;
}

// ── Drizzle implementation ────────────────────────────────────────────

export class DrizzleMissionStore implements MissionStore {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  // Missions
  async createMission(values: { userId: number; title: string; slug: string; status?: string; onboardingMode?: string }) {
    const [row] = await this.db.insert(schema.missions).values({
      userId: values.userId,
      title: values.title,
      slug: values.slug,
      status: (values.status as "onboarding" | "active" | "archived") ?? "onboarding",
      onboardingMode: (values.onboardingMode as "guided" | "chat") ?? "guided",
    }).returning();
    return row;
  }

  async getMission(id: number, userId: number) {
    const [row] = await this.db.select().from(schema.missions)
      .where(and(eq(schema.missions.id, id), eq(schema.missions.userId, userId)))
      .limit(1);
    return row;
  }

  async listMissions(userId: number, opts?: { status?: string; limit?: number }) {
    const conditions = [eq(schema.missions.userId, userId)];
    if (opts?.status) conditions.push(eq(schema.missions.status, opts.status as any));
    const q = this.db.select().from(schema.missions).where(and(...conditions)).orderBy(desc(schema.missions.updatedAt));
    if (opts?.limit) return q.limit(opts.limit);
    return q;
  }

  async updateMissionTitle(id: number, title: string) {
    await this.db.update(schema.missions)
      .set({ title, updatedAt: new Date().toISOString() })
      .where(eq(schema.missions.id, id));
  }

  async updateMissionOnboardingMode(id: number, mode: "guided" | "chat") {
    await this.db.update(schema.missions)
      .set({ onboardingMode: mode, updatedAt: new Date().toISOString() })
      .where(eq(schema.missions.id, id));
  }

  async updateMissionStatus(id: number, status: "onboarding" | "active" | "archived") {
    await this.db.update(schema.missions)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(schema.missions.id, id));
  }

  async deleteMission(id: number) {
    await this.db.delete(schema.chatMessages).where(eq(schema.chatMessages.missionId, id));
    await this.db.delete(schema.guidedQuestions).where(eq(schema.guidedQuestions.missionId, id));
    await this.db.delete(schema.lessons).where(eq(schema.lessons.missionId, id));
    await this.db.delete(schema.referenceDocs).where(eq(schema.referenceDocs.missionId, id));
    await this.db.delete(schema.learningRecords).where(eq(schema.learningRecords.missionId, id));
    await this.db.delete(schema.missionContent).where(eq(schema.missionContent.missionId, id));
    await this.db.delete(schema.missions).where(eq(schema.missions.id, id));
  }

  // Chat messages
  async saveChatMessage(values: { missionId: number; role: "user" | "assistant"; content: string }) {
    await this.db.insert(schema.chatMessages).values({
      missionId: values.missionId,
      role: values.role,
      content: values.content,
    });
  }

  async getChatMessages(missionId: number) {
    return this.db.select().from(schema.chatMessages)
      .where(eq(schema.chatMessages.missionId, missionId))
      .orderBy(asc(schema.chatMessages.createdAt));
  }

  // Lessons
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

  async getLesson(missionId: number, number: number, subNumber: number | null) {
    const conditions = [eq(schema.lessons.missionId, missionId), eq(schema.lessons.number, number)];
    if (subNumber !== null) {
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

  async getLearningRecordCount(missionId: number) {
    const [row] = await this.db.select({ c: count() })
      .from(schema.learningRecords)
      .where(eq(schema.learningRecords.missionId, missionId));
    return (row?.c as number) ?? 0;
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

  // Guided questions
  async createGuidedQuestion(values: { missionId: number; question: string; options: string }) {
    const [row] = await this.db.insert(schema.guidedQuestions).values({
      missionId: values.missionId,
      question: values.question,
      options: values.options,
      status: "pending",
    }).returning();
    return row;
  }

  async getPendingQuestion(missionId: number) {
    const [row] = await this.db.select().from(schema.guidedQuestions)
      .where(and(eq(schema.guidedQuestions.missionId, missionId), eq(schema.guidedQuestions.status, "pending")))
      .orderBy(asc(schema.guidedQuestions.createdAt))
      .limit(1);
    return row;
  }

  async answerQuestion(id: number, answer: string, answerText?: string | null) {
    await this.db.update(schema.guidedQuestions)
      .set({ answer, answerText: answerText ?? null, status: "answered" })
      .where(eq(schema.guidedQuestions.id, id));
  }

  async skipPendingQuestions(missionId: number) {
    await this.db.update(schema.guidedQuestions)
      .set({ answer: "(skipped)", status: "answered" })
      .where(and(eq(schema.guidedQuestions.missionId, missionId), eq(schema.guidedQuestions.status, "pending")));
  }

  // Reference docs
  async createReferenceDoc(values: {
    missionId: number; title: string; slug: string; htmlContent: string; docType: string;
  }) {
    const [row] = await this.db.insert(schema.referenceDocs).values({
      missionId: values.missionId,
      title: values.title,
      slug: values.slug,
      htmlContent: values.htmlContent,
      docType: values.docType as any,
    }).returning();
    return row;
  }

  async getReferenceDoc(id: number, missionId: number) {
    const [row] = await this.db.select().from(schema.referenceDocs)
      .where(and(eq(schema.referenceDocs.id, id), eq(schema.referenceDocs.missionId, missionId)))
      .limit(1);
    return row;
  }

  async listReferenceDocs(missionId: number) {
    return this.db.select().from(schema.referenceDocs)
      .where(eq(schema.referenceDocs.missionId, missionId))
      .orderBy(asc(schema.referenceDocs.createdAt));
  }

  // Learning records
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

  // Mission content
  async getMissionContent(missionId: number, contentType: string) {
    const [row] = await this.db.select().from(schema.missionContent)
      .where(and(
        eq(schema.missionContent.missionId, missionId),
        eq(schema.missionContent.contentType, contentType as any),
      ))
      .limit(1);
    return row;
  }

  async upsertMissionContent(values: {
    missionId: number; contentType: string; markdownContent: string;
  }) {
    const [existing] = await this.db.select().from(schema.missionContent)
      .where(and(
        eq(schema.missionContent.missionId, values.missionId),
        eq(schema.missionContent.contentType, values.contentType as any),
      ))
      .limit(1);

    if (existing) {
      await this.db.update(schema.missionContent)
        .set({ markdownContent: values.markdownContent, updatedAt: new Date().toISOString() })
        .where(eq(schema.missionContent.id, existing.id));
    } else {
      await this.db.insert(schema.missionContent).values({
        missionId: values.missionId,
        contentType: values.contentType as any,
        markdownContent: values.markdownContent,
      });
    }
  }

  // Users
  async getUser(id: number) {
    const [row] = await this.db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return row;
  }

  async getUserByEmail(email: string) {
    const [row] = await this.db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    return row;
  }

  async createUser(values: { email: string; passwordHash: string; name?: string }) {
    const [row] = await this.db.insert(schema.users).values({
      email: values.email,
      passwordHash: values.passwordHash,
      name: values.name ?? "",
    }).returning();
    return row;
  }

  async updateUser(id: number, values: { name?: string; email?: string; passwordHash?: string }) {
    const setData: Record<string, unknown> = {};
    if (values.name !== undefined) setData.name = values.name;
    if (values.email !== undefined) setData.email = values.email;
    if (values.passwordHash !== undefined) setData.passwordHash = values.passwordHash;
    if (Object.keys(setData).length > 0) {
      await this.db.update(schema.users).set(setData).where(eq(schema.users.id, id));
    }
  }
}

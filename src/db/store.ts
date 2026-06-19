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
export type LessonFeedbackSummary = Pick<LessonRow, "number" | "subNumber" | "title" | "status" | "feedbackRating" | "feedbackText">;
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
export type SessionRow = typeof schema.sessions.$inferSelect;

// ── Focused store interfaces ───────────────────────────────────────────

export interface MissionStore {
  createMission(values: { userId: number; title: string; slug: string; status?: string; onboardingMode?: string }): Promise<MissionRow>;
  getMission(id: number, userId: number): Promise<MissionRow | undefined>;
  listMissions(userId: number, opts?: { status?: string; limit?: number }): Promise<MissionRow[]>;
  updateMissionTitle(id: number, title: string): Promise<void>;
  updateMissionOnboardingMode(id: number, mode: "guided" | "chat"): Promise<void>;
  updateMissionStatus(id: number, status: "onboarding" | "active" | "archived"): Promise<void>;
  deleteMission(id: number): Promise<void>;
}

export interface LessonStore {
  createLesson(values: {
    missionId: number; number: number; title: string; slug: string;
    htmlContent: string; status?: string; parentLessonId?: number; subNumber?: number;
  }): Promise<LessonRow>;
  getLesson(missionId: number, number: number, subNumber?: number | null): Promise<LessonRow | undefined>;
  getLatestLesson(missionId: number): Promise<LessonRow | undefined>;
  listLessons(missionId: number): Promise<LessonRow[]>;
  listLessonSummaries(missionId: number): Promise<LessonSummary[]>;
  getMaxLessonNumber(missionId: number): Promise<number>;
  getSubLessonCount(missionId: number, parentLessonId: number): Promise<number>;
  getLessonCount(missionId: number): Promise<number>;
  getMainLessonCount(missionId: number): Promise<number>;
  getMaxSubNumber(parentLessonId: number): Promise<number | null>;
  findLessonBySlug(missionId: number, slug: string): Promise<LessonRow | undefined>;
  updateLessonStatus(missionId: number, number: number, subNumber: number | null, status: string, completedAt?: string | null): Promise<void>;
  updateLessonFeedback(missionId: number, number: number, subNumber: number | null, rating: string, text?: string): Promise<void>;
  listLessonFeedback(missionId: number): Promise<LessonFeedbackSummary[]>;
  updateLessonContent(missionId: number, number: number, subNumber: number | null, title: string, slug: string, htmlContent: string): Promise<void>;
}

export interface ChatStore {
  saveChatMessage(values: { missionId: number; role: "user" | "assistant"; content: string }): Promise<void>;
  getChatMessages(missionId: number): Promise<ChatMessageRow[]>;
  createGuidedQuestion(values: { missionId: number; question: string; options: string }): Promise<GuidedQuestionRow>;
  getPendingQuestion(missionId: number): Promise<GuidedQuestionRow | undefined>;
  answerQuestion(id: number, answer: string, answerText?: string | null): Promise<void>;
  skipPendingQuestions(missionId: number): Promise<void>;
}

export interface ContentStore {
  getMissionContent(missionId: number, contentType: string): Promise<MissionContentRow | undefined>;
  upsertMissionContent(values: {
    missionId: number; contentType: string; markdownContent: string;
  }): Promise<void>;
}

export interface RefDocStore {
  createReferenceDoc(values: {
    missionId: number; title: string; slug: string;
    htmlContent: string; docType: string;
  }): Promise<ReferenceDocRow>;
  getReferenceDoc(id: number, missionId: number): Promise<ReferenceDocRow | undefined>;
  listReferenceDocs(missionId: number): Promise<ReferenceDocRow[]>;
}

export interface LearningRecordStore {
  createLearningRecord(values: {
    missionId: number; number: number; title: string;
    markdownContent: string; status?: string; supersededBy?: number | null;
  }): Promise<LearningRecordRow>;
  listLearningRecords(missionId: number): Promise<LearningRecordRow[]>;
  updateLearningRecord(id: number, values: { status?: string; supersededBy?: number | null }): Promise<void>;
  getLearningRecordCount(missionId: number): Promise<number>;
}

export interface UserStore {
  getUser(id: number): Promise<UserRow | undefined>;
  getUserByEmail(email: string): Promise<UserRow | undefined>;
  createUser(values: { email: string; passwordHash: string; name?: string }): Promise<UserRow>;
  updateUser(id: number, values: { name?: string; email?: string; passwordHash?: string }): Promise<void>;
}

export interface SessionStore {
  createSession(values: { userId: number; token: string; csrfToken: string; expiresAt: string }): Promise<SessionRow>;
  getSessionByToken(token: string): Promise<SessionRow | undefined>;
  deleteSession(token: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
}

// ── Drizzle composite implementation ───────────────────────────────────

export class DrizzleMissionStore implements MissionStore, LessonStore, ChatStore, ContentStore, RefDocStore, LearningRecordStore, UserStore, SessionStore {
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

  async getLearningRecordCount(missionId: number) {
    const [row] = await this.db.select({ c: count() })
      .from(schema.learningRecords)
      .where(eq(schema.learningRecords.missionId, missionId));
    return (row?.c as number) ?? 0;
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
    await this.db.insert(schema.missionContent).values({
      missionId: values.missionId,
      contentType: values.contentType as any,
      markdownContent: values.markdownContent,
    }).onConflictDoUpdate({
      target: [
        schema.missionContent.missionId,
        schema.missionContent.contentType,
      ],
      set: {
        markdownContent: values.markdownContent,
        updatedAt: new Date().toISOString(),
      },
    });
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

  // Sessions
  async createSession(values: { userId: number; token: string; csrfToken: string; expiresAt: string }) {
    const [row] = await this.db.insert(schema.sessions).values({
      userId: values.userId,
      token: values.token,
      csrfToken: values.csrfToken,
      expiresAt: values.expiresAt,
    }).returning();
    return row;
  }

  async getSessionByToken(token: string) {
    const [row] = await this.db.select().from(schema.sessions)
      .where(eq(schema.sessions.token, token))
      .limit(1);
    return row;
  }

  async deleteSession(token: string) {
    await this.db.delete(schema.sessions).where(eq(schema.sessions.token, token));
  }

  async deleteExpiredSessions() {
    await this.db.delete(schema.sessions)
      .where(/* expiresAt <= now */
        sql`${schema.sessions.expiresAt} <= ${new Date().toISOString()}`
      );
  }
}

// ── In-memory stores for tests ─────────────────────────────────────────

export class InMemoryMissionStore implements MissionStore {
  private missions: MissionRow[] = [];
  private nextId = 1;

  private id() { return this.nextId++; }

  async createMission(v: { userId: number; title: string; slug: string; status?: string; onboardingMode?: string }) { const m = { id: this.id(), ...v, status: v.status ?? "onboarding", onboardingMode: v.onboardingMode ?? "guided", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as MissionRow; this.missions.push(m); return m; }
  async getMission(id: number, _userId: number) { return this.missions.find(m => m.id === id); }
  async listMissions(userId: number, _opts?: { status?: string; limit?: number }) { return this.missions.filter(m => m.userId === userId); }
  async updateMissionTitle(id: number, title: string) { const m = this.missions.find(m => m.id === id); if (m) m.title = title; }
  async updateMissionOnboardingMode(id: number, mode: "guided" | "chat") { const m = this.missions.find(m => m.id === id); if (m) m.onboardingMode = mode; }
  async updateMissionStatus(id: number, status: "onboarding" | "active" | "archived") { const m = this.missions.find(m => m.id === id); if (m) m.status = status; }
  async deleteMission(id: number) { this.missions = this.missions.filter(m => m.id !== id); }
}

export class InMemoryLessonStore implements LessonStore {
  private lessons: LessonRow[] = [];
  private nextId = 1;

  private id() { return this.nextId++; }

  async createLesson(v: { missionId: number; number: number; title: string; slug: string; htmlContent: string; status?: string; parentLessonId?: number; subNumber?: number }) { const l = { id: this.id(), ...v, status: v.status ?? "active", subNumber: v.subNumber ?? null, parentLessonId: v.parentLessonId ?? null, feedbackRating: null, feedbackText: null, completedAt: null, createdAt: new Date().toISOString() } as LessonRow; this.lessons.push(l); return l; }
  async getLesson(missionId: number, number: number, subNumber?: number | null) { return this.lessons.find(l => l.missionId === missionId && l.number === number && (subNumber == null ? l.parentLessonId === null : l.subNumber === subNumber)); }
  async getLatestLesson(missionId: number) { const ls = this.lessons.filter(l => l.missionId === missionId); return ls.length > 0 ? ls.reduce((a, b) => a.id > b.id ? a : b) : undefined; }
  async listLessons(missionId: number) { return this.lessons.filter(l => l.missionId === missionId).sort((a: LessonRow, b: LessonRow) => a.number - b.number || (a.subNumber ?? 0) - (b.subNumber ?? 0)); }
  async listLessonSummaries(missionId: number) { return (await this.listLessons(missionId)).map(l => ({ number: l.number, subNumber: l.subNumber, title: l.title, status: l.status })); }
  async getMaxLessonNumber(missionId: number) { const ls = this.lessons.filter(l => l.missionId === missionId); return ls.length > 0 ? Math.max(...ls.map(l => l.number)) : 0; }
  async getSubLessonCount(missionId: number, parentLessonId: number) { return this.lessons.filter(l => l.missionId === missionId && l.parentLessonId === parentLessonId).length; }
  async getLessonCount(missionId: number) { return this.lessons.filter(l => l.missionId === missionId).length; }
  async getMainLessonCount(missionId: number) { return this.lessons.filter(l => l.missionId === missionId && l.parentLessonId === null).length; }
  async getMaxSubNumber(parentLessonId: number) { const subs = this.lessons.filter(l => l.parentLessonId === parentLessonId); return subs.length > 0 ? Math.max(...subs.map(l => l.subNumber ?? 0)) : null; }
  async findLessonBySlug(missionId: number, slug: string) { return this.lessons.find(l => l.missionId === missionId && l.slug === slug); }
  async updateLessonStatus(missionId: number, number: number, subNumber: number | null, status: string, completedAt?: string | null) { const l = await this.getLesson(missionId, number, subNumber); if (l) { l.status = status as any; if (completedAt !== undefined) l.completedAt = completedAt; } }
  async updateLessonFeedback(missionId: number, number: number, subNumber: number | null, rating: string, text?: string) { const l = await this.getLesson(missionId, number, subNumber); if (l) { l.feedbackRating = rating as any; if (text) l.feedbackText = text; } }
  async listLessonFeedback(missionId: number) { return (await this.listLessons(missionId)).map(l => ({ number: l.number, subNumber: l.subNumber, title: l.title, status: l.status, feedbackRating: l.feedbackRating, feedbackText: l.feedbackText })); }
  async updateLessonContent(missionId: number, number: number, subNumber: number | null, title: string, slug: string, htmlContent: string) { const l = await this.getLesson(missionId, number, subNumber); if (l) { l.title = title; l.slug = slug; l.htmlContent = htmlContent; } }
}

export class InMemoryChatStore implements ChatStore {
  private chatMessages: ChatMessageRow[] = [];
  private guidedQuestions: GuidedQuestionRow[] = [];
  private nextId = 1;

  private id() { return this.nextId++; }

  async saveChatMessage(v: { missionId: number; role: "user" | "assistant"; content: string }) { this.chatMessages.push({ id: this.id(), ...v, createdAt: new Date().toISOString() }); }
  async getChatMessages(missionId: number) { return this.chatMessages.filter(m => m.missionId === missionId).sort((a: ChatMessageRow, b: ChatMessageRow) => a.createdAt.localeCompare(b.createdAt)); }

  async createGuidedQuestion(v: { missionId: number; question: string; options: string }) { const q = { id: this.id(), ...v, answer: null, answerText: null, status: "pending", createdAt: new Date().toISOString() } as GuidedQuestionRow; this.guidedQuestions.push(q); return q; }
  async getPendingQuestion(missionId: number) { return this.guidedQuestions.find(q => q.missionId === missionId && q.status === "pending"); }
  async answerQuestion(id: number, answer: string, answerText?: string | null) { const q = this.guidedQuestions.find(q => q.id === id); if (q) { q.answer = answer; q.answerText = answerText ?? null; q.status = "answered"; } }
  async skipPendingQuestions(missionId: number) { this.guidedQuestions.filter(q => q.missionId === missionId && q.status === "pending").forEach(q => { q.answer = "(skipped)"; q.status = "answered"; }); }
}

export class InMemoryContentStore implements ContentStore {
  private missionContents: MissionContentRow[] = [];
  private nextId = 1;

  private id() { return this.nextId++; }

  async getMissionContent(missionId: number, contentType: string) { return this.missionContents.find(c => c.missionId === missionId && c.contentType === contentType); }
  async upsertMissionContent(v: { missionId: number; contentType: string; markdownContent: string }) { const existing = this.missionContents.findIndex(c => c.missionId === v.missionId && c.contentType === v.contentType); if (existing >= 0) { this.missionContents[existing].markdownContent = v.markdownContent; } else { this.missionContents.push({ id: this.id(), ...v, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as MissionContentRow); } }
}

export class InMemoryRefDocStore implements RefDocStore {
  private referenceDocs: ReferenceDocRow[] = [];
  private nextId = 1;

  private id() { return this.nextId++; }

  async createReferenceDoc(v: { missionId: number; title: string; slug: string; htmlContent: string; docType: string }) { const r = { id: this.id(), ...v, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as ReferenceDocRow; this.referenceDocs.push(r); return r; }
  async getReferenceDoc(id: number, missionId: number) { return this.referenceDocs.find(r => r.id === id && r.missionId === missionId); }
  async listReferenceDocs(missionId: number) { return this.referenceDocs.filter(r => r.missionId === missionId).sort((a: ReferenceDocRow, b: ReferenceDocRow) => a.createdAt.localeCompare(b.createdAt)); }
}

export class InMemoryLearningRecordStore implements LearningRecordStore {
  private learningRecords: LearningRecordRow[] = [];
  private nextId = 1;

  private id() { return this.nextId++; }

  async createLearningRecord(v: { missionId: number; number: number; title: string; markdownContent: string; status?: string; supersededBy?: number | null }) { const r = { id: this.id(), ...v, status: v.status ?? "active", supersededBy: v.supersededBy ?? null, createdAt: new Date().toISOString() } as LearningRecordRow; this.learningRecords.push(r); return r; }
  async listLearningRecords(missionId: number) { return this.learningRecords.filter(r => r.missionId === missionId).sort((a: LearningRecordRow, b: LearningRecordRow) => a.number - b.number); }
  async updateLearningRecord(id: number, values: { status?: string; supersededBy?: number | null }) { const r = this.learningRecords.find(r => r.id === id); if (r) { if (values.status !== undefined) r.status = values.status as any; if (values.supersededBy !== undefined) r.supersededBy = values.supersededBy; } }
  async getLearningRecordCount(missionId: number) { return this.learningRecords.filter(r => r.missionId === missionId).length; }
}

export class InMemoryUserStore implements UserStore {
  private users: UserRow[] = [];
  private nextId = 1;

  private id() { return this.nextId++; }

  async getUser(id: number) { return this.users.find(u => u.id === id); }
  async getUserByEmail(email: string) { return this.users.find(u => u.email === email); }
  async createUser(v: { email: string; passwordHash: string; name?: string }) { const u = { id: this.id(), name: v.name ?? "", ...v, createdAt: new Date().toISOString() } as UserRow; this.users.push(u); return u; }
  async updateUser(id: number, values: { name?: string; email?: string; passwordHash?: string }) { const u = this.users.find(u => u.id === id); if (u) { if (values.name !== undefined) u.name = values.name; if (values.email !== undefined) u.email = values.email; if (values.passwordHash !== undefined) u.passwordHash = values.passwordHash; } }
}

// ── Composite in-memory store for tests that need the full ToolStore surface ──
// Delegates to individual InMemory* stores, mirroring DrizzleMissionStore's composition.

export class InMemoryToolStore implements MissionStore, LessonStore, ChatStore, ContentStore, RefDocStore, LearningRecordStore {
  private _m = new InMemoryMissionStore();
  private _l = new InMemoryLessonStore();
  private _c = new InMemoryChatStore();
  private _ct = new InMemoryContentStore();
  private _r = new InMemoryRefDocStore();
  private _lr = new InMemoryLearningRecordStore();

  // MissionStore
  createMission = (v: { userId: number; title: string; slug: string; status?: string; onboardingMode?: string }) => this._m.createMission(v);
  getMission = (id: number, userId: number) => this._m.getMission(id, userId);
  listMissions = (userId: number, opts?: { status?: string; limit?: number }) => this._m.listMissions(userId, opts);
  updateMissionTitle = (id: number, title: string) => this._m.updateMissionTitle(id, title);
  updateMissionOnboardingMode = (id: number, mode: "guided" | "chat") => this._m.updateMissionOnboardingMode(id, mode);
  updateMissionStatus = (id: number, status: "onboarding" | "active" | "archived") => this._m.updateMissionStatus(id, status);
  deleteMission = (id: number) => this._m.deleteMission(id);

  // LessonStore
  createLesson = (v: { missionId: number; number: number; title: string; slug: string; htmlContent: string; status?: string; parentLessonId?: number; subNumber?: number }) => this._l.createLesson(v);
  getLesson = (missionId: number, number: number, subNumber?: number | null) => this._l.getLesson(missionId, number, subNumber);
  getLatestLesson = (missionId: number) => this._l.getLatestLesson(missionId);
  listLessons = (missionId: number) => this._l.listLessons(missionId);
  listLessonSummaries = (missionId: number) => this._l.listLessonSummaries(missionId);
  getMaxLessonNumber = (missionId: number) => this._l.getMaxLessonNumber(missionId);
  getSubLessonCount = (missionId: number, parentLessonId: number) => this._l.getSubLessonCount(missionId, parentLessonId);
  getLessonCount = (missionId: number) => this._l.getLessonCount(missionId);
  getMainLessonCount = (missionId: number) => this._l.getMainLessonCount(missionId);
  getMaxSubNumber = (parentLessonId: number) => this._l.getMaxSubNumber(parentLessonId);
  findLessonBySlug = (missionId: number, slug: string) => this._l.findLessonBySlug(missionId, slug);
  updateLessonStatus = (missionId: number, number: number, subNumber: number | null, status: string, completedAt?: string | null) => this._l.updateLessonStatus(missionId, number, subNumber, status, completedAt);
  updateLessonFeedback = (missionId: number, number: number, subNumber: number | null, rating: string, text?: string) => this._l.updateLessonFeedback(missionId, number, subNumber, rating, text);
  listLessonFeedback = (missionId: number) => this._l.listLessonFeedback(missionId);
  updateLessonContent = (missionId: number, number: number, subNumber: number | null, title: string, slug: string, htmlContent: string) => this._l.updateLessonContent(missionId, number, subNumber, title, slug, htmlContent);

  // ChatStore
  saveChatMessage = (v: { missionId: number; role: "user" | "assistant"; content: string }) => this._c.saveChatMessage(v);
  getChatMessages = (missionId: number) => this._c.getChatMessages(missionId);
  createGuidedQuestion = (v: { missionId: number; question: string; options: string }) => this._c.createGuidedQuestion(v);
  getPendingQuestion = (missionId: number) => this._c.getPendingQuestion(missionId);
  answerQuestion = (id: number, answer: string, answerText?: string | null) => this._c.answerQuestion(id, answer, answerText);
  skipPendingQuestions = (missionId: number) => this._c.skipPendingQuestions(missionId);

  // ContentStore
  getMissionContent = (missionId: number, contentType: string) => this._ct.getMissionContent(missionId, contentType);
  upsertMissionContent = (v: { missionId: number; contentType: string; markdownContent: string }) => this._ct.upsertMissionContent(v);

  // RefDocStore
  createReferenceDoc = (v: { missionId: number; title: string; slug: string; htmlContent: string; docType: string }) => this._r.createReferenceDoc(v);
  getReferenceDoc = (id: number, missionId: number) => this._r.getReferenceDoc(id, missionId);
  listReferenceDocs = (missionId: number) => this._r.listReferenceDocs(missionId);

  // LearningRecordStore
  createLearningRecord = (v: { missionId: number; number: number; title: string; markdownContent: string; status?: string; supersededBy?: number | null }) => this._lr.createLearningRecord(v);
  listLearningRecords = (missionId: number) => this._lr.listLearningRecords(missionId);
  updateLearningRecord = (id: number, values: { status?: string; supersededBy?: number | null }) => this._lr.updateLearningRecord(id, values);
  getLearningRecordCount = (missionId: number) => this._lr.getLearningRecordCount(missionId);
}

export class InMemorySessionStore implements SessionStore {
  private sessions: SessionRow[] = [];
  private nextId = 1;

  private id() { return this.nextId++; }

  async createSession(v: { userId: number; token: string; csrfToken: string; expiresAt: string }) {
    const s = { id: this.id(), userId: v.userId, token: v.token, csrfToken: v.csrfToken, expiresAt: v.expiresAt, createdAt: new Date().toISOString() };
    this.sessions.push(s);
    return s;
  }
  async getSessionByToken(token: string) { return this.sessions.find(s => s.token === token); }
  async deleteSession(token: string) { this.sessions = this.sessions.filter(s => s.token !== token); }
  async deleteExpiredSessions() {
    const now = new Date().toISOString();
    this.sessions = this.sessions.filter(s => s.expiresAt > now);
  }
}

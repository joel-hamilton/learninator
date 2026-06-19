import * as schema from "./schema.js";

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

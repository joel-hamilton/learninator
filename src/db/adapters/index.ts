import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "../schema.js";
import type {
  MissionStore,
  LessonStore,
  ChatStore,
  ContentStore,
  RefDocStore,
  LearningRecordStore,
  UserStore,
  SessionStore,
} from "../store.js";

import { DrizzleMissionAdapter } from "./drizzle-mission-adapter.js";
import { DrizzleLessonAdapter } from "./drizzle-lesson-adapter.js";
import { DrizzleChatAdapter } from "./drizzle-chat-adapter.js";
import { DrizzleContentAdapter } from "./drizzle-content-adapter.js";
import { DrizzleRefDocAdapter } from "./drizzle-refdoc-adapter.js";
import { DrizzleLearningRecordAdapter } from "./drizzle-learning-record-adapter.js";
import { DrizzleUserAdapter } from "./drizzle-user-adapter.js";
import { DrizzleSessionAdapter } from "./drizzle-session-adapter.js";

// Re-export all adapter classes
export { DrizzleMissionAdapter };
export { DrizzleLessonAdapter };
export { DrizzleChatAdapter };
export { DrizzleContentAdapter };
export { DrizzleRefDocAdapter };
export { DrizzleLearningRecordAdapter };
export { DrizzleUserAdapter };
export { DrizzleSessionAdapter };

/**
 * Composite class that implements all 8 store interfaces by delegating
 * to individual Drizzle adapter instances.
 *
 * This is used as the `store` context value in createApp() for backward
 * compatibility with existing middleware and route handlers that read
 * via `c.get("store")`.
 */
export class DrizzleStore implements
  MissionStore,
  LessonStore,
  ChatStore,
  ContentStore,
  RefDocStore,
  LearningRecordStore,
  UserStore,
  SessionStore
{
  constructor(
    public readonly missionAdapter: DrizzleMissionAdapter,
    public readonly lessonAdapter: DrizzleLessonAdapter,
    public readonly chatAdapter: DrizzleChatAdapter,
    public readonly contentAdapter: DrizzleContentAdapter,
    public readonly refDocAdapter: DrizzleRefDocAdapter,
    public readonly learningRecordAdapter: DrizzleLearningRecordAdapter,
    public readonly userAdapter: DrizzleUserAdapter,
    public readonly sessionAdapter: DrizzleSessionAdapter,
  ) {}

  // MissionStore
  createMission = (values: Parameters<DrizzleMissionAdapter["createMission"]>[0]) => this.missionAdapter.createMission(values);
  getMission = (id: number, userId: number) => this.missionAdapter.getMission(id, userId);
  listMissions = (userId: number, opts?: { status?: string; limit?: number }) => this.missionAdapter.listMissions(userId, opts);
  updateMissionTitle = (id: number, title: string) => this.missionAdapter.updateMissionTitle(id, title);
  updateMissionOnboardingMode = (id: number, mode: "guided" | "chat") => this.missionAdapter.updateMissionOnboardingMode(id, mode);
  updateMissionStatus = (id: number, status: "onboarding" | "active" | "archived") => this.missionAdapter.updateMissionStatus(id, status);
  deleteMission = (id: number) => this.missionAdapter.deleteMission(id);

  // LessonStore
  createLesson = (values: Parameters<DrizzleLessonAdapter["createLesson"]>[0]) => this.lessonAdapter.createLesson(values);
  getLesson = (missionId: number, number: number, subNumber?: number | null) => this.lessonAdapter.getLesson(missionId, number, subNumber);
  getLatestLesson = (missionId: number) => this.lessonAdapter.getLatestLesson(missionId);
  listLessons = (missionId: number) => this.lessonAdapter.listLessons(missionId);
  listLessonSummaries = (missionId: number) => this.lessonAdapter.listLessonSummaries(missionId);
  getMaxLessonNumber = (missionId: number) => this.lessonAdapter.getMaxLessonNumber(missionId);
  getSubLessonCount = (missionId: number, parentLessonId: number) => this.lessonAdapter.getSubLessonCount(missionId, parentLessonId);
  getLessonCount = (missionId: number) => this.lessonAdapter.getLessonCount(missionId);
  getMainLessonCount = (missionId: number) => this.lessonAdapter.getMainLessonCount(missionId);
  getMaxSubNumber = (parentLessonId: number) => this.lessonAdapter.getMaxSubNumber(parentLessonId);
  findLessonBySlug = (missionId: number, slug: string) => this.lessonAdapter.findLessonBySlug(missionId, slug);
  updateLessonStatus = (missionId: number, number: number, subNumber: number | null, status: string, completedAt?: string | null) => this.lessonAdapter.updateLessonStatus(missionId, number, subNumber, status, completedAt);
  updateLessonFeedback = (missionId: number, number: number, subNumber: number | null, rating: string, text?: string) => this.lessonAdapter.updateLessonFeedback(missionId, number, subNumber, rating, text);
  listLessonFeedback = (missionId: number) => this.lessonAdapter.listLessonFeedback(missionId);
  updateLessonContent = (missionId: number, number: number, subNumber: number | null, title: string, slug: string, htmlContent: string) => this.lessonAdapter.updateLessonContent(missionId, number, subNumber, title, slug, htmlContent);

  // ChatStore
  saveChatMessage = (values: Parameters<DrizzleChatAdapter["saveChatMessage"]>[0]) => this.chatAdapter.saveChatMessage(values);
  getChatMessages = (missionId: number) => this.chatAdapter.getChatMessages(missionId);
  createGuidedQuestion = (values: Parameters<DrizzleChatAdapter["createGuidedQuestion"]>[0]) => this.chatAdapter.createGuidedQuestion(values);
  getPendingQuestion = (missionId: number) => this.chatAdapter.getPendingQuestion(missionId);
  answerQuestion = (id: number, answer: string, answerText?: string | null) => this.chatAdapter.answerQuestion(id, answer, answerText);
  skipPendingQuestions = (missionId: number) => this.chatAdapter.skipPendingQuestions(missionId);

  // ContentStore
  getMissionContent = (missionId: number, contentType: string) => this.contentAdapter.getMissionContent(missionId, contentType);
  upsertMissionContent = (values: Parameters<DrizzleContentAdapter["upsertMissionContent"]>[0]) => this.contentAdapter.upsertMissionContent(values);

  // RefDocStore
  createReferenceDoc = (values: Parameters<DrizzleRefDocAdapter["createReferenceDoc"]>[0]) => this.refDocAdapter.createReferenceDoc(values);
  getReferenceDoc = (id: number, missionId: number) => this.refDocAdapter.getReferenceDoc(id, missionId);
  listReferenceDocs = (missionId: number) => this.refDocAdapter.listReferenceDocs(missionId);

  // LearningRecordStore
  createLearningRecord = (values: Parameters<DrizzleLearningRecordAdapter["createLearningRecord"]>[0]) => this.learningRecordAdapter.createLearningRecord(values);
  listLearningRecords = (missionId: number) => this.learningRecordAdapter.listLearningRecords(missionId);
  updateLearningRecord = (id: number, values: { status?: string; supersededBy?: number | null }) => this.learningRecordAdapter.updateLearningRecord(id, values);
  getLearningRecordCount = (missionId: number) => this.learningRecordAdapter.getLearningRecordCount(missionId);

  // UserStore
  getUser = (id: number) => this.userAdapter.getUser(id);
  getUserByEmail = (email: string) => this.userAdapter.getUserByEmail(email);
  createUser = (values: Parameters<DrizzleUserAdapter["createUser"]>[0]) => this.userAdapter.createUser(values);
  updateUser = (id: number, values: { name?: string; email?: string; passwordHash?: string }) => this.userAdapter.updateUser(id, values);

  // SessionStore
  createSession = (values: Parameters<DrizzleSessionAdapter["createSession"]>[0]) => this.sessionAdapter.createSession(values);
  getSessionByToken = (token: string) => this.sessionAdapter.getSessionByToken(token);
  deleteSession = (token: string) => this.sessionAdapter.deleteSession(token);
  deleteExpiredSessions = () => this.sessionAdapter.deleteExpiredSessions();
}

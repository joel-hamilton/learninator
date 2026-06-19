import { eq, and, asc } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "../schema.js";
import type { ChatStore, GuidedQuestionRow } from "../store.js";

export class DrizzleChatAdapter implements ChatStore {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

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
}

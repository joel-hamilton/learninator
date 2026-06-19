import { eq, and, desc } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "../schema.js";
import type { MissionStore, MissionRow } from "../store.js";

export class DrizzleMissionAdapter implements MissionStore {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

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
}

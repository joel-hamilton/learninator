import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { FakeAiClient } from "../ai/fake.js";
import * as schema from "../db/schema.js";
import { createTestDb, createTestApp, seedUser, login, authedReq } from "./helpers.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

describe("chat", () => {
  let db: BetterSQLite3Database<typeof schema>;
  let app: ReturnType<typeof createTestApp>;
  let cookie: string;
  let missionId: number;

  beforeEach(async () => {
    db = createTestDb();
    await seedUser(db, "user@test.com", "password123");
  });

  async function setupActiveMission() {
    app = createTestApp(
      new FakeAiClient([FakeAiClient.textResponse("Here is the answer.")]),
      db,
    );
    cookie = await login(app, "user@test.com", "password123");
    const [mission] = await db
      .insert(schema.missions)
      .values({
        userId: 1,
        title: "Chat Test",
        slug: "chat-test",
        status: "active",
      })
      .returning();
    missionId = mission.id;
  }

  describe("simple reply", () => {
    beforeEach(async () => {
      await setupActiveMission();
    });

    it("returns assistant reply and saves messages", async () => {
      const res = await authedReq(
        app,
        cookie,
        "POST",
        `/missions/${missionId}/chat`,
        { message: "explain this" },
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Here is the answer.");

      // DB: at least user + assistant messages
      const messages = await db
        .select()
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.missionId, missionId));

      const roles = messages.map((m) => m.role);
      expect(roles).toContain("user");
      expect(roles).toContain("assistant");
      expect(messages.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("chat with tool use", () => {
    it("executes tools and returns final reply", async () => {
      app = createTestApp(
        new FakeAiClient([
          FakeAiClient.toolUseResponse("list_lessons"),
          FakeAiClient.textResponse("You have 0 lessons so far."),
        ]),
        db,
      );
      cookie = await login(app, "user@test.com", "password123");
      const [mission] = await db
        .insert(schema.missions)
        .values({
          userId: 1,
          title: "Tool Chat",
          slug: "tool-chat",
          status: "active",
        })
        .returning();
      missionId = mission.id;

      const res = await authedReq(
        app,
        cookie,
        "POST",
        `/missions/${missionId}/chat`,
        { message: "what lessons do I have?" },
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("0 lessons");

      const messages = await db
        .select()
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.missionId, missionId));
      expect(messages.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("chat activates onboarding mission", () => {
    it("activates mission and redirects", async () => {
      app = createTestApp(
        new FakeAiClient([
          FakeAiClient.toolUseResponse("mark_mission_active"),
          FakeAiClient.textResponse("Mission activated!"),
          FakeAiClient.textResponse("My Mission Title"),
        ]),
        db,
      );
      cookie = await login(app, "user@test.com", "password123");
      const [mission] = await db
        .insert(schema.missions)
        .values({
          userId: 1,
          title: "Onboard Chat",
          slug: "onboard-chat",
          status: "onboarding",
          onboardingMode: "chat",
        })
        .returning();
      missionId = mission.id;

      const res = await authedReq(
        app,
        cookie,
        "POST",
        `/missions/${missionId}/chat`,
        { message: "teach me guitar" },
      );

      expect(res.headers.get("HX-Redirect")).toBe(
        `/missions/${missionId}`,
      );

      const [updated] = await db
        .select()
        .from(schema.missions)
        .where(eq(schema.missions.id, missionId))
        .limit(1);
      expect(updated.status).toBe("active");
      expect(updated.title).toBe("My Mission Title");
    });
  });
});

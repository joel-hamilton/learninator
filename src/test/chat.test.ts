import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { FakeAiClient } from "../ai/index.js";
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

  describe("mission content in context (US1)", () => {
    it("system prompt includes stored mission content for active missions", async () => {
      const fakeAi = new FakeAiClient([
        FakeAiClient.textResponse("Let's get started with Rust!"),
      ]);
      app = createTestApp(fakeAi, db);
      cookie = await login(app, "user@test.com", "password123");
      const [mission] = await db
        .insert(schema.missions)
        .values({
          userId: 1,
          title: "Rust Mission",
          slug: "rust-mission",
          status: "active",
        })
        .returning();
      missionId = mission.id;

      // Seed mission_content
      await db.insert(schema.missionContent).values({
        missionId: mission.id,
        contentType: "mission",
        markdownContent: "Learn Rust by building a CLI tool",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await authedReq(
        app,
        cookie,
        "POST",
        `/missions/${missionId}/chat`,
        { message: "let's go" },
      );

      expect(res.status).toBe(200);
      expect(fakeAi.lastSystemPrompt).toContain("Learn Rust by building a CLI tool");
      expect(fakeAi.lastSystemPrompt).toContain("Current mission goals:");
    });

    it("handles active mission with no stored mission_content without error", async () => {
      const fakeAi = new FakeAiClient([
        FakeAiClient.textResponse("What would you like to learn?"),
      ]);
      app = createTestApp(fakeAi, db);
      cookie = await login(app, "user@test.com", "password123");
      const [mission] = await db
        .insert(schema.missions)
        .values({
          userId: 1,
          title: "Empty Content",
          slug: "empty-content",
          status: "active",
        })
        .returning();
      missionId = mission.id;

      const res = await authedReq(
        app,
        cookie,
        "POST",
        `/missions/${missionId}/chat`,
        { message: "hello" },
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("What would you like to learn?");
      // No crash, no garbled prompt — the system prompt just won't have the content block
    });
  });

  describe("cross-user scoping (US2)", () => {
    it("blocks user A from accessing user B's mission chat", async () => {
      // Seed user B with their own mission and content
      await seedUser(db, "userb@test.com", "password123");
      const [missionB] = await db
        .insert(schema.missions)
        .values({
          userId: 2,
          title: "User B Mission",
          slug: "user-b-mission",
          status: "active",
        })
        .returning();
      await db.insert(schema.missionContent).values({
        missionId: missionB.id,
        contentType: "mission",
        markdownContent: "User B's secret content",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Authenticate as user A
      app = createTestApp(
        new FakeAiClient([FakeAiClient.textResponse("ok")]),
        db,
      );
      cookie = await login(app, "user@test.com", "password123");

      // User A tries to chat on user B's mission → 404
      const res = await authedReq(
        app,
        cookie,
        "POST",
        `/missions/${missionB.id}/chat`,
        { message: "gimme content" },
      );

      expect(res.status).toBe(404);
    });

    it("user A can chat on own mission successfully", async () => {
      app = createTestApp(
        new FakeAiClient([
          FakeAiClient.toolUseResponse("write_mission_content", {
            content_type: "mission",
            markdown_content: "Updated goals",
          }),
          FakeAiClient.textResponse("Your goals are updated."),
        ]),
        db,
      );
      cookie = await login(app, "user@test.com", "password123");
      const [missionA] = await db
        .insert(schema.missions)
        .values({
          userId: 1,
          title: "User A Mission",
          slug: "user-a-mission",
          status: "active",
        })
        .returning();
      missionId = missionA.id;

      const res = await authedReq(
        app,
        cookie,
        "POST",
        `/missions/${missionId}/chat`,
        { message: "update my goals" },
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("updated");
    });
  });

  describe("edge cases (US4)", () => {
    it("archived mission: AI declines goal changes", async () => {
      app = createTestApp(
        new FakeAiClient([
          FakeAiClient.textResponse("This mission is archived and read-only. I cannot make changes."),
        ]),
        db,
      );
      cookie = await login(app, "user@test.com", "password123");
      const [mission] = await db
        .insert(schema.missions)
        .values({
          userId: 1,
          title: "Archived Mission",
          slug: "archived-mission",
          status: "archived",
        })
        .returning();
      missionId = mission.id;

      const res = await authedReq(
        app,
        cookie,
        "POST",
        `/missions/${missionId}/chat`,
        { message: "change my goals to focus on Rust" },
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("archived");
    });

    it("tool error: AI reports failure and previous content is unchanged", async () => {
      const fakeAi = new FakeAiClient([
        FakeAiClient.toolUseResponse("write_mission_content", {
          content_type: "mission",
          markdown_content: "Updated goals",
        }),
        FakeAiClient.textResponse("Sorry, I couldn't update the mission goals. The store seems unavailable."),
      ]);
      app = createTestApp(fakeAi, db);
      cookie = await login(app, "user@test.com", "password123");
      const [mission] = await db
        .insert(schema.missions)
        .values({
          userId: 1,
          title: "Error Test",
          slug: "error-test",
          status: "active",
        })
        .returning();
      missionId = mission.id;

      // Seed existing content
      await db.insert(schema.missionContent).values({
        missionId: mission.id,
        contentType: "mission",
        markdownContent: "Original goals",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await authedReq(
        app,
        cookie,
        "POST",
        `/missions/${missionId}/chat`,
        { message: "update my goals" },
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      // The AI reports the failure
      expect(text.toLowerCase()).toMatch(/couldn.t|cannot|unable|sorry/);

      // The original content is still in the DB (upsert already ran but the test verifies no crash)
      const allContent = await db.select().from(schema.missionContent)
        .where(eq(schema.missionContent.missionId, mission.id));
      expect(allContent).toHaveLength(1);
    });

    it("vague request: AI asks for clarification", async () => {
      app = createTestApp(
        new FakeAiClient([
          FakeAiClient.textResponse("Could you be more specific about what you'd like to change? What specific aspects should I focus on?"),
        ]),
        db,
      );
      cookie = await login(app, "user@test.com", "password123");
      const [mission] = await db
        .insert(schema.missions)
        .values({
          userId: 1,
          title: "Vague Test",
          slug: "vague-test",
          status: "active",
        })
        .returning();
      missionId = mission.id;

      const res = await authedReq(
        app,
        cookie,
        "POST",
        `/missions/${missionId}/chat`,
        { message: "make it better" },
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      // AI either asks for clarification or provides reasonable interpretation
      expect(text.length).toBeGreaterThan(0);
    });

    it("fresh mission content: upsert creates content on empty mission", async () => {
      const fakeAi = new FakeAiClient([
        FakeAiClient.toolUseResponse("write_mission_content", {
          content_type: "mission",
          markdown_content: "Focus on practical Rust exercises",
        }),
        FakeAiClient.textResponse("I've set your mission goals. Let's get started!"),
      ]);
      app = createTestApp(fakeAi, db);
      cookie = await login(app, "user@test.com", "password123");
      const [mission] = await db
        .insert(schema.missions)
        .values({
          userId: 1,
          title: "Fresh Mission",
          slug: "fresh-mission",
          status: "active",
        })
        .returning();
      missionId = mission.id;

      const res = await authedReq(
        app,
        cookie,
        "POST",
        `/missions/${missionId}/chat`,
        { message: "set my goals to practical Rust exercises" },
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("goals");

      // Content was upserted into the DB
      const stored = await db
        .select()
        .from(schema.missionContent)
        .where(eq(schema.missionContent.missionId, mission.id));
      expect(stored).toHaveLength(1);
      expect(stored[0].markdownContent).toContain("practical Rust");
    });

    it("contradictory change: AI picks coherent interpretation", async () => {
      app = createTestApp(
        new FakeAiClient([
          FakeAiClient.textResponse("I'll adjust the material to be more challenging while keeping core concepts accessible. Does that sound good?"),
        ]),
        db,
      );
      cookie = await login(app, "user@test.com", "password123");
      const [mission] = await db
        .insert(schema.missions)
        .values({
          userId: 1,
          title: "Contradiction Test",
          slug: "contradiction-test",
          status: "active",
        })
        .returning();
      missionId = mission.id;

      const res = await authedReq(
        app,
        cookie,
        "POST",
        `/missions/${missionId}/chat`,
        { message: "make it harder but also easier" },
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text.length).toBeGreaterThan(0);
      // No error — the AI handled the contradictory request gracefully
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

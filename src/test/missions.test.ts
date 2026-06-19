import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { FakeAiClient } from "../ai/fake.js";
import * as schema from "../db/schema.js";
import { createTestDb, createTestApp, seedUser, login, authedReq } from "./helpers.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

describe("missions", () => {
  let db: BetterSQLite3Database<typeof schema>;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    db = createTestDb();
  });

  describe("POST /missions", () => {
    it("guided mode: creates onboarding mission and redirects", async () => {
      app = createTestApp(
        new FakeAiClient([
          FakeAiClient.toolUseResponse("ask_guided_question", {
            question: "What do you want to learn?",
            options: ["Guitar", "Piano"],
          }),
        ]),
        db,
      );
      await seedUser(db, "user@test.com", "password123");
      const cookie = await login(app, "user@test.com", "password123");

      const res = await authedReq(app, cookie, "POST", "/missions", {
        message: "I want to learn guitar",
      });

      expect(res.headers.get("HX-Redirect")).toMatch(/^\/missions\/\d+$/);
      const missionId = parseInt(
        res.headers.get("HX-Redirect")!.split("/").pop()!,
      );

      const [mission] = await db
        .select()
        .from(schema.missions)
        .where(eq(schema.missions.id, missionId))
        .limit(1);
      expect(mission.status).toBe("onboarding");
      expect(mission.onboardingMode).toBe("guided");
    });

    it("chat mode: activates mission immediately", async () => {
      app = createTestApp(
        new FakeAiClient([
          FakeAiClient.toolUseResponse("mark_mission_active"),
          FakeAiClient.textResponse("Your mission is ready!"),
          FakeAiClient.textResponse("Learning Guitar"),
        ]),
        db,
      );
      await seedUser(db, "user@test.com", "password123");
      const cookie = await login(app, "user@test.com", "password123");

      const res = await authedReq(app, cookie, "POST", "/missions", {
        message: "I want to learn guitar",
        mode: "chat",
      });

      expect(res.headers.get("HX-Redirect")).toMatch(/^\/missions\/\d+$/);
      const missionId = parseInt(
        res.headers.get("HX-Redirect")!.split("/").pop()!,
      );

      const [mission] = await db
        .select()
        .from(schema.missions)
        .where(eq(schema.missions.id, missionId))
        .limit(1);
      expect(mission.status).toBe("active");
      expect(mission.title).toBe("Learning Guitar");
    });
  });

  describe("guided onboarding golden path", () => {
    it("completes full Q&A flow and activates", async () => {
      app = createTestApp(
        new FakeAiClient([
          // guided/start → Q1
          FakeAiClient.toolUseResponse("ask_guided_question", {
            question: "What do you want to learn?",
            options: ["Guitar", "Piano"],
          }),
          // answer Q1 → Q2
          FakeAiClient.toolUseResponse("ask_guided_question", {
            question: "Why do you want to learn?",
            options: ["Perform", "Hobby"],
          }),
          // answer Q2 → activate (write_mission_content + mark_mission_active + text + title)
          FakeAiClient.toolUseResponse("write_mission_content", {
            content_type: "mission",
            markdown_content: "# Guitar Mission",
          }),
          FakeAiClient.toolUseResponse("mark_mission_active"),
          FakeAiClient.textResponse("Mission ready!"),
          FakeAiClient.textResponse("My Guitar Mission"),
        ]),
        db,
      );
      await seedUser(db, "user@test.com", "password123");
      const cookie = await login(app, "user@test.com", "password123");

      // Create mission directly in DB (onboarding, guided)
      const [mission] = await db
        .insert(schema.missions)
        .values({
          userId: 1,
          title: "Learn Guitar",
          slug: "learn-guitar",
          status: "onboarding",
          onboardingMode: "guided",
        })
        .returning();
      const missionId = mission.id;

      // Step 1: POST guided/start → Q1 HTML
      const q1Res = await authedReq(
        app,
        cookie,
        "POST",
        `/missions/${missionId}/guided/start`,
      );
      expect(q1Res.status).toBe(200);
      const q1Text = await q1Res.text();
      expect(q1Text).toContain("What do you want to learn?");
      expect(q1Text).toContain("Guitar");

      // Step 2: POST guided/answer → Q2 HTML
      const [q1] = await db
        .select()
        .from(schema.guidedQuestions)
        .where(eq(schema.guidedQuestions.missionId, missionId))
        .limit(1);
      const q2Res = await authedReq(
        app,
        cookie,
        "POST",
        `/missions/${missionId}/guided/answer`,
        {
          question_id: String(q1.id),
          answer: "Guitar",
        },
      );
      expect(q2Res.status).toBe(200);
      const q2Text = await q2Res.text();
      expect(q2Text).toContain("Why do you want to learn?");

      // Step 3: POST guided/answer → redirect (activation)
      const [q2] = await db
        .select()
        .from(schema.guidedQuestions)
        .where(eq(schema.guidedQuestions.missionId, missionId))
        .orderBy(schema.guidedQuestions.id)
        .limit(1)
        .offset(1);
      const a3Res = await authedReq(
        app,
        cookie,
        "POST",
        `/missions/${missionId}/guided/answer`,
        {
          question_id: String(q2.id),
          answer: "Hobby",
        },
      );
      expect(a3Res.headers.get("HX-Redirect")).toBe(
        `/missions/${missionId}`,
      );

      // DB check: mission activated with generated title
      const [updated] = await db
        .select()
        .from(schema.missions)
        .where(eq(schema.missions.id, missionId))
        .limit(1);
      expect(updated.status).toBe("active");
      expect(updated.title).toBe("My Guitar Mission");
    });
  });

  describe("archive / restore / delete UI", () => {
    async function seedActive(title: string): Promise<number> {
      const [m] = await db
        .insert(schema.missions)
        .values({
          userId: 1,
          title,
          slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          status: "active",
          onboardingMode: "chat",
        })
        .returning();
      return m.id;
    }

    async function seedArchived(title: string): Promise<number> {
      const [m] = await db
        .insert(schema.missions)
        .values({
          userId: 1,
          title,
          slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          status: "archived",
          onboardingMode: "chat",
        })
        .returning();
      return m.id;
    }

    let cookie: string;
    beforeEach(async () => {
      app = createTestApp(new FakeAiClient([]), db);
      await seedUser(db, "user@test.com", "password123");
      cookie = await login(app, "user@test.com", "password123");
    });

    it("home page renders stable section containers with collapsed archived <details>", async () => {
      await seedActive("Active 1");
      await seedArchived("Archived 1");
      const res = await authedReq(app, cookie, "GET", "/");
      const html = await res.text();
      expect(html).toContain('id="active-section"');
      expect(html).toContain('id="archived-section"');
      // <details> present, no `open` attribute → collapsed by default
      expect(html).toMatch(/<details[^>]*class="archived-section"(?![^>]*\bopen\b)/);
      expect(html).toContain("Archived (1)");
    });

    it("home page omits <details> when there are no archived missions", async () => {
      await seedActive("Active 1");
      const res = await authedReq(app, cookie, "GET", "/");
      const html = await res.text();
      expect(html).toContain('id="archived-section"');
      expect(html).not.toContain("<details");
    });

    it("archive endpoint returns OOB swaps that populate both sections", async () => {
      const m = await seedActive("To Archive");
      const res = await authedReq(app, cookie, "POST", `/missions/${m}/archive`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('id="active-section"');
      expect(html).toContain('hx-swap-oob="innerHTML:#active-section"');
      expect(html).toContain('id="archived-section"');
      expect(html).toContain('hx-swap-oob="innerHTML:#archived-section"');
      expect(html).toContain("Archived (1)");
      expect(html).toContain("To Archive");
    });

    it("restore endpoint returns OOB swaps with mission moved to active", async () => {
      const m = await seedArchived("To Restore");
      const res = await authedReq(app, cookie, "POST", `/missions/${m}/restore`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('hx-swap-oob="innerHTML:#active-section"');
      expect(html).toContain('hx-swap-oob="innerHTML:#archived-section"');
      expect(html).toContain("To Restore");
      // Last restore: archived section becomes empty (no <details>)
      expect(html).not.toContain("<details");
    });

    it("delete endpoint returns OOB swaps reflecting removal", async () => {
      await seedArchived("Keep");
      const m = await seedArchived("Delete Me");
      const res = await authedReq(app, cookie, "POST", `/missions/${m}/delete`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('hx-swap-oob="innerHTML:#archived-section"');
      expect(html).toContain("Archived (1)");
      expect(html).toContain("Keep");
      expect(html).not.toContain("Delete Me");
    });

    it("archive then restore: count returns to zero and details element disappears", async () => {
      const m = await seedActive("Round Trip");
      const archiveRes = await authedReq(app, cookie, "POST", `/missions/${m}/archive`);
      const archiveHtml = await archiveRes.text();
      expect(archiveHtml).toContain("Archived (1)");

      const restoreRes = await authedReq(app, cookie, "POST", `/missions/${m}/restore`);
      const restoreHtml = await restoreRes.text();
      expect(restoreHtml).not.toContain("<details");
    });

    it("error responses (404) remain plain text, not HTML swaps", async () => {
      const res = await authedReq(app, cookie, "POST", "/missions/99999/archive");
      expect(res.status).toBe(404);
      const body = await res.text();
      expect(body).not.toContain("hx-swap-oob");
    });
  });

  describe("POST /missions/:id/guided/skip", () => {
    it("skips questions and activates mission", async () => {
      app = createTestApp(
        new FakeAiClient([
          FakeAiClient.toolUseResponse("mark_mission_active"),
          FakeAiClient.textResponse("Activated!"),
          FakeAiClient.textResponse("My Mission"),
        ]),
        db,
      );
      await seedUser(db, "user@test.com", "password123");
      const cookie = await login(app, "user@test.com", "password123");

      const [mission] = await db
        .insert(schema.missions)
        .values({
          userId: 1,
          title: "Skip Test",
          slug: "skip-test",
          status: "onboarding",
          onboardingMode: "guided",
        })
        .returning();

      // Seed a pending question
      await db.insert(schema.guidedQuestions).values({
        missionId: mission.id,
        question: "What topic?",
        options: JSON.stringify(["A", "B", "Other (please specify)"]),
        status: "pending",
      });

      const res = await authedReq(
        app,
        cookie,
        "POST",
        `/missions/${mission.id}/guided/skip`,
      );

      expect(res.headers.get("HX-Redirect")).toBe(
        `/missions/${mission.id}`,
      );

      const [updated] = await db
        .select()
        .from(schema.missions)
        .where(eq(schema.missions.id, mission.id))
        .limit(1);
      expect(updated.status).toBe("active");

      // Skipped question marked as answered
      const [skippedQ] = await db
        .select()
        .from(schema.guidedQuestions)
        .where(eq(schema.guidedQuestions.missionId, mission.id))
        .limit(1);
      expect(skippedQ.status).toBe("answered");
      expect(skippedQ.answer).toBe("(skipped)");
    });
  });

  describe("archive / restore / delete", () => {
    it("archive returns OOB swaps that populate #archived-section", async () => {
      const fakeAi = new FakeAiClient([]);
      app = createTestApp(fakeAi, db);
      await seedUser(db, "user@test.com", "password123");
      const cookie = await login(app, "user@test.com", "password123");

      const [mission] = await db.insert(schema.missions).values({
        userId: 1, title: "Test Mission", slug: "test-mission",
        status: "active", onboardingMode: "chat",
      }).returning();

      const res = await authedReq(app, cookie, "POST", `/missions/${mission.id}/archive`);
      expect(res.status).toBe(200);
      const html = await res.text();

      // Both sections are in the response with OOB attributes
      expect(html).toContain('hx-swap-oob="innerHTML:#active-section"');
      expect(html).toContain('hx-swap-oob="innerHTML:#archived-section"');
      // Archived section contains the archived card
      expect(html).toContain("Test Mission");
      expect(html).toContain("mission-card--archived");
      // Archived section has details wrapper with count
      expect(html).toContain("<details");
      expect(html).toContain("Archived (1)");
      // No open attribute on details (collapsed by default)
      expect(html).not.toContain("<details open");
    });

    it("archive when no archived missions exist creates section with first card", async () => {
      const fakeAi = new FakeAiClient([]);
      app = createTestApp(fakeAi, db);
      await seedUser(db, "user@test.com", "password123");
      const cookie = await login(app, "user@test.com", "password123");

      const [mission] = await db.insert(schema.missions).values({
        userId: 1, title: "Only Mission", slug: "only-mission",
        status: "active", onboardingMode: "chat",
      }).returning();

      const res = await authedReq(app, cookie, "POST", `/missions/${mission.id}/archive`);
      expect(res.status).toBe(200);
      const html = await res.text();

      // Archived section exists with one card
      expect(html).toContain("Archived (1)");
      expect(html).toContain("Only Mission");
      expect(html).toContain("mission-card--archived");
    });

    it("restore returns OOB swaps for both sections", async () => {
      const fakeAi = new FakeAiClient([]);
      app = createTestApp(fakeAi, db);
      await seedUser(db, "user@test.com", "password123");
      const cookie = await login(app, "user@test.com", "password123");

      const [mission] = await db.insert(schema.missions).values({
        userId: 1, title: "Archived Mission", slug: "archived-mission",
        status: "archived", onboardingMode: "chat",
      }).returning();

      const res = await authedReq(app, cookie, "POST", `/missions/${mission.id}/restore`);
      expect(res.status).toBe(200);
      const html = await res.text();

      // Both sections are in the response
      expect(html).toContain('hx-swap-oob="innerHTML:#active-section"');
      expect(html).toContain('hx-swap-oob="innerHTML:#archived-section"');
      // Restored card is now in active section (no archived class)
      expect(html).toContain("Archived Mission");
      // Active section has the card without archived class
      const activeSectionStart = html.indexOf('id="active-section"');
      const archivedSectionStart = html.indexOf('id="archived-section"');
      // The restored card should be in the active section
      const cardPos = html.indexOf("Archived Mission");
      expect(cardPos).toBeGreaterThan(activeSectionStart);
      expect(cardPos).toBeLessThan(archivedSectionStart);
    });

    it("restore of last archived returns empty #archived-section", async () => {
      const fakeAi = new FakeAiClient([]);
      app = createTestApp(fakeAi, db);
      await seedUser(db, "user@test.com", "password123");
      const cookie = await login(app, "user@test.com", "password123");

      const [mission] = await db.insert(schema.missions).values({
        userId: 1, title: "Last Archived", slug: "last-archived",
        status: "archived", onboardingMode: "chat",
      }).returning();

      const res = await authedReq(app, cookie, "POST", `/missions/${mission.id}/restore`);
      expect(res.status).toBe(200);
      const html = await res.text();

      // Archived section is empty (no <details> inside)
      expect(html).toContain('id="archived-section"');
      expect(html).not.toContain("<details");
      expect(html).not.toContain("Archived (");
    });

    it("delete returns OOB swap for updated #archived-section", async () => {
      const fakeAi = new FakeAiClient([]);
      app = createTestApp(fakeAi, db);
      await seedUser(db, "user@test.com", "password123");
      const cookie = await login(app, "user@test.com", "password123");

      // Create two archived missions — delete one
      await db.insert(schema.missions).values({
        userId: 1, title: "Keep Me", slug: "keep-me",
        status: "archived", onboardingMode: "chat",
      });
      const [toDelete] = await db.insert(schema.missions).values({
        userId: 1, title: "Delete Me", slug: "delete-me",
        status: "archived", onboardingMode: "chat",
      }).returning();

      const res = await authedReq(app, cookie, "POST", `/missions/${toDelete.id}/delete`);
      expect(res.status).toBe(200);
      const html = await res.text();

      // Archived section exists with remaining card
      expect(html).toContain('hx-swap-oob="innerHTML:#archived-section"');
      expect(html).toContain("Keep Me");
      expect(html).not.toContain("Delete Me");
      expect(html).toContain("Archived (1)");
    });

    it("delete of last archived returns empty #archived-section", async () => {
      const fakeAi = new FakeAiClient([]);
      app = createTestApp(fakeAi, db);
      await seedUser(db, "user@test.com", "password123");
      const cookie = await login(app, "user@test.com", "password123");

      const [mission] = await db.insert(schema.missions).values({
        userId: 1, title: "Solo Archived", slug: "solo-archived",
        status: "archived", onboardingMode: "chat",
      }).returning();

      const res = await authedReq(app, cookie, "POST", `/missions/${mission.id}/delete`);
      expect(res.status).toBe(200);
      const html = await res.text();

      // Archived section is empty
      expect(html).toContain('id="archived-section"');
      expect(html).not.toContain("<details");
      expect(html).not.toContain("Archived (");
    });

    it("archive 404 returns text not HTML", async () => {
      const fakeAi = new FakeAiClient([]);
      app = createTestApp(fakeAi, db);
      await seedUser(db, "user@test.com", "password123");
      const cookie = await login(app, "user@test.com", "password123");

      const res = await authedReq(app, cookie, "POST", "/missions/99999/archive");
      expect(res.status).toBe(404);
      const contentType = res.headers.get("Content-Type") || "";
      expect(contentType).toContain("text/plain");
    });

    it("archive 400 (already archived) returns text not HTML", async () => {
      const fakeAi = new FakeAiClient([]);
      app = createTestApp(fakeAi, db);
      await seedUser(db, "user@test.com", "password123");
      const cookie = await login(app, "user@test.com", "password123");

      const [mission] = await db.insert(schema.missions).values({
        userId: 1, title: "Already Archived", slug: "already-archived",
        status: "archived", onboardingMode: "chat",
      }).returning();

      const res = await authedReq(app, cookie, "POST", `/missions/${mission.id}/archive`);
      expect(res.status).toBe(400);
      const contentType = res.headers.get("Content-Type") || "";
      expect(contentType).toContain("text/plain");
    });

    it("delete 400 (not archived) returns text not HTML", async () => {
      const fakeAi = new FakeAiClient([]);
      app = createTestApp(fakeAi, db);
      await seedUser(db, "user@test.com", "password123");
      const cookie = await login(app, "user@test.com", "password123");

      const [mission] = await db.insert(schema.missions).values({
        userId: 1, title: "Active Mission", slug: "active-mission",
        status: "active", onboardingMode: "chat",
      }).returning();

      const res = await authedReq(app, cookie, "POST", `/missions/${mission.id}/delete`);
      expect(res.status).toBe(400);
      const contentType = res.headers.get("Content-Type") || "";
      expect(contentType).toContain("text/plain");
    });
  });

  describe("home page sections", () => {
    it("renders #active-section and #archived-section containers", async () => {
      const fakeAi = new FakeAiClient([]);
      app = createTestApp(fakeAi, db);
      await seedUser(db, "user@test.com", "password123");
      const cookie = await login(app, "user@test.com", "password123");

      // With at least one active mission
      await db.insert(schema.missions).values({
        userId: 1, title: "Active", slug: "active",
        status: "active", onboardingMode: "chat",
      });

      const res = await authedReq(app, cookie, "GET", "/");
      expect(res.status).toBe(200);
      const html = await res.text();

      expect(html).toContain('id="active-section"');
      expect(html).toContain('id="archived-section"');
    });

    it("renders <details> without open attribute when archived missions exist", async () => {
      const fakeAi = new FakeAiClient([]);
      app = createTestApp(fakeAi, db);
      await seedUser(db, "user@test.com", "password123");
      const cookie = await login(app, "user@test.com", "password123");

      await db.insert(schema.missions).values({
        userId: 1, title: "Archived One", slug: "archived-one",
        status: "archived", onboardingMode: "chat",
      });

      const res = await authedReq(app, cookie, "GET", "/");
      expect(res.status).toBe(200);
      const html = await res.text();

      // <details> present without open attribute
      expect(html).toContain("<details");
      expect(html).not.toContain("<details open");
      expect(html).toContain("Archived (1)");
      expect(html).toContain("Archived One");
    });

    it("renders empty #archived-section when no archived missions exist", async () => {
      const fakeAi = new FakeAiClient([]);
      app = createTestApp(fakeAi, db);
      await seedUser(db, "user@test.com", "password123");
      const cookie = await login(app, "user@test.com", "password123");

      await db.insert(schema.missions).values({
        userId: 1, title: "Active Only", slug: "active-only",
        status: "active", onboardingMode: "chat",
      });

      const res = await authedReq(app, cookie, "GET", "/");
      expect(res.status).toBe(200);
      const html = await res.text();

      // Archived section exists but is empty (no <details> inside)
      expect(html).toContain('id="archived-section"');
      expect(html).not.toContain("<details");
      expect(html).not.toContain("Archived (");
    });

    it("archived section count stays correct after multiple archives", async () => {
      const fakeAi = new FakeAiClient([]);
      app = createTestApp(fakeAi, db);
      await seedUser(db, "user@test.com", "password123");
      const cookie = await login(app, "user@test.com", "password123");

      const [m1] = await db.insert(schema.missions).values({
        userId: 1, title: "M1", slug: "m1",
        status: "active", onboardingMode: "chat",
      }).returning();
      const [m2] = await db.insert(schema.missions).values({
        userId: 1, title: "M2", slug: "m2",
        status: "active", onboardingMode: "chat",
      }).returning();

      // Archive first
      const r1 = await authedReq(app, cookie, "POST", `/missions/${m1.id}/archive`);
      expect(await r1.text()).toContain("Archived (1)");

      // Archive second
      const r2 = await authedReq(app, cookie, "POST", `/missions/${m2.id}/archive`);
      const html2 = await r2.text();
      expect(html2).toContain("Archived (2)");
      expect(html2).toContain("M1");
      expect(html2).toContain("M2");
    });
  });
});

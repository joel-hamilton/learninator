import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.js";
import { FakeAiClient } from "../ai/fake.js";
import { createToolExecutor } from "../ai/tools.js";
import { DrizzleMissionStore } from "../db/store.js";
import { createOnboarding } from "./index.js";
import type { OnboardingModule } from "./index.js";
import type { AiClient, AiMessage } from "../ai/types.js";
import { createLogger } from "../logger.js";

// ── Helpers ──

const logger = createLogger("test");

/** An AI client that always throws an error. */
class ThrowingAiClient implements AiClient {
  async chat(): Promise<string> { throw new Error("AI failed"); }
  async chatWithTools(): Promise<AiMessage> { throw new Error("AI failed"); }
  async continueWithToolResults(): Promise<AiMessage> { throw new Error("AI failed"); }
}

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'onboarding',
      onboarding_mode TEXT NOT NULL DEFAULT 'guided',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE mission_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL REFERENCES missions(id),
      content_type TEXT NOT NULL,
      markdown_content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL REFERENCES missions(id),
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      html_content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      parent_lesson_id INTEGER REFERENCES lessons(id),
      sub_number INTEGER,
      feedback_rating TEXT,
      feedback_text TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE reference_docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL REFERENCES missions(id),
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      html_content TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE learning_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL REFERENCES missions(id),
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      markdown_content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      superseded_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL REFERENCES missions(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE guided_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL REFERENCES missions(id),
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      answer TEXT,
      answer_text TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO users (id, email, password_hash) VALUES (1, 'test@test.com', 'hash');
  `);

  return drizzle(sqlite, { schema });
}

async function seedMission(db: any, overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    id: 1,
    userId: 1,
    title: "Test Mission",
    slug: "test-mission",
    status: "onboarding",
    onboardingMode: "guided",
  };
  const vals = { ...defaults, ...overrides };
  await db.insert(schema.missions).values(vals);
}

async function getMission(db: any, id: number) {
  const rows = await db
    .select()
    .from(schema.missions)
    .where(eq(schema.missions.id, id))
    .limit(1);
  return rows[0] || null;
}

async function getGuidedQuestions(db: any, missionId: number) {
  return await db
    .select()
    .from(schema.guidedQuestions)
    .where(eq(schema.guidedQuestions.missionId, missionId));
}

async function getChatMessages(db: any, missionId: number) {
  return await db
    .select()
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.missionId, missionId));
}

describe("onboarding module", () => {
  let db: any;
  let executor: ReturnType<typeof createToolExecutor>;
  let onboarding: OnboardingModule;

  beforeEach(() => {
    db = createTestDb();
    executor = createToolExecutor(new DrizzleMissionStore(db));
  });

  describe("start", () => {
    it("redirects after saving the initial message (guided mode)", async () => {
      await seedMission(db);

      const client = new FakeAiClient([
        FakeAiClient.toolUseResponse("ask_guided_question", {
          question: "What do you want to learn?",
          options: ["Guitar", "Piano", "Drums"],
        }),
      ]);
      onboarding = createOnboarding({ ai: client, toolExecutor: executor, db, logger });

      const result = await onboarding.start(1, "I want to learn guitar", "guided");

      expect(result.type).toBe("redirect");
      expect((result as any).url).toBe("/missions/1");

      // Verify user message was saved
      const msgs = await getChatMessages(db, 1);
      expect(msgs.length).toBeGreaterThan(0);
      expect(msgs[0].role).toBe("user");
    });

    it("redirects after saving the initial message (chat mode)", async () => {
      await seedMission(db);

      const client = new FakeAiClient([
        FakeAiClient.textResponse("Tell me more about what you'd like to learn."),
      ]);
      onboarding = createOnboarding({ ai: client, toolExecutor: executor, db, logger });

      const result = await onboarding.start(1, "I want to learn piano", "chat");

      expect(result.type).toBe("redirect");
      const msgs = await getChatMessages(db, 1);
      expect(msgs.length).toBeGreaterThan(0);
    });

    it("activates and redirects when AI calls mark_mission_active directly", async () => {
      await seedMission(db);

      const client = new FakeAiClient([
        FakeAiClient.toolUseResponse("mark_mission_active"),
        FakeAiClient.textResponse("Mission activated!"),
        FakeAiClient.textResponse("Learning Guitar"),
      ]);
      onboarding = createOnboarding({ ai: client, toolExecutor: executor, db, logger });

      const result = await onboarding.start(1, "I want to learn guitar", "chat");

      expect(result.type).toBe("redirect");

      // Verify mission was activated
      const mission = await getMission(db, 1);
      expect(mission.status).toBe("active");
    });
  });

  describe("continueGuided", () => {
    it("returns a question when AI calls ask_guided_question", async () => {
      await seedMission(db);

      const client = new FakeAiClient([
        FakeAiClient.toolUseResponse("ask_guided_question", {
          question: "What is your experience level?",
          options: ["Beginner", "Intermediate", "Advanced"],
        }),
      ]);
      onboarding = createOnboarding({ ai: client, toolExecutor: executor, db, logger });

      const result = await onboarding.continueGuided(1);

      expect(result.type).toBe("question");
      if (result.type === "question") {
        expect(result.questionId).toBeGreaterThan(0);
        expect(result.question).toBe("What is your experience level?");
        expect(result.options).toEqual(["Beginner", "Intermediate", "Advanced", "Other (please specify)"]);
      }
    });

    it("returns thinking when AI responds with text and no question", async () => {
      await seedMission(db);

      // Save an initial user message first
      await db.insert(schema.chatMessages).values({
        missionId: 1,
        role: "user",
        content: JSON.stringify("Hello"),
      });

      const client = new FakeAiClient([
        FakeAiClient.textResponse("Let me think about what to ask you..."),
      ]);
      onboarding = createOnboarding({ ai: client, toolExecutor: executor, db, logger });

      const result = await onboarding.continueGuided(1);

      expect(result.type).toBe("thinking");
    });

    it("returns error when AI call fails", async () => {
      await seedMission(db);

      const client = new ThrowingAiClient();
      onboarding = createOnboarding({ ai: client, toolExecutor: executor, db, logger });

      const result = await onboarding.continueGuided(1);

      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.message).toBeTruthy();
      }
    });
  });

  describe("answerQuestion", () => {
    it("processes answer and returns next question from AI", async () => {
      await seedMission(db);

      // Create a pending guided question
      await db.insert(schema.guidedQuestions).values({
        missionId: 1,
        question: "What do you want to learn?",
        options: JSON.stringify(["Guitar", "Piano", "Drums", "Other (please specify)"]),
        status: "pending",
      });

      const client = new FakeAiClient([
        FakeAiClient.toolUseResponse("ask_guided_question", {
          question: "Why do you want to learn it?",
          options: ["Career", "Hobby", "School"],
        }),
      ]);
      onboarding = createOnboarding({ ai: client, toolExecutor: executor, db, logger });

      const result = await onboarding.answerQuestion(1, 1, "Guitar");

      expect(result.type).toBe("question");
      if (result.type === "question") {
        expect(result.question).toBe("Why do you want to learn it?");
      }

      // Verify original question was marked answered
      const questions = await getGuidedQuestions(db, 1);
      expect(questions[0].status).toBe("answered");
      expect(questions[0].answer).toBe("Guitar");
    });

    it("activates mission and returns redirect when AI calls mark_mission_active", async () => {
      await seedMission(db);

      await db.insert(schema.guidedQuestions).values({
        missionId: 1,
        question: "What do you want to learn?",
        options: JSON.stringify(["Guitar", "Piano"]),
        status: "pending",
      });

      const client = new FakeAiClient([
        FakeAiClient.toolUseResponse("mark_mission_active"),
        FakeAiClient.textResponse("Mission is now active!"),
        FakeAiClient.textResponse("My Guitar Mission"),
      ]);
      onboarding = createOnboarding({ ai: client, toolExecutor: executor, db, logger });

      const result = await onboarding.answerQuestion(1, 1, "Guitar");

      expect(result.type).toBe("redirect");

      // Verify mission was activated
      const mission = await getMission(db, 1);
      expect(mission.status).toBe("active");
    });

    it("returns error when AI call fails", async () => {
      await seedMission(db);

      await db.insert(schema.guidedQuestions).values({
        missionId: 1,
        question: "What do you want to learn?",
        options: JSON.stringify(["Guitar", "Piano"]),
        status: "pending",
      });

      const client = new ThrowingAiClient();
      onboarding = createOnboarding({ ai: client, toolExecutor: executor, db, logger });

      const result = await onboarding.answerQuestion(1, 1, "Guitar");
      expect(result.type).toBe("error");
    });
  });

  describe("skipQuestions", () => {
    it("skips pending questions and activates mission", async () => {
      await seedMission(db);

      // Create pending questions
      await db.insert(schema.guidedQuestions).values({
        missionId: 1,
        question: "What?",
        options: JSON.stringify(["A", "B"]),
        status: "pending",
      });

      const client = new FakeAiClient([
        FakeAiClient.toolUseResponse("mark_mission_active"),
        FakeAiClient.textResponse("Activated!"),
        FakeAiClient.textResponse("My Mission"),
      ]);
      onboarding = createOnboarding({ ai: client, toolExecutor: executor, db, logger });

      const result = await onboarding.skipQuestions(1);

      expect(result.type).toBe("redirect");

      // Verify pending questions were skipped
      const questions = await getGuidedQuestions(db, 1);
      expect(questions.length).toBe(1);
      expect(questions[0].status).toBe("answered");
      expect(questions[0].answer).toBe("(skipped)");

      // Verify mission was activated
      const mission = await getMission(db, 1);
      expect(mission.status).toBe("active");
    });
  });

  describe("switchMode", () => {
    it("switches from guided to chat mode", async () => {
      await seedMission(db);

      const client = new FakeAiClient([]);
      onboarding = createOnboarding({ ai: client, toolExecutor: executor, db, logger });

      await onboarding.switchMode(1, "chat");

      const mission = await getMission(db, 1);
      expect(mission.onboardingMode).toBe("chat");
    });

    it("switches from chat to guided mode", async () => {
      await seedMission(db, { onboardingMode: "chat" });

      const client = new FakeAiClient([]);
      onboarding = createOnboarding({ ai: client, toolExecutor: executor, db, logger });

      await onboarding.switchMode(1, "guided");

      const mission = await getMission(db, 1);
      expect(mission.onboardingMode).toBe("guided");
    });

    it("injects pending questions as messages when switching guided->chat", async () => {
      await seedMission(db);

      // Create a pending question
      await db.insert(schema.guidedQuestions).values({
        missionId: 1,
        question: "What do you want to learn?",
        options: JSON.stringify(["Guitar", "Piano"]),
        status: "pending",
      });

      const client = new FakeAiClient([]);
      onboarding = createOnboarding({ ai: client, toolExecutor: executor, db, logger });

      await onboarding.switchMode(1, "chat");

      // Verify the pending question was converted to messages
      const msgs = await getChatMessages(db, 1);
      expect(msgs.length).toBeGreaterThan(0);
      expect(msgs[0].role).toBe("assistant");

      // Verify question was marked answered
      const questions = await getGuidedQuestions(db, 1);
      expect(questions.length).toBe(1);
      expect(questions[0].status).toBe("answered");
      expect(questions[0].answer).toBe("(switched to chat)");
    });
  });
});

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ── Users ────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ── Missions ─────────────────────────────────────────────────────
export const missions = sqliteTable("missions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  status: text("status", { enum: ["onboarding", "active", "archived"] })
    .notNull()
    .default("onboarding"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ── Mission Content (singular docs: mission, notes, resources, glossary) ──
export const missionContent = sqliteTable("mission_content", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  missionId: integer("mission_id")
    .notNull()
    .references(() => missions.id),
  contentType: text("content_type", {
    enum: ["mission", "notes", "resources", "glossary"],
  }).notNull(),
  markdownContent: text("markdown_content").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ── Lessons ──────────────────────────────────────────────────────
export const lessons = sqliteTable("lessons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  missionId: integer("mission_id")
    .notNull()
    .references(() => missions.id),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  htmlContent: text("html_content").notNull(),
  status: text("status", { enum: ["active", "in_progress", "completed"] })
    .notNull()
    .default("active"),
  parentLessonId: integer("parent_lesson_id"),
  subNumber: integer("sub_number"),
  feedbackRating: text("feedback_rating", {
    enum: ["too_easy", "just_right", "too_hard"],
  }),
  feedbackText: text("feedback_text"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  completedAt: text("completed_at"),
});

// ── Reference Docs ───────────────────────────────────────────────
export const referenceDocs = sqliteTable("reference_docs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  missionId: integer("mission_id")
    .notNull()
    .references(() => missions.id),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  htmlContent: text("html_content").notNull(),
  docType: text("doc_type", {
    enum: ["cheatsheet", "algorithm", "routine", "sequence", "other"],
  }).notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ── Learning Records ─────────────────────────────────────────────
export const learningRecords = sqliteTable("learning_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  missionId: integer("mission_id")
    .notNull()
    .references(() => missions.id),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  markdownContent: text("markdown_content").notNull(),
  status: text("status", { enum: ["active", "superseded"] })
    .notNull()
    .default("active"),
  supersededBy: integer("superseded_by"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ── Chat Messages ────────────────────────────────────────────────
export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  missionId: integer("mission_id")
    .notNull()
    .references(() => missions.id),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(), // JSON-serialized Anthropic content blocks
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

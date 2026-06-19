import { describe, it, expect, beforeEach } from "vitest";
import { eq, and } from "drizzle-orm";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import * as schema from "../db/schema.js";
import { DrizzleContentAdapter } from "../db/adapters/index.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

describe("atomic content upsert", () => {
  let db: BetterSQLite3Database<typeof schema>;
  let store: DrizzleContentAdapter;
  let missionId: number;

  beforeEach(async () => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    db = drizzle(sqlite, { schema });
    const migrationsFolder = join(
      dirname(fileURLToPath(import.meta.url)),
      "../db/migrations",
    );
    migrate(db, { migrationsFolder });

    store = new DrizzleContentAdapter(db);

    // Seed a user (FK requirement for missions.user_id)
    const passwordHash = await bcrypt.hash("password", 10);
    await db.insert(schema.users).values({
      email: "test@test.com",
      passwordHash,
      name: "Test User",
    });

    // Seed a mission
    const [mission] = await db
      .insert(schema.missions)
      .values({
        userId: 1,
        title: "Test Mission",
        slug: "test-mission",
        status: "active",
      })
      .returning();
    missionId = mission.id;
  });

  describe("concurrent upsert (US1)", () => {
    it("produces exactly one row after 5 concurrent upserts for the same (missionId, contentType)", async () => {
      await Promise.all(
        Array.from({ length: 5 }, () =>
          store.upsertMissionContent({
            missionId,
            contentType: "mission",
            markdownContent: "some content",
          }),
        ),
      );

      const rows = await db
        .select()
        .from(schema.missionContent)
        .where(
          and(
            eq(schema.missionContent.missionId, missionId),
            eq(schema.missionContent.contentType, "mission"),
          ),
        );

      expect(rows).toHaveLength(1);
    });

    it("updates existing row when same (missionId, contentType) is upserted with different content", async () => {
      await store.upsertMissionContent({
        missionId,
        contentType: "notes",
        markdownContent: "original content",
      });

      await store.upsertMissionContent({
        missionId,
        contentType: "notes",
        markdownContent: "updated content",
      });

      const rows = await db
        .select()
        .from(schema.missionContent)
        .where(
          and(
            eq(schema.missionContent.missionId, missionId),
            eq(schema.missionContent.contentType, "notes"),
          ),
        );

      expect(rows).toHaveLength(1);
      expect(rows[0].markdownContent).toBe("updated content");
    });

    it("is idempotent when same content is upserted twice", async () => {
      await store.upsertMissionContent({
        missionId,
        contentType: "resources",
        markdownContent: "same content",
      });

      await store.upsertMissionContent({
        missionId,
        contentType: "resources",
        markdownContent: "same content",
      });

      const rows = await db
        .select()
        .from(schema.missionContent)
        .where(
          and(
            eq(schema.missionContent.missionId, missionId),
            eq(schema.missionContent.contentType, "resources"),
          ),
        );

      expect(rows).toHaveLength(1);
      expect(rows[0].markdownContent).toBe("same content");
    });
  });

  describe("constraint enforcement (US2)", () => {
    it("rejects duplicate (missionId, contentType) via raw SQL with UNIQUE constraint violation", async () => {
      // Insert first row via store
      await store.upsertMissionContent({
        missionId,
        contentType: "glossary",
        markdownContent: "first entry",
      });

      // Attempt duplicate via raw SQL
      expect(() =>
        db
          .insert(schema.missionContent)
          .values({
            missionId,
            contentType: "glossary",
            markdownContent: "second entry",
          })
          .run(),
      ).toThrow(/SQLITE_CONSTRAINT_UNIQUE|UNIQUE constraint|SQLITE_CONSTRAINT/i);
    });
  });
});

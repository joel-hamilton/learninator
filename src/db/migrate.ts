import Database from "better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { join, dirname } from "node:path";
import { mkdirSync } from "node:fs";

const dbPath = process.env.DATABASE_URL || "data/learninator.db";
mkdirSync(dirname(dbPath), { recursive: true });
const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

const migrationsFolder = join(import.meta.dirname, "migrations");
migrate(db, { migrationsFolder });
console.log("Migrations applied successfully");

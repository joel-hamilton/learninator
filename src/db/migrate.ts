import Database from "better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { join } from "node:path";

const dbPath = process.env.DATABASE_URL || "data/learninator.db";
const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

const migrationsFolder = join(import.meta.dirname, "migrations");
migrate(db, { migrationsFolder });
console.log("Migrations applied successfully");

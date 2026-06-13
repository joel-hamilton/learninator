import Database from "better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle } from "drizzle-orm/better-sqlite3";

const dbPath = process.env.DATABASE_URL || "data/learninator.db";
const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: "./src/db/migrations" });
console.log("Migrations applied successfully");

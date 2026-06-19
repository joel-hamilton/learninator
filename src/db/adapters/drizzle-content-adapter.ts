import { eq, and } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "../schema.js";
import type { ContentStore } from "../store.js";

export class DrizzleContentAdapter implements ContentStore {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async getMissionContent(missionId: number, contentType: string) {
    const [row] = await this.db.select().from(schema.missionContent)
      .where(and(
        eq(schema.missionContent.missionId, missionId),
        eq(schema.missionContent.contentType, contentType as any),
      ))
      .limit(1);
    return row;
  }

  async upsertMissionContent(values: {
    missionId: number; contentType: string; markdownContent: string;
  }) {
    await this.db.insert(schema.missionContent).values({
      missionId: values.missionId,
      contentType: values.contentType as any,
      markdownContent: values.markdownContent,
    }).onConflictDoUpdate({
      target: [
        schema.missionContent.missionId,
        schema.missionContent.contentType,
      ],
      set: {
        markdownContent: values.markdownContent,
        updatedAt: new Date().toISOString(),
      },
    });
  }
}

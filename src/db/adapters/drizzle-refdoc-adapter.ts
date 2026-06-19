import { eq, and, asc } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "../schema.js";
import type { RefDocStore, ReferenceDocRow } from "../store.js";

export class DrizzleRefDocAdapter implements RefDocStore {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async createReferenceDoc(values: {
    missionId: number; title: string; slug: string; htmlContent: string; docType: string;
  }) {
    const [row] = await this.db.insert(schema.referenceDocs).values({
      missionId: values.missionId,
      title: values.title,
      slug: values.slug,
      htmlContent: values.htmlContent,
      docType: values.docType as any,
    }).returning();
    return row;
  }

  async getReferenceDoc(id: number, missionId: number) {
    const [row] = await this.db.select().from(schema.referenceDocs)
      .where(and(eq(schema.referenceDocs.id, id), eq(schema.referenceDocs.missionId, missionId)))
      .limit(1);
    return row;
  }

  async listReferenceDocs(missionId: number) {
    return this.db.select().from(schema.referenceDocs)
      .where(eq(schema.referenceDocs.missionId, missionId))
      .orderBy(asc(schema.referenceDocs.createdAt));
  }
}

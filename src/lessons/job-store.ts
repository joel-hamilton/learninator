// ── Types ──

export interface InternalJob {
  status: "running" | "done" | "error";
  messages: string[];
  result: {
    lessonNumber: number;
    lessonSubNumber: number | null;
    lessonTitle: string;
  } | null;
  error: string | null;
}

// ── Interface ──

export interface JobStore {
  getJob(key: string): InternalJob | undefined;
  setJob(key: string, job: InternalJob): void;
  deleteJob(key: string): void;
}

// ── In-memory implementation ──

export class InMemoryJobStore implements JobStore {
  private store = new Map<string, InternalJob>();

  getJob(key: string): InternalJob | undefined {
    return this.store.get(key);
  }

  setJob(key: string, job: InternalJob): void {
    this.store.set(key, job);
  }

  deleteJob(key: string): void {
    this.store.delete(key);
  }
}

export type JobStatus = "running" | "done" | "error";

export type ConversationJob = {
  missionId: number;
  userId: number;
  status: JobStatus;
  messages: string[];
  result: string | null;
  error: string | null;
  createdAt: number;
  lessonNumber?: number;
  lessonSubNumber?: number | null;
  lessonTitle?: string;
};

const jobs = new Map<string, ConversationJob>();

// Clean up stale jobs every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, job] of jobs) {
    if (now - job.createdAt > 60_000) {
      jobs.delete(key);
    }
  }
}, 60_000);

export function createJob(key: string, missionId: number, userId: number): ConversationJob {
  const job: ConversationJob = {
    missionId,
    userId,
    status: "running",
    messages: [],
    result: null,
    error: null,
    createdAt: Date.now(),
  };
  jobs.set(key, job);
  return job;
}

export function getActiveJobsForUser(userId: number): ConversationJob[] {
  const result: ConversationJob[] = [];
  for (const job of jobs.values()) {
    if (job.userId === userId && job.status === "running") {
      result.push(job);
    }
  }
  return result;
}

export function getJob(key: string): ConversationJob | undefined {
  return jobs.get(key);
}

export function removeJob(key: string): void {
  jobs.delete(key);
}

export function getActiveJobsForMission(missionId: number): ConversationJob[] {
  const result: ConversationJob[] = [];
  for (const job of jobs.values()) {
    if (job.missionId === missionId && job.status === "running") {
      result.push(job);
    }
  }
  return result;
}

export function hasActiveJob(missionId: number): boolean {
  for (const job of jobs.values()) {
    if (job.missionId === missionId && job.status === "running") {
      return true;
    }
  }
  return false;
}

export function toolLabel(name: string, input: Record<string, unknown> | undefined): string {
  switch (name) {
    case "list_lessons":
      return "Looking at previous lessons…";
    case "read_lesson":
      return `Reviewing lesson ${input?.number || ""}…`;
    case "list_reference_docs":
      return "Checking reference documents…";
    case "list_learning_records":
      return "Reviewing learning records…";
    case "create_lesson":
      return `Writing lesson: ${input?.title || "new lesson"}…`;
    case "create_sub_lesson":
      return `Writing sub-lesson: ${input?.title || "new sub-lesson"}…`;
    case "create_reference_doc":
      return `Creating reference: ${input?.title || "new doc"}…`;
    case "read_mission_content":
      return "Reading mission notes…";
    case "write_mission_content":
      return "Saving mission content…";
    case "read_resources":
    case "write_resources":
      return "Updating resources…";
    case "mark_mission_active":
      return "Finalizing mission setup…";
    default:
      return `Working (${name.replace(/_/g, " ")})…`;
  }
}

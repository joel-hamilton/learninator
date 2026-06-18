import type { EventBus, WorkflowEvent } from "./events.js";

export interface WorkflowStep {
  label: string;
  status: "pending" | "active" | "completed" | "failed";
  detail: string | null;
  startedAt: number | null;
  completedAt: number | null;
}

export interface WorkflowRun {
  id: string;
  userId: number;
  type: "chat" | "lesson_generation" | "mission_activation";
  label: string;
  status: "running" | "completed" | "failed";
  missionId: number;
  linkUrl: string;
  steps: WorkflowStep[];
  error: string | null;
  startedAt: number;
  updatedAt: number;
}

let nextId = 0;

function uid(): string {
  nextId++;
  return `wf_${Date.now()}_${nextId}`;
}

const TOOL_LABELS: Record<string, string> = {
  list_lessons: "Looking at previous lessons…",
  read_lesson: "Reviewing a lesson…",
  list_reference_docs: "Checking reference documents…",
  read_reference_doc: "Reading a reference document…",
  list_learning_records: "Reviewing learning records…",
  read_learning_record: "Reading a learning record…",
  create_lesson: "Creating a new lesson…",
  create_sub_lesson: "Creating a sub-lesson…",
  create_reference_doc: "Creating a reference document…",
  create_learning_record: "Recording what you learned…",
  read_mission_content: "Reading mission notes…",
  write_mission_content: "Writing mission notes…",
  list_feedback_history: "Checking feedback history…",
  regenerate_lesson: "Regenerating a lesson…",
  mark_mission_active: "Activating your mission…",
  search_web: "Searching the web…",
};

/** Student-friendly label for a tool name. */
export function toolDisplayLabel(name: string, _input?: Record<string, unknown>): string {
  return TOOL_LABELS[name] || `Working (${name.replace(/_/g, " ")})…`;
}

export class WorkflowStateManager {
  private workflows = new Map<string, WorkflowRun>();
  private byUser = new Map<number, Set<string>>();
  private events: EventBus;

  constructor(events: EventBus) {
    this.events = events;
  }

  startWorkflow(
    userId: number,
    type: WorkflowRun["type"],
    label: string,
    missionId: number,
    linkUrl: string,
  ): string {
    const id = uid();
    const now = Date.now();
    const run: WorkflowRun = {
      id,
      userId,
      type,
      label,
      status: "running",
      missionId,
      linkUrl,
      steps: [],
      error: null,
      startedAt: now,
      updatedAt: now,
    };
    this.workflows.set(id, run);
    if (!this.byUser.has(userId)) this.byUser.set(userId, new Set());
    this.byUser.get(userId)!.add(id);

    const event: WorkflowEvent = {
      event: "workflow_start",
      workflowId: id,
      type,
      label,
      linkUrl,
    };
    this.events.emitUser(userId, event);

    return id;
  }

  stepUpdate(workflowId: string, label: string, detail?: string | null): void {
    const run = this.workflows.get(workflowId);
    if (!run || run.status !== "running") return;

    // Mark any previously active step as completed
    for (const s of run.steps) {
      if (s.status === "active") {
        s.status = "completed";
        s.completedAt = Date.now();
      }
    }

    const step: WorkflowStep = {
      label,
      status: "active",
      detail: detail ?? null,
      startedAt: Date.now(),
      completedAt: null,
    };
    run.steps.push(step);
    run.updatedAt = Date.now();

    const event: WorkflowEvent = {
      event: "workflow_step",
      workflowId,
      label,
      step: { label, status: "active", detail: detail ?? null },
    };
    this.events.emitUser(run.userId, event);
  }

  completeWorkflow(workflowId: string, label?: string): void {
    const run = this.workflows.get(workflowId);
    if (!run || run.status !== "running") return;

    // Mark active step as completed
    for (const s of run.steps) {
      if (s.status === "active") {
        s.status = "completed";
        s.completedAt = Date.now();
      }
    }

    run.status = "completed";
    run.label = label ?? run.label;
    run.updatedAt = Date.now();

    const event: WorkflowEvent = {
      event: "workflow_complete",
      workflowId,
      status: "completed",
      label: run.label,
    };
    this.events.emitUser(run.userId, event);

    // Auto-cleanup after a brief window so last poll can see completion
    setTimeout(() => {
      this.workflows.delete(workflowId);
      this.byUser.get(run.userId)?.delete(workflowId);
    }, 30_000);
  }

  failWorkflow(workflowId: string, error: string, label?: string): void {
    const run = this.workflows.get(workflowId);
    if (!run || run.status !== "running") return;

    // Mark active step as failed
    for (const s of run.steps) {
      if (s.status === "active") {
        s.status = "failed";
        s.completedAt = Date.now();
      }
    }

    run.status = "failed";
    run.error = error;
    run.label = label ?? run.label;
    run.updatedAt = Date.now();

    const event: WorkflowEvent = {
      event: "workflow_error",
      workflowId,
      status: "failed",
      label: run.label,
      error,
    };
    this.events.emitUser(run.userId, event);

    setTimeout(() => {
      this.workflows.delete(workflowId);
      this.byUser.get(run.userId)?.delete(workflowId);
    }, 60_000);
  }

  getActiveWorkflows(userId: number): WorkflowRun[] {
    const ids = this.byUser.get(userId);
    if (!ids) return [];
    const result: WorkflowRun[] = [];
    for (const id of ids) {
      const run = this.workflows.get(id);
      if (run) result.push(run);
    }
    return result;
  }

  getWorkflow(workflowId: string): WorkflowRun | undefined {
    return this.workflows.get(workflowId);
  }
}

export interface ToolEvent {
  type: "tool_start" | "tool_end";
  names: string[];
}

export interface WorkflowEvent {
  event: "workflow_start" | "workflow_step" | "workflow_complete" | "workflow_error";
  workflowId: string;
  type?: string;
  label: string;
  status?: string;
  linkUrl?: string;
  step?: { label: string; status: string; detail?: string | null };
  error?: string;
}

type WorkflowEventCallback = (event: WorkflowEvent) => void | Promise<void>;

export interface ToolEventBus {
  emit(missionId: number, event: ToolEvent): void;
}

export interface WorkflowEventBus {
  emitUser(userId: number, event: WorkflowEvent): void;
}

export function createEventBus(): ToolEventBus & WorkflowEventBus {
  const userSubscribers = new Map<number, Set<WorkflowEventCallback>>();

  function emit(_missionId: number, _event: ToolEvent): void {
    // No-op — ToolEventBus.subscribe was removed; no subscribers remain.
  }

  function emitUser(userId: number, event: WorkflowEvent): void {
    const subs = userSubscribers.get(userId);
    if (!subs || subs.size === 0) return;
    subs.forEach((cb) => {
      try {
        const result = cb(event);
        if (result instanceof Promise) {
          result.catch(() => {});
        }
      } catch {
        // swallow subscriber errors
      }
    });
  }

  return { emit, emitUser };
}


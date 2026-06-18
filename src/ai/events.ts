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

type ToolEventCallback = (event: ToolEvent) => void | Promise<void>;
type WorkflowEventCallback = (event: WorkflowEvent) => void | Promise<void>;

export interface EventBus {
  subscribe(missionId: number, cb: ToolEventCallback): () => void;
  emit(missionId: number, event: ToolEvent): void;
  subscribeUser(userId: number, cb: WorkflowEventCallback): () => void;
  emitUser(userId: number, event: WorkflowEvent): void;
}

export function createEventBus(): EventBus {
  const subscribers = new Map<number, Set<ToolEventCallback>>();
  const userSubscribers = new Map<number, Set<WorkflowEventCallback>>();

  function subscribe(missionId: number, cb: ToolEventCallback): () => void {
    if (!subscribers.has(missionId)) {
      subscribers.set(missionId, new Set());
    }
    subscribers.get(missionId)!.add(cb);
    return () => {
      subscribers.get(missionId)?.delete(cb);
    };
  }

  function emit(missionId: number, event: ToolEvent): void {
    const subs = subscribers.get(missionId);
    if (!subs || subs.size === 0) return;
    subs.forEach((cb) => {
      try {
        const result = cb(event);
        if (result instanceof Promise) {
          result.catch(() => {}); // swallow subscriber errors
        }
      } catch {
        // swallow subscriber errors
      }
    });
  }

  function subscribeUser(userId: number, cb: WorkflowEventCallback): () => void {
    if (!userSubscribers.has(userId)) {
      userSubscribers.set(userId, new Set());
    }
    userSubscribers.get(userId)!.add(cb);
    return () => {
      userSubscribers.get(userId)?.delete(cb);
    };
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

  return { subscribe, emit, subscribeUser, emitUser };
}

/** Default singleton event bus for backward compatibility during migration. */
const defaultBus = createEventBus();

export const subscribe = defaultBus.subscribe;
export const emit = defaultBus.emit;
export const subscribeUser = defaultBus.subscribeUser;
export const emitUser = defaultBus.emitUser;

export interface ToolEvent {
  type: "tool_start" | "tool_end";
  names: string[];
}

type EventCallback = (event: ToolEvent) => void | Promise<void>;

export interface EventBus {
  subscribe(missionId: number, cb: EventCallback): () => void;
  emit(missionId: number, event: ToolEvent): void;
}

export function createEventBus(): EventBus {
  const subscribers = new Map<number, Set<EventCallback>>();

  function subscribe(missionId: number, cb: EventCallback): () => void {
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

  return { subscribe, emit };
}

/** Default singleton event bus for backward compatibility during migration. */
const defaultBus = createEventBus();

export const subscribe = defaultBus.subscribe;
export const emit = defaultBus.emit;

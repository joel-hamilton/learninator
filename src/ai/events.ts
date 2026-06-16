export interface ToolEvent {
  type: "tool_start" | "tool_end";
  names: string[];
}

type EventCallback = (event: ToolEvent) => void | Promise<void>;
const subscribers = new Map<number, Set<EventCallback>>();

export function subscribe(missionId: number, cb: EventCallback): () => void {
  if (!subscribers.has(missionId)) {
    subscribers.set(missionId, new Set());
  }
  subscribers.get(missionId)!.add(cb);
  return () => {
    subscribers.get(missionId)?.delete(cb);
  };
}

export function emit(missionId: number, event: ToolEvent): void {
  const subs = subscribers.get(missionId);
  if (!subs || subs.size === 0) {
    console.log("[tool-events] emit %s for mission %d — NO SUBSCRIBERS", event.type, missionId);
    return;
  }
  console.log("[tool-events] emit %s for mission %d to %d subscriber(s): %s", event.type, missionId, subs.size, event.names.join(", "));
  subs.forEach((cb) => {
    try {
      const result = cb(event);
      if (result instanceof Promise) {
        result.catch((e) => console.error("[tool-events] subscriber error:", e));
      }
    } catch (e) {
      console.error("[tool-events] subscriber error:", e);
    }
  });
}

import type { MiddlewareHandler } from "hono";
import type { AppVariables, ProfileStore } from "../types.js";
import { requestIdMiddleware, timingMiddleware } from "./debug.js";
import { createProfileStore } from "./profile.js";

type Ctx = { Variables: AppVariables };

export function createObservability(): {
  middleware: MiddlewareHandler<Ctx>[];
  profileStore: ProfileStore | null;
} {
  const profileStore = createProfileStore();

  return {
    middleware: [requestIdMiddleware(), timingMiddleware(profileStore)],
    profileStore,
  };
}

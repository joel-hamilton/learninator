import type { MissionStore, MissionRow } from "../db/store.js";

/**
 * Look up a mission by ID scoped to the owning user.
 * Returns the mission if found and owned by the user, undefined otherwise.
 * Centralizes the `store.getMission(id, userId)` ownership-check pattern.
 */
export async function requireMissionAccess(
  store: MissionStore,
  missionId: number,
  userId: number,
): Promise<MissionRow | undefined> {
  // NaN check: parseInt("bad") returns NaN, store.getMission(NaN, userId) returns undefined
  if (Number.isNaN(missionId) || missionId < 1) return undefined;
  return store.getMission(missionId, userId);
}

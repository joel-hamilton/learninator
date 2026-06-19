import type { Context } from "hono";
import type { MissionChatService } from "../services/mission-chat.service.js";

/**
 * Handle mission activation after a `missionChatService.run()` call.
 *
 * If `result.didActivate` is true, generates a mission title and redirects
 * the client to the mission page via `HX-Redirect`. Otherwise, returns
 * `undefined` so the caller can proceed with normal response rendering.
 *
 * @param result        The result from missionChatService.run()
 * @param missionId     The mission ID
 * @param missionChatService  The mission chat service instance from context
 * @param c             The Hono context (for setting headers and returning response)
 * @returns A Response (empty body, 200) if activated, or undefined if not
 */
export async function handleActivation(
  result: { didActivate: boolean },
  missionId: number,
  missionChatService: Pick<MissionChatService, "generateTitle">,
  c: Context,
): Promise<Response | undefined> {
  if (!result.didActivate) return undefined;

  await missionChatService.generateTitle(missionId);
  c.header("HX-Redirect", `/missions/${missionId}`);
  return c.body(null);
}

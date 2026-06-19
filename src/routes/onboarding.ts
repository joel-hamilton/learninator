import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import type { AppVariables } from "../types.js";
import { TEACHER_TOOLS } from "../ai/teacher.js";
import { AIError } from "../ai/errors.js";
import { handleActivation } from "../shared/activate-mission.js";
import { requireMissionAccess } from "../shared/require-mission-access.js";
import { validateGuidedAnswer } from "../security/index.js";
import { guidedQuestionSection, guidedThinkingSection } from "../views/onboarding.js";

type Ctx = Context<{ Variables: AppVariables }>;
export const onboardingRoutes = new Hono<{ Variables: AppVariables }>();

// ── Guided onboarding: start/continue conversation ──
onboardingRoutes.post("/:missionId/guided/start", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);

  const mission = await requireMissionAccess(store, missionId, user.id);
  if (!mission || mission.status !== "onboarding") return c.text("Not found", 404);

  const missionChatService = c.get("missionChatService");

  try {
    const result = await missionChatService.run({
      missionId,
      userId: user.id,
      message: "",
      missionTitle: mission.title,
      missionStatus: "onboarding",
      onboardingMode: "guided",
      pauseOnTools: new Set(["ask_guided_question"]),
      workflowType: "mission_activation",
      workflowLabel: `Setting up mission`,
    });

    const activated = await handleActivation(result, missionId, missionChatService, c);
    if (activated) return activated;

    if (result.pausedToolUse) {
      const pq = await store.getPendingQuestion(missionId);
      if (pq) {
        const options: string[] = JSON.parse(pq.options as string);
        return c.html(guidedQuestionSection(missionId, pq.id, pq.question as string, options));
      }
    }

    return c.html(guidedThinkingSection(missionId));
  } catch (err: unknown) {
    const msg = err instanceof AIError ? err.toUserMessage() : "Something went wrong. Please try again.";
    return c.html(`<div id="question-section"><div class="question-card"><p style="color:#c00;">${msg}</p></div></div>`);
  }
});

// ── Guided onboarding: answer a question ──
onboardingRoutes.post("/:missionId/guided/answer", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const body = await c.req.parseBody();
  const questionId = parseInt(String(body.question_id || ""));
  const selectedAnswer = String(body.answer || "").trim();
  const otherText = String(body.other_text || "").trim();

  const answerErr = validateGuidedAnswer(selectedAnswer, otherText);
  if (answerErr) return c.html(answerErr);

  const mission = await requireMissionAccess(store, missionId, user.id);
  if (!mission || mission.status !== "onboarding") return c.text("Not found", 404);

  const finalAnswer = otherText || selectedAnswer;
  if (questionId && finalAnswer) {
    await store.answerQuestion(questionId, selectedAnswer, otherText || null);
  }

  const missionChatService = c.get("missionChatService");

  try {
    const result = await missionChatService.run({
      missionId,
      userId: user.id,
      message: `Question: (answered)\nAnswer: ${finalAnswer}`,
      missionTitle: mission.title,
      missionStatus: "onboarding",
      onboardingMode: "guided",
      pauseOnTools: new Set(["ask_guided_question"]),
      workflowType: "mission_activation",
      workflowLabel: `Setting up mission`,
    });

    const activated = await handleActivation(result, missionId, missionChatService, c);
    if (activated) return activated;

    if (result.pausedToolUse) {
      const pq = await store.getPendingQuestion(missionId);
      if (pq) {
        const options: string[] = JSON.parse(pq.options as string);
        return c.html(guidedQuestionSection(missionId, pq.id, pq.question as string, options));
      }
    }

    return c.html(guidedThinkingSection(missionId));
  } catch (err: unknown) {
    const msg = err instanceof AIError ? err.toUserMessage() : "Something went wrong. Please try again.";
    return c.html(`<div id="question-section"><div class="question-card"><p style="color:#c00;">${msg}</p></div></div>`);
  }
});

// ── Guided onboarding: skip remaining questions ──
onboardingRoutes.post("/:missionId/guided/skip", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);

  const mission = await requireMissionAccess(store, missionId, user.id);
  if (!mission || mission.status !== "onboarding") return c.text("Not found", 404);

  await store.skipPendingQuestions(missionId);

  const skipTools = TEACHER_TOOLS.filter((t) => t.name !== "ask_guided_question");
  const missionChatService = c.get("missionChatService");

  try {
    const result = await missionChatService.run({
      missionId,
      userId: user.id,
      message: "[I've answered enough questions. Please use your best judgment for the rest and create the mission and first lesson.]",
      missionTitle: mission.title,
      missionStatus: "onboarding",
      onboardingMode: "guided",
      tools: skipTools,
      workflowType: "mission_activation",
      workflowLabel: `Setting up mission`,
    });

    const activated = await handleActivation(result, missionId, missionChatService, c);
    if (activated) return activated;
  } catch {
    // Continue to redirect even on error — mission exists
  }

  c.header("HX-Redirect", `/missions/${missionId}`);
  return c.body(null);
});

// ── Toggle onboarding mode ──
onboardingRoutes.post("/:missionId/mode", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const body = await c.req.parseBody();
  const newMode = String(body.mode || "guided") as "guided" | "chat";

  const mission = await requireMissionAccess(store, missionId, user.id);
  if (!mission || mission.status !== "onboarding") return c.text("Not found", 404);

  if (mission.onboardingMode === "guided" && newMode === "chat") {
    let pq = await store.getPendingQuestion(missionId);
    while (pq) {
      const options: string[] = JSON.parse(pq.options as string);
      const optionsText = options.map((o: string) => `- ${o}`).join("\n");
      const questionMsg = `**${pq.question}**\n\n${optionsText}`;
      await store.saveChatMessage({ missionId, role: "assistant", content: JSON.stringify(questionMsg) });
      await store.answerQuestion(pq.id, "(switched to chat)");
      pq = await store.getPendingQuestion(missionId);
    }
  }

  await store.updateMissionOnboardingMode(missionId, newMode);

  return c.redirect(`/missions/${missionId}`);
});

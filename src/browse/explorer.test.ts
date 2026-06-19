import { describe, it, expect } from "vitest";
import { FakeAiClient } from "../ai/index.js";
import { TopicExplorer } from "./explorer.js";
import type { Logger } from "../logger.js";

const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

describe("TopicExplorer", () => {
  describe("explore()", () => {
    it("returns broad options when path is empty", async () => {
      const ai = new FakeAiClient([
        FakeAiClient.textResponse(
          JSON.stringify({
            options: [
              "Science & Engineering",
              "Technology & Programming",
              "Art & Design",
              "Music & Performance",
              "Business & Entrepreneurship",
              "Health & Wellness",
              "Languages & Writing",
              "History & Philosophy",
            ],
            is_specific_enough: false,
            suggested_title: "",
          }),
        ),
      ]);
      const explorer = new TopicExplorer({ ai, logger: silentLogger });
      const result = await explorer.explore([], 0);

      expect(result.options.length).toBeGreaterThanOrEqual(6);
      expect(result.isLastQuestion).toBe(false);
    });

    it("marks isLastQuestion as true when iteration >= 2", async () => {
      const ai = new FakeAiClient([
        FakeAiClient.textResponse(
          JSON.stringify({
            options: ["Sub-topic A", "Sub-topic B", "Sub-topic C", "Sub-topic D"],
            is_specific_enough: false,
          }),
        ),
      ]);
      const explorer = new TopicExplorer({ ai, logger: silentLogger });
      const result = await explorer.explore(["Science", "Physics"], 2);

      expect(result.isLastQuestion).toBe(true);
    });

    it("returns sub-topics for a non-empty path", async () => {
      const ai = new FakeAiClient([
        FakeAiClient.textResponse(
          JSON.stringify({
            options: ["Quantum Mechanics", "Thermodynamics", "Optics", "Electromagnetism"],
            is_specific_enough: false,
          }),
        ),
      ]);
      const explorer = new TopicExplorer({ ai, logger: silentLogger });
      const result = await explorer.explore(["Science"], 0);

      expect(result.options.length).toBeGreaterThanOrEqual(2);
      expect(result.options).toContain("Quantum Mechanics");
    });
  });

  describe("select()", () => {
    it("returns sub-options on first click (iteration 0)", async () => {
      const ai = new FakeAiClient([
        FakeAiClient.textResponse(
          JSON.stringify({
            options: ["Physics", "Chemistry", "Biology", "Astronomy"],
            is_specific_enough: false,
          }),
        ),
      ]);
      const explorer = new TopicExplorer({ ai, logger: silentLogger });
      const result = await explorer.select([], "Science", 0, false);

      expect(result.type).toBe("options");
      if (result.type === "options") {
        expect(result.iteration).toBe(1);
        expect(result.path).toEqual(["Science"]);
        expect(result.options.length).toBeGreaterThanOrEqual(2);
        expect(result.isLastQuestion).toBe(false);
      }
    });

    it("returns create_mission on safety valve (iteration 2, third click)", async () => {
      // No AI call needed — safety valve fires before AI
      const explorer = new TopicExplorer({ ai: new FakeAiClient([]), logger: silentLogger });
      const result = await explorer.select(["Science", "Physics"], "Quantum Mechanics", 2, false);

      expect(result.type).toBe("create_mission");
      if (result.type === "create_mission") {
        expect(result.topic).toBe("Quantum Mechanics");
        expect(result.path).toEqual(["Science", "Physics", "Quantum Mechanics"]);
      }
    });

    it("creates mission when AI says specific enough on iteration 2", async () => {
      const ai = new FakeAiClient([
        FakeAiClient.textResponse(
          JSON.stringify({
            options: ["Yoga for back pain", "Yoga for flexibility", "Yoga for strength"],
            is_specific_enough: true,
            suggested_title: "Yoga for Back Pain Relief",
          }),
        ),
      ]);
      const explorer = new TopicExplorer({ ai, logger: silentLogger });
      const result = await explorer.select(["Health & Wellness"], "Yoga", 1, false);

      expect(result.type).toBe("create_mission");
      if (result.type === "create_mission") {
        expect(result.topic).toBe("Yoga for Back Pain Relief");
        expect(result.path).toEqual(["Health & Wellness", "Yoga"]);
      }
    });

    it("creates mission when AI returns specific with no options", async () => {
      const ai = new FakeAiClient([
        FakeAiClient.textResponse(
          JSON.stringify({
            options: [],
            is_specific_enough: true,
            suggested_title: "Learn Piano Basics",
          }),
        ),
      ]);
      const explorer = new TopicExplorer({ ai, logger: silentLogger });
      const result = await explorer.select(["Music"], "Piano", 0, false);

      expect(result.type).toBe("create_mission");
      if (result.type === "create_mission") {
        expect(result.topic).toBe("Learn Piano Basics");
      }
    });

    it("returns options for custom input even at iteration 2 (safety valve bypass)", async () => {
      const ai = new FakeAiClient([
        FakeAiClient.textResponse(
          JSON.stringify({
            options: ["Related A", "Related B", "Related C", "Related D"],
            is_specific_enough: false,
          }),
        ),
      ]);
      const explorer = new TopicExplorer({ ai, logger: silentLogger });
      const result = await explorer.select(["Science", "Physics"], "Custom topic", 2, true);

      expect(result.type).toBe("options");
      if (result.type === "options") {
        expect(result.options.length).toBeGreaterThanOrEqual(2);
        expect(result.iteration).toBe(3);
        expect(result.path).toEqual(["Science", "Physics", "Custom topic"]);
      }
    });
  });

  describe("refresh()", () => {
    it("returns different options at the same level", async () => {
      const ai = new FakeAiClient([
        FakeAiClient.textResponse(
          JSON.stringify({
            options: ["Refreshed A", "Refreshed B", "Refreshed C", "Refreshed D"],
            is_specific_enough: false,
          }),
        ),
      ]);
      const explorer = new TopicExplorer({ ai, logger: silentLogger });
      const result = await explorer.refresh(["Science"], 0);

      expect(result.options.length).toBeGreaterThanOrEqual(2);
      expect(result.isLastQuestion).toBe(false);
    });

    it("returns isLastQuestion: true when iteration >= 2", async () => {
      const ai = new FakeAiClient([
        FakeAiClient.textResponse(
          JSON.stringify({
            options: ["Refreshed A", "Refreshed B"],
            is_specific_enough: true,
          }),
        ),
      ]);
      const explorer = new TopicExplorer({ ai, logger: silentLogger });
      const result = await explorer.refresh(["Science", "Physics"], 2);

      expect(result.isLastQuestion).toBe(true);
    });
  });

  describe("fallback behavior", () => {
    it("uses fallback options when AI returns garbage JSON", async () => {
      const ai = new FakeAiClient([FakeAiClient.textResponse("This is not valid JSON at all")]);
      const explorer = new TopicExplorer({ ai, logger: silentLogger });
      const result = await explorer.explore([], 0);

      // Should fall back to hardcoded fallback options (non-empty)
      expect(result.options.length).toBeGreaterThanOrEqual(2);
      expect(result.isLastQuestion).toBe(false);
    });

    it("uses fallback options when AI returns empty options array", async () => {
      const ai = new FakeAiClient([
        FakeAiClient.textResponse(
          JSON.stringify({ options: [], is_specific_enough: false }),
        ),
      ]);
      const explorer = new TopicExplorer({ ai, logger: silentLogger });
      const result = await explorer.explore([], 0);

      // Parsed options is empty (length 0 < 2), triggers fallback
      expect(result.options.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("JSON parsing edge cases", () => {
    it("handles markdown code fences in AI response", async () => {
      const ai = new FakeAiClient([
        FakeAiClient.textResponse(
          '```json\n{"options": ["Physics", "Chemistry", "Biology", "Astronomy"], "is_specific_enough": false}\n```',
        ),
      ]);
      const explorer = new TopicExplorer({ ai, logger: silentLogger });
      const result = await explorer.explore(["Science"], 0);

      expect(result.options).toEqual(["Physics", "Chemistry", "Biology", "Astronomy"]);
    });

    it("handles markdown fences without json tag", async () => {
      const ai = new FakeAiClient([
        FakeAiClient.textResponse(
          '```\n{"options": ["Math", "Statistics"], "is_specific_enough": false}\n```',
        ),
      ]);
      const explorer = new TopicExplorer({ ai, logger: silentLogger });
      const result = await explorer.explore([], 0);

      expect(result.options).toContain("Math");
    });

    it("uses fallback when JSON is missing required fields", async () => {
      const ai = new FakeAiClient([
        FakeAiClient.textResponse('{"wrong_key": "complete nonsense"}'),
      ]);
      const explorer = new TopicExplorer({ ai, logger: silentLogger });
      const result = await explorer.explore([], 0);

      // options will be [] because parsed.options is undefined, triggers fallback
      expect(result.options.length).toBeGreaterThanOrEqual(2);
    });

    it("filters out non-string options from AI response", async () => {
      const ai = new FakeAiClient([
        FakeAiClient.textResponse(
          JSON.stringify({
            options: ["Valid", 42, null, false, "Also valid"],
            is_specific_enough: false,
          }),
        ),
      ]);
      const explorer = new TopicExplorer({ ai, logger: silentLogger });
      const result = await explorer.explore([], 0);

      expect(result.options).toEqual(["Valid", "Also valid"]);
    });
  });

  describe("error handling", () => {
    it("returns fallback options when AI call fails in explore()", async () => {
      const ai = new FailingAiClient();
      const explorer = new TopicExplorer({ ai, logger: silentLogger });
      const result = await explorer.explore([], 0);

      expect(result.options.length).toBeGreaterThanOrEqual(2);
      expect(result.isLastQuestion).toBe(false);
    });

    it("propagates errors from select()", async () => {
      const ai = new FailingAiClient();
      const explorer = new TopicExplorer({ ai, logger: silentLogger });

      await expect(explorer.select([], "Science", 0, false)).rejects.toThrow("AI failed");
    });

    it("propagates errors from refresh()", async () => {
      const ai = new FailingAiClient();
      const explorer = new TopicExplorer({ ai, logger: silentLogger });

      await expect(explorer.refresh([], 0)).rejects.toThrow("AI failed");
    });
  });
});

// ── Helper: AI client that always fails ──

class FailingAiClient extends FakeAiClient {
  constructor() {
    super([]);
  }

  override async chat(): Promise<string> {
    throw new Error("AI failed");
  }

  override async chatWithTools(): Promise<any> {
    throw new Error("AI failed");
  }
}

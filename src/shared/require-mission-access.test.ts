import { describe, it, expect, vi } from "vitest";
import { requireMissionAccess } from "./require-mission-access.js";
import type { MissionStore, MissionRow } from "../db/store.js";

function mockStore(
  getMission: MissionStore["getMission"],
): MissionStore {
  return {
    getMission,
    createMission: vi.fn(),
    listMissions: vi.fn(),
    updateMissionTitle: vi.fn(),
    updateMissionOnboardingMode: vi.fn(),
    updateMissionStatus: vi.fn(),
    deleteMission: vi.fn(),
  };
}

const mission: MissionRow = {
  id: 1,
  userId: 5,
  title: "Learn Go",
  slug: "learn-go",
  status: "active",
  onboardingMode: "guided",
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
};

describe("requireMissionAccess", () => {
  it("returns the mission when it belongs to the user", async () => {
    const store = mockStore(async () => mission);
    const result = await requireMissionAccess(store, 1, 5);
    expect(result).toEqual(mission);
  });

  it("returns undefined when mission does not belong to the user", async () => {
    const store = mockStore(async () => undefined);
    const result = await requireMissionAccess(store, 1, 999);
    expect(result).toBeUndefined();
  });

  it("returns undefined for NaN missionId", async () => {
    const store = mockStore(async () => mission);
    const result = await requireMissionAccess(store, NaN, 5);
    expect(result).toBeUndefined();
  });

  it("returns undefined for negative missionId", async () => {
    const store = mockStore(async () => mission);
    const result = await requireMissionAccess(store, -1, 5);
    expect(result).toBeUndefined();
  });

  it("returns undefined for zero missionId", async () => {
    const store = mockStore(async () => mission);
    const result = await requireMissionAccess(store, 0, 5);
    expect(result).toBeUndefined();
  });

  it("delegates to store.getMission for valid IDs", async () => {
    const getMission = vi.fn().mockResolvedValue(mission);
    const store = mockStore(getMission);
    await requireMissionAccess(store, 42, 7);
    expect(getMission).toHaveBeenCalledWith(42, 7);
  });
});

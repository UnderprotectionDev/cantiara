import type { Context } from "@cantiara/api/context";
import type { ReturnToWorkAccess } from "@cantiara/api/return-to-work";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

function setup() {
  const returnToWork: ReturnToWorkAccess = {
    read: vi.fn().mockResolvedValue({ cards: [], source: null }),
    markViewed: vi.fn().mockResolvedValue(undefined),
    saveNextStep: vi.fn().mockResolvedValue(undefined),
  };
  const context = {
    returnToWork,
    session: { user: { id: "founder" }, session: { id: "session" } },
  } as Context;
  return { returnToWork, client: createRouterClient(appRouter, { context }) };
}

describe("Return to Work RPC seam", () => {
  const projectInput = {
    projectId: "project-1",
    baseRevision: 3,
    clientIdempotencyKey: "hint",
    nextConcreteStep: "Ask about payment failures",
  };

  test("saves the next step and marks visits through the authenticated account", async () => {
    const { client, returnToWork } = setup();
    await client.saveNextConcreteStep({ ...projectInput, workId: "work-1" });
    expect(returnToWork.saveNextStep).toHaveBeenCalledWith("founder", {
      ...projectInput,
      workId: "work-1",
    });
    await client.markReturnContextViewed({ projectId: "project-1" });
    expect(returnToWork.markViewed).toHaveBeenCalledWith("founder", {
      projectId: "project-1",
    });
  });

  test("keeps Work hint staleness on the Work lifecycle error shape", async () => {
    const { client, returnToWork } = setup();
    vi.mocked(returnToWork.saveNextStep).mockRejectedValue({
      code: "STALE_BASE_REVISION",
      currentRevision: 4,
    });
    await expect(
      client.saveNextConcreteStep({ ...projectInput, workId: "work-1" }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Work has changed. Reload and try again.",
    });
  });

  test("maps Project hint staleness through the Project mutation error shape", async () => {
    const { client, returnToWork } = setup();
    vi.mocked(returnToWork.saveNextStep).mockRejectedValue({
      code: "STALE_BASE_REVISION",
      currentRevision: 4,
      currentValue: { project: { id: "project-1", revision: 4 } },
    });
    await expect(
      client.saveNextConcreteStep(projectInput),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: {
        code: "STALE_BASE_REVISION",
        currentRevision: 4,
        targetId: "project-1",
      },
      message: "Current value",
    });
  });
});

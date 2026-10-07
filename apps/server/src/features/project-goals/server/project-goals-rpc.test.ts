import type { Context } from "@cantiara/api/context";
import {
  ProjectGoalConflictError,
  type ProjectGoalsAccess,
} from "@cantiara/api/project-goals";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

function setup(authenticated = true) {
  const projectGoals: ProjectGoalsAccess = {
    create: vi.fn().mockResolvedValue({ id: "goal-1" }),
    update: vi.fn().mockResolvedValue({ id: "goal-1" }),
    find: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue({ records: [], readOnly: false }),
  };
  const context = {
    projectGoals,
    session: authenticated
      ? { user: { id: "founder" }, session: { id: "session" } }
      : null,
  } as Context;
  return { projectGoals, client: createRouterClient(appRouter, { context }) };
}
const draft = {
  id: "goal-1",
  projectId: "project-1",
  title: "Useful first release",
  description: "Keep context",
  intendedOutcome: null,
  observedOutcomeLearning: null,
  baseRevision: 0 as const,
  clientIdempotencyKey: "create",
};
describe("Project Goals RPC seam", () => {
  test("uses the authenticated account for record creation, lookup, and editing", async () => {
    const { client, projectGoals } = setup();
    await client.createProjectGoal(draft);
    expect(projectGoals.create).toHaveBeenCalledWith("founder", draft);
    await client.projectGoals({ projectId: draft.projectId });
    expect(projectGoals.list).toHaveBeenCalledWith("founder", draft.projectId);
    await client.projectGoal({ projectId: draft.projectId, id: draft.id });
    expect(projectGoals.find).toHaveBeenCalledWith("founder", {
      projectId: draft.projectId,
      id: draft.id,
    });
    const edit = {
      ...draft,
      baseRevision: 1,
      clientIdempotencyKey: "edit",
      observedOutcomeLearning: "Small scope helped",
    };
    await client.updateProjectGoal(edit);
    expect(projectGoals.update).toHaveBeenCalledWith("founder", edit);
  });
  test("blocks anonymous access before reaching Goals", async () => {
    const { client, projectGoals } = setup(false);
    await expect(
      client.projectGoals({ projectId: "project-1" }),
    ).rejects.toThrow();
    await expect(client.createProjectGoal(draft)).rejects.toThrow();
    expect(projectGoals.list).not.toHaveBeenCalled();
    expect(projectGoals.create).not.toHaveBeenCalled();
  });
  test("reports unavailable records and stale edits through RPC errors", async () => {
    const { client, projectGoals } = setup();
    vi.mocked(projectGoals.create).mockResolvedValue(null);
    await expect(client.createProjectGoal(draft)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    vi.mocked(projectGoals.update).mockRejectedValue(
      new ProjectGoalConflictError("Reload"),
    );
    await expect(
      client.updateProjectGoal({ ...draft, baseRevision: 1 }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      data: { code: "CONFLICT", targetId: "goal-1" },
    });
  });
});

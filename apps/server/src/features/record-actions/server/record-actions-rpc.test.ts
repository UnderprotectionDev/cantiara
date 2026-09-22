import type { Context } from "@cantiara/api/context";
import type {
  RecordAction,
  RecordActionsAccess,
} from "@cantiara/api/record-actions";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const action: RecordAction = {
  createdAt: "2026-09-22T09:00:00.000Z",
  id: "action-1",
  name: "Start Work",
  projectId: "project-1",
  revision: 1,
  steps: [
    { kind: "work-status", status: "In Progress" },
    { kind: "daily-focus-membership", operation: "add" },
  ],
  trashedAt: null,
  updatedAt: "2026-09-22T09:00:00.000Z",
};

function createContext(recordActions: RecordActionsAccess): Context {
  return {
    accountAccess: {
      listSessions: async () => [],
      revokeOtherSessions: async () => undefined,
      revokeSession: async () => undefined,
    },
    accountPreferences: {
      get: () => Promise.reject(new Error("Not part of this test.")),
    },
    auth: null,
    db: {} as Context["db"],
    githubAvailability: { getStatus: () => "available" },
    recordActions,
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
  };
}

describe("Record Actions RPC", () => {
  test("defines, edits, lists, and trashes actions as the signed-in User", async () => {
    const access: RecordActionsAccess = {
      create: vi.fn().mockResolvedValue(action),
      list: vi.fn().mockResolvedValue([action]),
      trash: vi.fn().mockResolvedValue({
        ...action,
        revision: 3,
        trashedAt: action.updatedAt,
      }),
      update: vi.fn().mockResolvedValue({
        ...action,
        name: "Begin work",
        revision: 2,
      }),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(access),
    });

    await expect(
      client.createRecordAction({
        baseRevision: 0,
        clientIdempotencyKey: "create-action-1",
        name: action.name,
        projectId: action.projectId,
        steps: action.steps,
      }),
    ).resolves.toEqual(action);
    await expect(
      client.recordActions({ projectId: action.projectId }),
    ).resolves.toEqual([action]);
    await expect(
      client.updateRecordAction({
        actionId: action.id,
        baseRevision: 1,
        clientIdempotencyKey: "update-action-1",
        name: "Begin work",
        steps: action.steps,
      }),
    ).resolves.toMatchObject({ name: "Begin work", revision: 2 });
    await expect(
      client.trashRecordAction({
        actionId: action.id,
        baseRevision: 2,
        clientIdempotencyKey: "trash-action-1",
      }),
    ).resolves.toMatchObject({ revision: 3, trashedAt: action.updatedAt });

    expect(access.create).toHaveBeenCalledWith("account-1", {
      name: action.name,
      projectId: action.projectId,
      steps: action.steps,
    });
    expect(access.update).toHaveBeenCalledWith("account-1", action.id, 1, {
      name: "Begin work",
      steps: action.steps,
    });
    expect(access.trash).toHaveBeenCalledWith("account-1", action.id, 2);
  });
});

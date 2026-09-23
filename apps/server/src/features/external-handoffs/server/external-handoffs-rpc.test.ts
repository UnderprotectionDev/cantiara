import type { Context } from "@cantiara/api/context";
import type {
  ExternalExecutionHandoff,
  ExternalExecutionHandoffsAccess,
} from "@cantiara/api/external-handoffs";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const handoff: ExternalExecutionHandoff = {
  constraints: "Keep the existing API contract.",
  createdAt: "2026-09-23T12:00:00.000Z",
  executor: "Local coding agent",
  expectedOutput: "A tested implementation.",
  githubContext: ["https://github.com/acme/cantiara/issues/166"],
  handoffId: "handoff-1",
  includeWork: true,
  packageMarkdown: "# External Execution Handoff\n",
  packageProducedAt: "2026-09-23T12:00:00.000Z",
  purpose: "Implement external handoffs.",
  selectedWorkRevision: 4,
  status: "Open",
  workId: "work-1",
};

function createContext(workHandoffs: ExternalExecutionHandoffsAccess): Context {
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
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
    workHandoffs,
  };
}

describe("External Execution Handoff RPC", () => {
  test("lists and starts a handoff through its owning Work", async () => {
    const access: ExternalExecutionHandoffsAccess = {
      list: vi.fn().mockResolvedValue([handoff]),
      start: vi.fn().mockResolvedValue(handoff),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(access),
    });

    await expect(
      client.externalExecutionHandoffs({ workId: handoff.workId }),
    ).resolves.toEqual([handoff]);
    await expect(
      client.startExternalExecutionHandoff({
        baseRevision: handoff.selectedWorkRevision ?? 0,
        clientIdempotencyKey: "start-handoff-1",
        constraints: handoff.constraints,
        executor: handoff.executor,
        expectedOutput: handoff.expectedOutput,
        githubContext: handoff.githubContext,
        includeWork: handoff.includeWork,
        purpose: handoff.purpose,
        workId: handoff.workId,
      }),
    ).resolves.toEqual(handoff);

    expect(access.list).toHaveBeenCalledWith("account-1", handoff.workId);
    expect(access.start).toHaveBeenCalledWith("account-1", {
      baseRevision: 4,
      clientIdempotencyKey: "start-handoff-1",
      constraints: handoff.constraints,
      executor: handoff.executor,
      expectedOutput: handoff.expectedOutput,
      githubContext: handoff.githubContext,
      includeWork: handoff.includeWork,
      purpose: handoff.purpose,
      workId: handoff.workId,
    });
  });
});

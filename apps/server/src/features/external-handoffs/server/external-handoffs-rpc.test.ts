import type { Context } from "@cantiara/api/context";
import type {
  ExternalExecutionHandoff,
  ExternalExecutionHandoffHistoryEvent,
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

const historyEvent: ExternalExecutionHandoffHistoryEvent = {
  actorId: "account-1",
  eventId: "external-handoff:handoff-1:started",
  eventType: "external-execution-handoff-started",
  handoffId: handoff.handoffId,
  occurredAt: "2026-09-23T12:00:00.000Z",
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
      listHistory: vi.fn().mockResolvedValue([historyEvent]),
      recordPackageExport: vi.fn().mockResolvedValue({
        ...historyEvent,
        eventId: "external-handoff:handoff-1:export:copy-1",
        eventType: "external-execution-handoff-package-exported",
      }),
      start: vi.fn().mockResolvedValue(handoff),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(access),
    });

    await expect(
      client.externalExecutionHandoffs({ workId: handoff.workId }),
    ).resolves.toEqual([handoff]);
    await expect(
      client.externalExecutionHandoffHistory({ workId: handoff.workId }),
    ).resolves.toEqual([historyEvent]);
    await expect(
      client.recordExternalExecutionHandoffPackageExport({
        clientEventId: "copy-1",
        handoffId: handoff.handoffId,
      }),
    ).resolves.toEqual({
      ...historyEvent,
      eventId: "external-handoff:handoff-1:export:copy-1",
      eventType: "external-execution-handoff-package-exported",
    });
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
    expect(access.listHistory).toHaveBeenCalledWith(
      "account-1",
      handoff.workId,
    );
    expect(access.recordPackageExport).toHaveBeenCalledWith("account-1", {
      clientEventId: "copy-1",
      handoffId: handoff.handoffId,
    });
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

  test("rejects unsupported source versions and GitHub URLs before writing", async () => {
    const access: ExternalExecutionHandoffsAccess = {
      list: vi.fn().mockResolvedValue([handoff]),
      listHistory: vi.fn().mockResolvedValue([historyEvent]),
      recordPackageExport: vi.fn().mockResolvedValue(historyEvent),
      start: vi.fn().mockResolvedValue(handoff),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(access),
    });
    const input = {
      baseRevision: 4,
      clientIdempotencyKey: "start-invalid-handoff",
      constraints: "",
      executor: "Local coding agent",
      expectedOutput: "A tested implementation.",
      githubContext: [
        "https://github.com/acme/cantiara/issues/166?access_token=secret",
      ],
      includeWork: true,
      purpose: "Implement external handoffs.",
      workId: handoff.workId,
    };

    await expect(
      client.startExternalExecutionHandoff(input),
    ).rejects.toBeDefined();
    const unsupportedSelection = {
      ...input,
      documentVersions: [{ recordId: "document-1", revision: 1 }],
      githubContext: [],
    };
    await expect(
      client.startExternalExecutionHandoff(unsupportedSelection),
    ).rejects.toBeDefined();
    expect(access.start).not.toHaveBeenCalled();
  });
});

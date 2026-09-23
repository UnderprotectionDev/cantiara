import type { Context } from "@cantiara/api/context";
import type {
  ExternalExecutionHandoff,
  ExternalExecutionHandoffHistoryEvent,
  ExternalExecutionHandoffReconcilePreview,
  ExternalExecutionHandoffsAccess,
} from "@cantiara/api/external-handoffs";
import {
import {
  externalExecutionHandoffProposedRelationSchema,
  externalExecutionHandoffSchema,
  externalExecutionHandoffStatusSchema,
  isTerminalExternalExecutionHandoffStatus,
} from "@cantiara/api/external-handoffs";
} from "@cantiara/api/external-handoffs";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const handoff: ExternalExecutionHandoff = {
  cancellationReason: null,
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
  reconcileDecision: null,
  result: null,
  selectedWorkRevision: 4,
  status: "Open",
  workId: "work-1",
};

const canceledHandoff: ExternalExecutionHandoff = {
  ...handoff,
  cancellationReason: "The work is no longer needed.",
  status: "Canceled",
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
  test("keeps a returned result on the same handoff without closing its Work", () => {
    const returned = externalExecutionHandoffSchema.parse({
      ...handoff,
      result: {
        changedAssumptions: ["The public API already supplies the input."],
        executorSummary: "Implemented the return and reconcile flow.",
        externalLinks: ["https://github.com/acme/cantiara/pull/42"],
        openQuestions: ["Should the next handoff add another source version?"],
        producedEvidence: ["The contract test passes."],
        returnedAt: "2026-09-23T12:30:00.000Z",
      },
      status: "Result returned",
    });

    expect(returned).toMatchObject({
      handoffId: handoff.handoffId,
      result: {
        executorSummary: "Implemented the return and reconcile flow.",
      },
      status: "Result returned",
      workId: handoff.workId,
    });
  });

  test("accepts only Work targets in reconcile relation proposals", () => {
    const nonWorkTargets = ["Decision", "Risk", "Document"];
    const results = nonWorkTargets.map(
      (recordType) =>
        externalExecutionHandoffProposedRelationSchema.safeParse({
          id: `relation-${recordType.toLowerCase()}`,
          kind: "Related",
          targetRecordType: recordType,
          targetWorkId: `${recordType.toLowerCase()}-1`,
        }).success,
    );

    expect(results).toEqual([false, false, false]);
  });

  test("lists and starts a handoff through its owning Work", async () => {
    const access: ExternalExecutionHandoffsAccess = {
      cancel: vi.fn().mockResolvedValue(canceledHandoff),
      confirmReconcile: vi.fn().mockResolvedValue(handoff),
      list: vi.fn().mockResolvedValue([handoff]),
      listHistory: vi.fn().mockResolvedValue([historyEvent]),
      listRelatedWorks: vi.fn().mockResolvedValue([]),
      previewReconcile: vi.fn().mockResolvedValue(null),
      recordReturn: vi.fn().mockResolvedValue(handoff),
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

  test("rejects unsupported source versions and unrelated actions before writing", async () => {
    const access: ExternalExecutionHandoffsAccess = {
      cancel: vi.fn().mockResolvedValue(canceledHandoff),
      confirmReconcile: vi.fn().mockResolvedValue(handoff),
      list: vi.fn().mockResolvedValue([handoff]),
      listHistory: vi.fn().mockResolvedValue([historyEvent]),
      listRelatedWorks: vi.fn().mockResolvedValue([]),
      previewReconcile: vi.fn().mockResolvedValue(null),
      recordReturn: vi.fn().mockResolvedValue(handoff),
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
    const unsupportedActions = {
      ...input,
      assignedReviewerId: "external-person-1",
      githubContext: [],
      productGapEscapeEvent: { reason: "Left for another tool." },
      publicationArtifact: { id: "release-1" },
      testHandoffPackage: { id: "test-handoff-1" },
      testSession: { id: "test-session-1" },
    };
    await expect(
      client.startExternalExecutionHandoff(unsupportedActions),
    ).rejects.toBeDefined();
    expect(access.start).not.toHaveBeenCalled();
  });

  test("cancels through the Work-owned interface and requires a reason", async () => {
    const access: ExternalExecutionHandoffsAccess = {
      cancel: vi.fn().mockResolvedValue(canceledHandoff),
      confirmReconcile: vi.fn().mockResolvedValue(handoff),
      list: vi.fn().mockResolvedValue([handoff]),
      listHistory: vi.fn().mockResolvedValue([historyEvent]),
      listRelatedWorks: vi.fn().mockResolvedValue([]),
      previewReconcile: vi.fn().mockResolvedValue(null),
      recordReturn: vi.fn().mockResolvedValue(handoff),
      recordPackageExport: vi.fn().mockResolvedValue(historyEvent),
      start: vi.fn().mockResolvedValue(handoff),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(access),
    });
    const input = {
      clientEventId: "cancel-handoff-1",
      handoffId: handoff.handoffId,
      reason: "The work is no longer needed.",
    };

    await expect(client.cancelExternalExecutionHandoff(input)).resolves.toEqual(
      canceledHandoff,
    );
    await expect(
      client.cancelExternalExecutionHandoff({ ...input, reason: "   " }),
    ).rejects.toBeDefined();
    expect(access.cancel).toHaveBeenCalledTimes(1);
    expect(access.cancel).toHaveBeenCalledWith("account-1", input);
  });

  test("keeps returned handoffs open and recognizes only terminal statuses", () => {
    for (const status of ["Open", "Result returned"] as const) {
      expect(externalExecutionHandoffStatusSchema.parse(status)).toBe(status);
      expect(isTerminalExternalExecutionHandoffStatus(status)).toBe(false);
    }
    for (const status of ["Reconciled", "Canceled"] as const) {
      expect(externalExecutionHandoffStatusSchema.parse(status)).toBe(status);
      expect(isTerminalExternalExecutionHandoffStatus(status)).toBe(true);
    }
  });

  test("previews selected Work bindings before returning and confirming", async () => {
    const returnedHandoff: ExternalExecutionHandoff = {
      ...handoff,
      result: {
        changedAssumptions: [],
        executorSummary: "Completed the requested coding pass.",
        externalLinks: [],
        openQuestions: [],
        producedEvidence: ["The API contract test passed."],
        returnedAt: "2026-09-23T12:30:00.000Z",
      },
      status: "Result returned",
    };
    const relatedWork = {
      id: "work-2",
      key: "CAT-2",
      status: "Not Started" as const,
      title: "Review the result",
      type: "Task" as const,
    };
    const preview: ExternalExecutionHandoffReconcilePreview = {
      followUpWorks: [
        {
          description: null,
          id: "follow-up-1",
          projectId: "project-1",
          projectName: "Cantiara",
          relatedToWorkId: handoff.workId,
          relationKind: "Origin",
          title: "Verify the result",
          type: "Task",
        },
      ],
      handoffId: handoff.handoffId,
      previewId: "preview-1",
      proposedRelations: [
        {
          id: "relation-1",
          kind: "Related",
          sourceLabel: "CAT-1",
          sourceWorkId: handoff.workId,
          target: relatedWork,
        },
      ],
    };
    const reconciledHandoff: ExternalExecutionHandoff = {
      ...returnedHandoff,
      reconcileDecision: {
        confirmedAt: "2026-09-23T12:40:00.000Z",
        confirmedBy: "account-1",
        createdFollowUpWorks: [],
        createdRelations: [],
        decisionId: "decision-1",
        previewId: preview.previewId,
        selectedFollowUpWorkIds: [],
        selectedRelationIds: ["relation-1"],
      },
      status: "Reconciled",
    };
    const access: ExternalExecutionHandoffsAccess = {
      cancel: vi.fn().mockResolvedValue(canceledHandoff),
      confirmReconcile: vi.fn().mockResolvedValue(reconciledHandoff),
      list: vi.fn().mockResolvedValue([returnedHandoff]),
      listHistory: vi.fn().mockResolvedValue([historyEvent]),
      listRelatedWorks: vi.fn().mockResolvedValue([relatedWork]),
      previewReconcile: vi.fn().mockResolvedValue(preview),
      recordReturn: vi.fn().mockResolvedValue(returnedHandoff),
      recordPackageExport: vi.fn().mockResolvedValue(historyEvent),
      start: vi.fn().mockResolvedValue(handoff),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(access),
    });
    const plan = {
      followUpWorks: preview.followUpWorks.map(
        ({ description, id, title, type }) => ({
          description,
          id,
          title,
          type,
        }),
      ),
      proposedRelations: [
        { id: "relation-1", kind: "Related" as const, targetWorkId: "work-2" },
      ],
    };
    const result = {
      changedAssumptions: [],
      executorSummary: "Completed the requested coding pass.",
      externalLinks: [],
      openQuestions: [],
      producedEvidence: ["The API contract test passed."],
    };

    await expect(
      client.externalExecutionHandoffRelatedWorks({
        workId: handoff.workId,
      }),
    ).resolves.toEqual([relatedWork]);
    await expect(
      client.recordExternalExecutionHandoffReturn({
        ...result,
        clientEventId: "return-1",
        handoffId: handoff.handoffId,
      }),
    ).resolves.toEqual(returnedHandoff);
    await expect(
      client.previewExternalExecutionHandoffReconcile({
        ...plan,
        handoffId: handoff.handoffId,
      }),
    ).resolves.toEqual(preview);
    await expect(
      client.confirmExternalExecutionHandoffReconcile({
        ...plan,
        clientEventId: "reconcile-1",
        handoffId: handoff.handoffId,
        previewId: preview.previewId,
        selectedFollowUpWorkIds: [],
        selectedRelationIds: ["relation-1"],
      }),
    ).resolves.toEqual(reconciledHandoff);

    expect(access.recordReturn).toHaveBeenCalledWith("account-1", {
      ...result,
      clientEventId: "return-1",
      handoffId: handoff.handoffId,
    });
    expect(access.confirmReconcile).toHaveBeenCalledWith("account-1", {
      ...plan,
      clientEventId: "reconcile-1",
      handoffId: handoff.handoffId,
      previewId: preview.previewId,
      selectedFollowUpWorkIds: [],
      selectedRelationIds: ["relation-1"],
    });
  });
});

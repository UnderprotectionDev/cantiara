import type { Context } from "@cantiara/api/context";
import { MUTATION_UI_LABELS } from "@cantiara/api/mutation-and-undo";
import type { ProjectSourceRecordsAccess } from "@cantiara/api/project-source-records";
import {
  ProjectSourceRecordConflictError,
  transitionProjectSourceRecordInputSchema,
} from "@cantiara/api/project-source-records";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const accountId = "founder-account";
const decisionRecord = {
  createdAt: "2026-09-27T10:00:00.000Z",
  decision: "Ship a focused first release.",
  id: "decision-1",
  life: "Valid",
  projectId: "project-1",
  rationale: null,
  revision: 1,
  sourceType: "Decision",
  title: "First release scope",
  updatedAt: "2026-09-27T10:00:00.000Z",
} as const;

function testClient(session: Context["session"] | null) {
  const projectSourceRecords: ProjectSourceRecordsAccess = {
    create: vi.fn().mockResolvedValue(decisionRecord),
    find: vi.fn().mockResolvedValue(decisionRecord),
    list: vi.fn().mockResolvedValue([decisionRecord]),
    listDecisions: vi
      .fn()
      .mockResolvedValue({ records: [decisionRecord], readOnly: false }),
    transition: vi
      .fn()
      .mockResolvedValue({ ...decisionRecord, life: "Withdrawn" }),
    update: vi.fn().mockResolvedValue(decisionRecord),
  };
  const context = {
    auth: null,
    db: {} as Context["db"],
    projectSourceRecords,
    session,
  } as Context;
  return {
    client: createRouterClient(appRouter, { context }),
    projectSourceRecords,
  };
}

describe("Project source record RPC", () => {
  test("Decisions supersession binds the Account and maps dropped and conflicting commits to visible failures", async () => {
    const { client, projectSourceRecords } = testClient({
      session: { id: "session-1" },
      user: { id: accountId },
    } as Context["session"]);
    const commit = vi.fn().mockResolvedValue(null);
    const preview = vi.fn().mockResolvedValue(null);
    projectSourceRecords.supersession = {
      commit,
      preview,
      history: vi.fn().mockResolvedValue([]),
      read: vi.fn().mockResolvedValue(null),
    };
    const selection = {
      projectId: "project-1",
      successorId: "new",
      predecessorIds: ["old"],
      operation: "supersede" as const,
      rationale: null,
    };
    const command = {
      ...selection,
      baseRevision: 0,
      clientIdempotencyKey: "confirm",
      previewFingerprint: "preview",
    };
    await expect(
      client.commitDecisionSupersession(command),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(commit).toHaveBeenCalledExactlyOnceWith(accountId, command);
    commit.mockRejectedValueOnce(
      new ProjectSourceRecordConflictError("project-1"),
    );
    await expect(
      client.commitDecisionSupersession(command),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      client.previewDecisionSupersession(selection),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const unauthenticated = testClient(null).client;
    await expect(
      unauthenticated.commitDecisionSupersession(command),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("supersession history uses the authenticated Account and rejects anonymous reads", async () => {
    const { client, projectSourceRecords } = testClient({
      session: { id: "session-1" },
      user: { id: accountId },
    } as Context["session"]);
    const history = vi.fn().mockResolvedValue([]);
    projectSourceRecords.supersession = {
      history,
      commit: vi.fn().mockResolvedValue(null),
      preview: vi.fn().mockResolvedValue(null),
      read: vi.fn().mockResolvedValue(null),
    };
    await expect(
      client.decisionSupersessionHistory({ projectId: "project-1" }),
    ).resolves.toEqual([]);
    expect(history).toHaveBeenCalledExactlyOnceWith(accountId, "project-1");
    await expect(
      testClient(null).client.decisionSupersessionHistory({
        projectId: "project-1",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("binds create, read, and transition calls to the authenticated Account", async () => {
    const { client, projectSourceRecords } = testClient({
      session: { id: "session-1" },
      user: { id: accountId },
    } as Context["session"]);

    await expect(
      client.createProjectSourceRecord({
        baseRevision: 0,
        clientIdempotencyKey: "decision-create",
        decision: "Ship a focused first release.",
        id: "decision-1",
        projectId: "project-1",
        rationale: null,
        sourceType: "Decision",
        title: "First release scope",
      }),
    ).resolves.toEqual(decisionRecord);
    await expect(
      client.projectSourceRecord({
        sourceId: "decision-1",
        sourceType: "Decision",
      }),
    ).resolves.toEqual(decisionRecord);
    await expect(
      client.transitionProjectSourceRecord({
        baseRevision: 1,
        clientIdempotencyKey: "decision-withdraw",
        life: "Withdrawn",
        projectId: "project-1",
        sourceId: "decision-1",
        sourceType: "Decision",
      }),
    ).resolves.toMatchObject({ life: "Withdrawn" });

    expect(projectSourceRecords.create).toHaveBeenCalledWith(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "decision-create",
      decision: "Ship a focused first release.",
      id: "decision-1",
      projectId: "project-1",
      rationale: null,
      sourceType: "Decision",
      title: "First release scope",
    });
    expect(projectSourceRecords.find).toHaveBeenCalledExactlyOnceWith(
      accountId,
      "Decision",
      "decision-1",
    );
    expect(projectSourceRecords.transition).toHaveBeenCalledExactlyOnceWith(
      accountId,
      {
        baseRevision: 1,
        clientIdempotencyKey: "decision-withdraw",
        life: "Withdrawn",
        projectId: "project-1",
        sourceId: "decision-1",
        sourceType: "Decision",
      },
    );
  });

  test("rejects anonymous source access and invalid terminal transitions", async () => {
    const anonymous = testClient(null);
    await expect(
      anonymous.client.projectSourceRecord({
        sourceId: "decision-1",
        sourceType: "Decision",
      }),
    ).rejects.toThrow();
    expect(anonymous.projectSourceRecords.find).not.toHaveBeenCalled();

    const authenticated = testClient({
      session: { id: "session-1" },
      user: { id: accountId },
    } as Context["session"]);
    expect(
      transitionProjectSourceRecordInputSchema.safeParse({
        baseRevision: 1,
        clientIdempotencyKey: "decision-superseded",
        life: "Superseded",
        projectId: "project-1",
        sourceId: "decision-1",
        sourceType: "Decision",
      }).success,
    ).toBe(false);
    expect(
      authenticated.projectSourceRecords.transition,
    ).not.toHaveBeenCalled();
  });

  test("maps dropped Decision writes to client failures, never resolved successes", async () => {
    const { client, projectSourceRecords } = testClient({
      session: { id: "session-1" },
      user: { id: accountId },
    } as Context["session"]);
    vi.mocked(projectSourceRecords.create).mockResolvedValueOnce(null);
    vi.mocked(projectSourceRecords.update).mockResolvedValueOnce(null);
    vi.mocked(projectSourceRecords.transition).mockResolvedValueOnce(null);

    await expect(
      client.createProjectSourceRecord({
        baseRevision: 0,
        clientIdempotencyKey: "dropped-create",
        decision: "Ship a focused first release.",
        id: "decision-1",
        projectId: "project-1",
        rationale: null,
        sourceType: "Decision",
        title: "First release scope",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.updateProjectSourceRecord({
        baseRevision: 1,
        clientIdempotencyKey: "dropped-update",
        decision: "Ship a focused first release.",
        projectId: "project-1",
        rationale: null,
        sourceId: "decision-1",
        sourceType: "Decision",
        title: "First release scope",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.transitionProjectSourceRecord({
        baseRevision: 1,
        clientIdempotencyKey: "dropped-withdraw",
        life: "Withdrawn",
        projectId: "project-1",
        sourceId: "decision-1",
        sourceType: "Decision",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

test("Uncertainty Records binds Assumption reads and transitions to the Account and rejects anonymous access", async () => {
  const { client, projectSourceRecords } = testClient({
    session: { id: "session-1" },
    user: { id: accountId },
  } as Context["session"]);
  const listAssumptions = vi
    .fn()
    .mockResolvedValue({ records: [], evidence: [], readOnly: false });
  projectSourceRecords.listAssumptions = listAssumptions;
  await expect(
    client.projectAssumptions({ projectId: "project-1" }),
  ).resolves.toMatchObject({ records: [] });
  expect(listAssumptions).toHaveBeenCalledExactlyOnceWith(
    accountId,
    "project-1",
  );
  const command = {
    sourceType: "Assumption" as const,
    sourceId: "a1",
    projectId: "project-1",
    life: "Refuted" as const,
    baseRevision: 1,
    clientIdempotencyKey: "refute",
  };
  vi.mocked(projectSourceRecords.transition).mockResolvedValueOnce(null);
  await expect(
    client.transitionProjectSourceRecord(command),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  vi.mocked(projectSourceRecords.transition).mockRejectedValueOnce(
    new ProjectSourceRecordConflictError("a1"),
  );
  await expect(
    client.transitionProjectSourceRecord(command),
  ).rejects.toMatchObject({
    code: "CONFLICT",
    data: {
      code: "CONFLICT",
      label: MUTATION_UI_LABELS.conflict,
      targetId: "a1",
    },
    message: MUTATION_UI_LABELS.conflict,
  });
  const anonymous = testClient(null).client;
  await expect(
    anonymous.projectAssumptions({ projectId: "project-1" }),
  ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  await expect(
    anonymous.transitionProjectSourceRecord(command),
  ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});

test("Uncertainty Records protects Open Question reads and maps transition conflicts", async () => {
  const { client, projectSourceRecords } = testClient({
    session: { id: "session-1" },
    user: { id: accountId },
  } as Context["session"]);
  projectSourceRecords.listOpenQuestions = vi
    .fn()
    .mockResolvedValue({ records: [], readOnly: true });
  projectSourceRecords.openQuestionContext = vi
    .fn()
    .mockResolvedValue({ evidence: [], readOnly: true });
  await expect(
    client.openQuestions({ projectId: "project-1" }),
  ).resolves.toEqual({ records: [], readOnly: true });
  await expect(
    client.openQuestionContext({
      sourceId: "question-1",
      sourceType: "Open Question",
    }),
  ).resolves.toEqual({ evidence: [], readOnly: true });
  await expect(
    testClient(null).client.openQuestions({ projectId: "project-1" }),
  ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  await expect(
    testClient(null).client.openQuestionContext({
      sourceId: "question-1",
      sourceType: "Open Question",
    }),
  ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  await expect(
    client.openQuestionContext({
      sourceId: "decision-1",
      sourceType: "Decision",
    }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  const transition = vi
    .fn()
    .mockRejectedValue(new ProjectSourceRecordConflictError("question-1"));
  projectSourceRecords.transition = transition;
  await expect(
    client.transitionProjectSourceRecord({
      projectId: "project-1",
      sourceType: "Open Question",
      sourceId: "question-1",
      life: "Answered",
      answer: "Weekly",
      baseRevision: 1,
      clientIdempotencyKey: "answer-question",
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
});

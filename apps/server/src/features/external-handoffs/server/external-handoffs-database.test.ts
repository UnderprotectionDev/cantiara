import type {
  CancelExternalExecutionHandoffInput,
  ExternalExecutionHandoffStartCommand,
  ExternalExecutionHandoffsAccess,
  RecordExternalExecutionHandoffReturnInput,
} from "@cantiara/api/external-handoffs";
import { fingerprintMutationPayload } from "@cantiara/api/mutation-and-undo";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import {
  workExternalExecutionHandoff,
  workExternalExecutionHandoffAttentionSignal,
} from "@cantiara/db/schema/work-external-handoff";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseRelations } from "../../relations/server/relations";
import {
  createDatabaseExternalExecutionHandoffs,
  type ExternalExecutionHandoffAttentionSignal,
  type ExternalExecutionHandoffAttentionSignalSink,
  ExternalExecutionHandoffReconcileUnavailableError,
} from "./external-handoffs-database";

const databaseUrl =
  process.env.ACCOUNT_ACCESS_DATABASE_URL ?? process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

async function recordReturnedHandoff(
  handoffs: ExternalExecutionHandoffsAccess,
  accountId: string,
  workId: string,
  handoffId: string,
) {
  const started = await handoffs.start(accountId, {
    baseRevision: 0,
    clientIdempotencyKey: `start-${handoffId}`,
    constraints: "Keep the existing API contract.",
    executor: "Local coding agent",
    expectedOutput: "A tested implementation.",
    githubContext: [],
    includeWork: true,
    purpose: "Implement external handoffs.",
    workId,
  });
  if (!started) {
    throw new Error("Could not start the test handoff.");
  }
  const returned = await handoffs.recordReturn(accountId, {
    changedAssumptions: ["The result must be reviewed by the founder."],
    clientEventId: `return-${handoffId}`,
    executorSummary: "The external implementation is ready for review.",
    externalLinks: ["https://github.com/acme/cantiara/pull/42"],
    handoffId,
    openQuestions: ["Is a second pass needed?"],
    producedEvidence: ["The contract test completed."],
  });
  if (!returned) {
    throw new Error("Could not record the test handoff return.");
  }
  return returned;
}

function captureAttentionSignalEvents() {
  const events: (
    | { closedAt: string; kind: "closed"; signalId: string }
    | {
        kind: "produced";
        signal: ExternalExecutionHandoffAttentionSignal;
      }
  )[] = [];
  const sink: ExternalExecutionHandoffAttentionSignalSink = {
    close: (_transaction, signalId, closedAt) => {
      events.push({
        closedAt: closedAt.toISOString(),
        kind: "closed",
        signalId,
      });
    },
    produce: (_transaction, signal) => {
      events.push({ kind: "produced", signal });
    },
  };

  return { events, sink };
}

describeDatabase("External Execution Handoff seam", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `external-handoffs-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;
  const workId = `work-${crypto.randomUUID()}`;

  function listWorkRelations() {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    return createDatabaseRelations(database).list(accountId, {
      recordId: workId,
      recordType: "Work",
    });
  }

  beforeEach(async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    await database.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Founder",
    });
    await database.insert(workspace).values({
      id: workspaceId,
      ownerAccountId: accountId,
    });
    await database.insert(project).values({
      id: projectId,
      name: "Handoff Project",
      shortCode: `EH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
    await database.insert(work).values({
      description: "Create a frozen Markdown package.",
      id: workId,
      key: "EH-1",
      number: 1,
      projectId,
      revision: 0,
      title: "Start Handoff",
      type: "Feature",
    });
  });

  afterEach(async () => {
    await database
      ?.delete(mutationHistory)
      .where(eq(mutationHistory.actorId, accountId));
    await database?.delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("keeps each selected Work version package frozen and idempotent", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    let nextId = 0;
    const handoffs = createDatabaseExternalExecutionHandoffs(database, {
      now: () => new Date("2026-09-23T12:00:00.000Z"),
      newId: () => {
        nextId += 1;
        return `handoff-${nextId}`;
      },
    });
    const firstCommand: ExternalExecutionHandoffStartCommand = {
      baseRevision: 0,
      clientIdempotencyKey: "start-first-handoff",
      constraints: "Keep the existing API contract.",
      executor: "Local coding agent",
      expectedOutput: "A tested implementation.",
      githubContext: ["https://github.com/acme/cantiara/issues/166"],
      includeWork: true,
      purpose: "Implement external handoffs.",
      workId,
    };

    const first = await handoffs.start(accountId, firstCommand);
    expect(first).toMatchObject({
      handoffId: "handoff-1",
      selectedWorkRevision: 0,
      status: "Open",
      workId,
    });
    expect(first?.packageMarkdown).toContain(
      "Create a frozen Markdown package.",
    );

    const startedHistory = await handoffs.listHistory(accountId, workId);
    expect(startedHistory).toHaveLength(2);
    expect(startedHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: accountId,
          eventType: "external-execution-handoff-started",
          handoffId: "handoff-1",
          occurredAt: "2026-09-23T12:00:00.000Z",
        }),
        expect.objectContaining({
          actorId: accountId,
          eventType: "external-execution-handoff-package-produced",
          handoffId: "handoff-1",
          occurredAt: "2026-09-23T12:00:00.000Z",
        }),
      ]),
    );
    expect(JSON.stringify(startedHistory)).not.toContain(
      "Create a frozen Markdown package.",
    );

    const copied = await handoffs.recordPackageExport(accountId, {
      clientEventId: "copy-first-package",
      handoffId: "handoff-1",
    });
    expect(copied).toMatchObject({
      actorId: accountId,
      eventType: "external-execution-handoff-package-exported",
      handoffId: "handoff-1",
      occurredAt: "2026-09-23T12:00:00.000Z",
    });
    expect(copied?.eventId?.startsWith("external-handoff-event-")).toBe(true);
    expect(copied?.eventId).toHaveLength("external-handoff-event-".length + 64);
    await expect(
      handoffs.recordPackageExport(accountId, {
        clientEventId: "copy-first-package",
        handoffId: "handoff-1",
      }),
    ).resolves.toEqual(copied);

    const withoutWork = await handoffs.start(accountId, {
      ...firstCommand,
      clientIdempotencyKey: "start-without-work-version",
      includeWork: false,
      purpose: "Run without the Work body.",
    });
    expect(withoutWork).toMatchObject({
      handoffId: "handoff-2",
      selectedWorkRevision: null,
    });
    expect(withoutWork?.packageMarkdown).toContain(
      "- No Work version selected.",
    );
    expect(withoutWork?.packageMarkdown).not.toContain(
      "Create a frozen Markdown package.",
    );

    await expect(handoffs.start(accountId, firstCommand)).resolves.toEqual(
      first,
    );
    await expect(
      handoffs.start(accountId, {
        ...firstCommand,
        purpose: "A different request with the same idempotency key.",
      }),
    ).rejects.toMatchObject({ code: "EXTERNAL_HANDOFF_IDEMPOTENCY_CONFLICT" });

    await database
      .update(work)
      .set({
        description: "This later edit must not alter the sent package.",
        revision: 1,
        title: "Changed Work title",
      })
      .where(eq(work.id, workId));

    const second = await handoffs.start(accountId, {
      ...firstCommand,
      baseRevision: 1,
      clientIdempotencyKey: "start-second-handoff",
      purpose: "Run a second pass.",
    });
    const listed = await handoffs.list(accountId, workId);

    expect(listed).toHaveLength(3);
    expect(listed?.[0]?.packageMarkdown).toBe(first?.packageMarkdown);
    expect(listed?.[0]?.packageMarkdown).not.toContain("Changed Work title");
    expect(listed?.[2]).toMatchObject({
      handoffId: "handoff-3",
      purpose: "Run a second pass.",
      selectedWorkRevision: 1,
    });
    expect(second?.packageMarkdown).toContain("Changed Work title");
    const secondHandoffHistory = await handoffs.listHistory(accountId, workId);
    const secondHandoffEvents = secondHandoffHistory?.filter(
      (event) => event.handoffId === second?.handoffId,
    );
    expect(secondHandoffEvents).toHaveLength(2);
    expect(secondHandoffEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "external-execution-handoff-started",
        }),
        expect.objectContaining({
          eventType: "external-execution-handoff-package-produced",
        }),
      ]),
    );
    await expect(handoffs.list("another-account", workId)).resolves.toBeNull();

    await database
      .update(work)
      .set({ archivedAt: new Date("2026-09-23T13:00:00.000Z") })
      .where(eq(work.id, workId));

    const archivedHistory = await handoffs.listHistory(accountId, workId);
    expect(await handoffs.list(accountId, workId)).toHaveLength(3);
    expect(archivedHistory?.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        "external-execution-handoff-started",
        "external-execution-handoff-package-produced",
        "external-execution-handoff-package-exported",
      ]),
    );
    await expect(
      handoffs.start(accountId, {
        ...firstCommand,
        baseRevision: 1,
        clientIdempotencyKey: "start-archived-work",
      }),
    ).resolves.toBeNull();
    await expect(
      handoffs.cancel(accountId, {
        clientEventId: "cancel-archived-work",
        handoffId: "handoff-1",
        reason: "Archived handoffs are read-only.",
      }),
    ).resolves.toBeNull();
    await expect(
      handoffs.listHistory("another-account", workId),
    ).resolves.toBeNull();
  });

  test("cancels with a reason, preserves history, and starts a new handoff", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    let now = new Date("2026-09-23T12:00:00.000Z");
    let nextId = 0;
    const handoffs = createDatabaseExternalExecutionHandoffs(database, {
      now: () => now,
      newId: () => {
        nextId += 1;
        return `handoff-${nextId}`;
      },
    });
    const firstCommand: ExternalExecutionHandoffStartCommand = {
      baseRevision: 0,
      clientIdempotencyKey: "start-cancelled-pass",
      constraints: "Keep the existing API contract.",
      executor: "Local coding agent",
      expectedOutput: "A tested implementation.",
      githubContext: ["https://github.com/acme/cantiara/pull/173"],
      includeWork: true,
      purpose: "First coding pass",
      workId,
    };
    const first = await handoffs.start(accountId, firstCommand);

    expect(first).toMatchObject({
      cancellationReason: null,
      handoffId: "handoff-1",
      status: "Open",
    });

    now = new Date("2026-09-23T12:05:00.000Z");
    const cancelInput: CancelExternalExecutionHandoffInput = {
      clientEventId: "cancel-first-pass",
      handoffId: "handoff-1",
      reason: "The selected approach changed.",
    };
    const canceled = await handoffs.cancel(accountId, cancelInput);

    expect(canceled).toMatchObject({
      cancellationReason: cancelInput.reason,
      handoffId: "handoff-1",
      packageMarkdown: first?.packageMarkdown,
      status: "Canceled",
    });
    await expect(handoffs.cancel(accountId, cancelInput)).resolves.toEqual(
      canceled,
    );
    await expect(
      handoffs.cancel(accountId, {
        ...cancelInput,
        reason: "A different reason.",
      }),
    ).rejects.toMatchObject({ code: "EXTERNAL_HANDOFF_IDEMPOTENCY_CONFLICT" });

    now = new Date("2026-09-23T12:10:00.000Z");
    const second = await handoffs.start(accountId, {
      ...firstCommand,
      clientIdempotencyKey: "start-second-pass",
      purpose: "Second coding pass",
    });
    expect(second).toMatchObject({
      cancellationReason: null,
      handoffId: "handoff-2",
      status: "Open",
    });
    await database
      .update(workExternalExecutionHandoff)
      .set({ status: "Result returned" })
      .where(eq(workExternalExecutionHandoff.handoffId, "handoff-2"));

    await database
      .update(work)
      .set({
        closureResult: "Completed",
        revision: 1,
        status: "Closed",
      })
      .where(eq(work.id, workId));

    const listed = await handoffs.list(accountId, workId);
    expect(listed).toMatchObject([
      { handoffId: "handoff-1", status: "Canceled" },
      { handoffId: "handoff-2", status: "Result returned" },
    ]);
    now = new Date("2026-09-23T12:15:00.000Z");
    const canceledReturn = await handoffs.cancel(accountId, {
      clientEventId: "cancel-returned-pass",
      handoffId: "handoff-2",
      reason: "The returned work is no longer needed.",
    });
    expect(canceledReturn).toMatchObject({
      cancellationReason: "The returned work is no longer needed.",
      handoffId: "handoff-2",
      packageMarkdown: second?.packageMarkdown,
      status: "Canceled",
    });
    await expect(
      handoffs.cancel(accountId, {
        clientEventId: "cancel-returned-pass-again",
        handoffId: "handoff-2",
        reason: "A second cancellation cannot reopen or rewrite the handoff.",
      }),
    ).rejects.toMatchObject({ code: "EXTERNAL_HANDOFF_TERMINAL" });
    const history = await handoffs.listHistory(accountId, workId);
    expect(history).toHaveLength(6);
    const handoffEventTypes = (handoffId: string) =>
      history
        ?.filter((event) => event.handoffId === handoffId)
        .map((event) => event.eventType)
        .sort();
    const expectedHandoffEventTypes = [
      "external-execution-handoff-canceled",
      "external-execution-handoff-package-produced",
      "external-execution-handoff-started",
    ];
    expect(handoffEventTypes("handoff-1")).toEqual(expectedHandoffEventTypes);
    expect(handoffEventTypes("handoff-2")).toEqual(expectedHandoffEventTypes);
    const cancellationEvents =
      history?.filter(
        (event) => event.eventType === "external-execution-handoff-canceled",
      ) ?? [];
    expect(cancellationEvents).toHaveLength(2);
    for (const event of cancellationEvents) {
      expect(event).not.toHaveProperty("reason");
    }
  });

  test("records a late return on its handoff without changing Work or making records", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const handoffs = createDatabaseExternalExecutionHandoffs(database, {
      now: () => new Date("2026-09-23T12:30:00.000Z"),
      newId: () => "handoff-return",
    });
    const started = await handoffs.start(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "start-return-handoff",
      constraints: "Keep the existing API contract.",
      executor: "Local coding agent",
      expectedOutput: "A tested implementation.",
      githubContext: [],
      includeWork: true,
      purpose: "Implement external handoffs.",
      workId,
    });
    const beforeWork = await database
      .select({ revision: work.revision, status: work.status })
      .from(work)
      .where(eq(work.id, workId));

    const returned = await handoffs.recordReturn(accountId, {
      changedAssumptions: ["The server owns relationship validation."],
      clientEventId: "return-late-handoff",
      executorSummary: "The executor returned after the review window.",
      externalLinks: ["https://github.com/acme/cantiara/pull/42"],
      handoffId: started?.handoffId ?? "missing-handoff",
      openQuestions: ["Should the next handoff add more context?"],
      producedEvidence: ["The contract check passed."],
    } satisfies RecordExternalExecutionHandoffReturnInput);

    expect(returned).toMatchObject({
      handoffId: "handoff-return",
      result: {
        executorSummary: "The executor returned after the review window.",
        producedEvidence: ["The contract check passed."],
      },
      status: "Result returned",
      workId,
    });
    expect(
      await database
        .select({ revision: work.revision, status: work.status })
        .from(work)
        .where(eq(work.id, workId)),
    ).toEqual(beforeWork);
    expect(await database.select({ id: work.id }).from(work)).toHaveLength(1);
    await expect(listWorkRelations()).resolves.toEqual([]);
    const history = await handoffs.listHistory(accountId, workId);
    expect(history).toHaveLength(3);
    expect(history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "external-execution-handoff-package-produced",
          handoffId: "handoff-return",
        }),
        expect.objectContaining({
          eventType: "external-execution-handoff-started",
          handoffId: "handoff-return",
        }),
        expect.objectContaining({
          eventType: "external-execution-handoff-return-recorded",
          handoffId: "handoff-return",
          occurredAt: "2026-09-23T12:30:00.000Z",
        }),
      ]),
    );
  });

  test("produces one source-linked Action Required signal for a returned handoff", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const { events: signalEvents, sink: attentionSignalSink } =
      captureAttentionSignalEvents();
    const handoffId = "handoff-returned-signal";
    const returnedAt = new Date("2026-09-23T12:30:00.000Z");
    const handoffs = createDatabaseExternalExecutionHandoffs(database, {
      attentionSignalSink,
      newId: () => handoffId,
      now: () => returnedAt,
    });
    const started = await handoffs.start(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "start-returned-signal",
      constraints: "Keep the existing API contract.",
      executor: "Local coding agent",
      expectedOutput: "A reviewed result.",
      githubContext: [],
      includeWork: true,
      purpose: "Implement the returned signal.",
      workId,
    });
    if (!started) {
      throw new Error("Could not start the test handoff.");
    }
    const returnInput: RecordExternalExecutionHandoffReturnInput = {
      changedAssumptions: [],
      clientEventId: "return-returned-signal",
      executorSummary: "The external result is ready for review.",
      externalLinks: [],
      handoffId,
      openQuestions: [],
      producedEvidence: [],
    };

    await handoffs.recordReturn(accountId, returnInput);

    const returnEvent = (await handoffs.listHistory(accountId, workId))?.find(
      (event) =>
        event.eventType === "external-execution-handoff-return-recorded",
    );
    expect(returnEvent).toBeDefined();
    expect(signalEvents).toEqual([
      {
        kind: "produced",
        signal: {
          occurredAt: returnedAt.toISOString(),
          ownerAccountId: accountId,
          presentation: "Action Required",
          signalId: `external-run-returned:${handoffId}`,
          signalType: "external-run-returned",
          source: {
            eventId: returnEvent?.eventId,
            handoffId,
            workId,
          },
        },
      },
    ]);

    await handoffs.recordReturn(accountId, returnInput);

    expect(signalEvents).toHaveLength(1);
  });

  test("keeps a returned signal tombstone when its Work is deleted", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const handoffId = "handoff-deleted-source-signal";
    const handoffs = createDatabaseExternalExecutionHandoffs(database, {
      newId: () => handoffId,
      now: () => new Date("2026-09-23T12:30:00.000Z"),
    });
    await recordReturnedHandoff(handoffs, accountId, workId, handoffId);

    const returnEvent = (await handoffs.listHistory(accountId, workId))?.find(
      (event) =>
        event.eventType === "external-execution-handoff-return-recorded",
    );
    if (!returnEvent) {
      throw new Error("The return event was not recorded.");
    }

    await database.delete(work).where(eq(work.id, workId));

    expect(await handoffs.list(accountId, workId)).toBeNull();
    const [signal] = await database
      .select({
        handoffId: workExternalExecutionHandoffAttentionSignal.handoffId,
        ownerAccountId:
          workExternalExecutionHandoffAttentionSignal.ownerAccountId,
        signalId: workExternalExecutionHandoffAttentionSignal.signalId,
        sourceEventId:
          workExternalExecutionHandoffAttentionSignal.sourceEventId,
        sourceWorkId: workExternalExecutionHandoffAttentionSignal.sourceWorkId,
      })
      .from(workExternalExecutionHandoffAttentionSignal)
      .where(
        eq(
          workExternalExecutionHandoffAttentionSignal.signalId,
          `external-run-returned:${handoffId}`,
        ),
      );

    expect(signal).toEqual({
      handoffId,
      ownerAccountId: accountId,
      signalId: `external-run-returned:${handoffId}`,
      sourceEventId: returnEvent.eventId,
      sourceWorkId: workId,
    });
  });

  test("closes the returned signal when a handoff is canceled", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const { events: signalEvents, sink: attentionSignalSink } =
      captureAttentionSignalEvents();
    let now = new Date("2026-09-23T12:30:00.000Z");
    const handoffId = "handoff-canceled-signal";
    const handoffs = createDatabaseExternalExecutionHandoffs(database, {
      attentionSignalSink,
      newId: () => handoffId,
      now: () => now,
    });
    await recordReturnedHandoff(handoffs, accountId, workId, handoffId);
    now = new Date("2026-09-23T12:45:00.000Z");

    await handoffs.cancel(accountId, {
      clientEventId: "cancel-returned-signal",
      handoffId,
      reason: "The returned result is no longer needed.",
    });

    expect(signalEvents.map((event) => event.kind)).toEqual([
      "produced",
      "closed",
    ]);
    expect(signalEvents[1]).toMatchObject({
      closedAt: now.toISOString(),
      kind: "closed",
      signalId: `external-run-returned:${handoffId}`,
    });
  });

  test("closes the returned signal when a handoff is reconciled", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const { events: signalEvents, sink: attentionSignalSink } =
      captureAttentionSignalEvents();
    let now = new Date("2026-09-23T12:30:00.000Z");
    const handoffId = "handoff-reconciled-signal";
    const handoffs = createDatabaseExternalExecutionHandoffs(database, {
      attentionSignalSink,
      newId: () => handoffId,
      now: () => now,
    });
    await recordReturnedHandoff(handoffs, accountId, workId, handoffId);
    const plan = {
      followUpWorks: [],
      handoffId,
      proposedRelations: [],
    };
    const preview = await handoffs.previewReconcile(accountId, plan);
    if (!preview) {
      throw new Error("The reconcile preview was unavailable.");
    }
    now = new Date("2026-09-23T12:45:00.000Z");

    const reconciled = await handoffs.confirmReconcile(accountId, {
      ...plan,
      clientEventId: "reconcile-returned-signal",
      previewId: preview.previewId,
      selectedFollowUpWorkIds: [],
      selectedRelationIds: [],
    });

    expect(reconciled).toMatchObject({ handoffId, status: "Reconciled" });
    expect(signalEvents.map((event) => event.kind)).toEqual([
      "produced",
      "closed",
    ]);
    expect(signalEvents[1]).toMatchObject({
      closedAt: now.toISOString(),
      kind: "closed",
      signalId: `external-run-returned:${handoffId}`,
    });
  });

  test("does not produce a signal for an Open handoff when time passes", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const { events: signalEvents, sink: attentionSignalSink } =
      captureAttentionSignalEvents();
    let now = new Date("2026-09-23T12:30:00.000Z");
    const handoffs = createDatabaseExternalExecutionHandoffs(database, {
      attentionSignalSink,
      newId: () => "handoff-open-no-signal",
      now: () => now,
    });
    await handoffs.start(accountId, {
      baseRevision: 0,
      clientIdempotencyKey: "start-open-no-signal",
      constraints: "Wait for an external result.",
      executor: "Local coding agent",
      expectedOutput: "A returned result.",
      githubContext: [],
      includeWork: true,
      purpose: "Keep this handoff open.",
      workId,
    });
    now = new Date("2026-10-23T12:30:00.000Z");

    await handoffs.list(accountId, workId);

    expect(signalEvents).toEqual([]);
  });

  test("rejects owner, archived, and cross-Project relation targets", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const handoffs = createDatabaseExternalExecutionHandoffs(database, {
      newId: () => "handoff-cross-project-relation",
    });
    const otherProjectId = `other-project-${crypto.randomUUID()}`;
    const otherWorkId = `other-work-${crypto.randomUUID()}`;
    const archivedWorkId = `archived-work-${crypto.randomUUID()}`;
    await database.insert(work).values({
      archivedAt: new Date("2026-09-22T00:00:00.000Z"),
      id: archivedWorkId,
      key: "EH-2",
      number: 2,
      projectId,
      title: "Archived Work",
      type: "Task",
    });
    await database.insert(project).values({
      id: otherProjectId,
      name: "Other Handoff Project",
      shortCode: `OH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
    await database.insert(work).values({
      id: otherWorkId,
      key: "OH-1",
      number: 1,
      projectId: otherProjectId,
      title: "Other project Work",
      type: "Task",
    });
    const handoff = await recordReturnedHandoff(
      handoffs,
      accountId,
      workId,
      "handoff-cross-project-relation",
    );
    const planForTarget = (id: string, targetWorkId: string) => ({
      followUpWorks: [],
      handoffId: handoff.handoffId,
      proposedRelations: [
        {
          id,
          kind: "Related" as const,
          targetWorkId,
        },
      ],
    });
    const crossProjectPlan = planForTarget(
      "relation-cross-project",
      otherWorkId,
    );

    await expect(handoffs.listRelatedWorks(accountId, workId)).resolves.toEqual(
      [],
    );
    await expect(
      handoffs.previewReconcile(
        accountId,
        planForTarget("relation-owner-work", workId),
      ),
    ).rejects.toThrow(ExternalExecutionHandoffReconcileUnavailableError);
    await expect(
      handoffs.previewReconcile(
        accountId,
        planForTarget("relation-archived-work", archivedWorkId),
      ),
    ).rejects.toThrow(ExternalExecutionHandoffReconcileUnavailableError);
    await expect(
      handoffs.previewReconcile(
        accountId,
        planForTarget("relation-cross-project", otherWorkId),
      ),
    ).rejects.toThrow(ExternalExecutionHandoffReconcileUnavailableError);
    await expect(
      handoffs.confirmReconcile(accountId, {
        ...crossProjectPlan,
        clientEventId: "confirm-cross-project-relation",
        previewId: "unissued-preview",
        selectedFollowUpWorkIds: [],
        selectedRelationIds: ["relation-cross-project"],
      }),
    ).rejects.toThrow(ExternalExecutionHandoffReconcileUnavailableError);

    await expect(listWorkRelations()).resolves.toEqual([]);
    await expect(handoffs.list(accountId, workId)).resolves.toMatchObject([
      { handoffId: handoff.handoffId, status: "Result returned" },
    ]);
  });

  test("previews and reconciles only the chosen Work binding and follow-up", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const handoffs = createDatabaseExternalExecutionHandoffs(database, {
      now: () => new Date("2026-09-23T12:30:00.000Z"),
      newId: () => "handoff-reconcile-partial",
    });
    const relatedWorkIds = ["related-work-a", "related-work-b"] as const;
    await database.insert(work).values(
      relatedWorkIds.map((id, index) => ({
        id,
        key: `EH-${index + 2}`,
        number: index + 2,
        projectId,
        title: `Review result ${index + 1}`,
        type: "Task",
      })),
    );
    await database
      .update(project)
      .set({ workCount: 3 })
      .where(eq(project.id, projectId));

    await recordReturnedHandoff(
      handoffs,
      accountId,
      workId,
      "handoff-reconcile-partial",
    );
    const plan = {
      followUpWorks: [
        {
          description: "Confirm the implementation after merge.",
          id: "follow-up-accepted",
          title: "Verify the external result",
          type: "Task" as const,
        },
        {
          description: "This draft is not selected.",
          id: "follow-up-rejected",
          title: "Review another result",
          type: "Research" as const,
        },
      ],
      handoffId: "handoff-reconcile-partial",
      proposedRelations: [
        {
          id: "relation-accepted",
          kind: "Related" as const,
          targetWorkId: relatedWorkIds[0],
        },
        {
          id: "relation-rejected",
          kind: "Blocks" as const,
          targetWorkId: relatedWorkIds[1],
        },
      ],
    };

    const preview = await handoffs.previewReconcile(accountId, plan);
    expect(preview).toMatchObject({
      handoffId: plan.handoffId,
      proposedRelations: [
        {
          id: "relation-accepted",
          kind: "Related",
          sourceLabel: "EH-1",
          target: { id: "related-work-a", key: "EH-2" },
        },
        {
          id: "relation-rejected",
          kind: "Blocks",
          target: { id: "related-work-b", key: "EH-3" },
        },
      ],
      followUpWorks: [
        {
          id: "follow-up-accepted",
          relationKind: "Origin",
          relatedToWorkId: workId,
          title: "Verify the external result",
        },
        {
          id: "follow-up-rejected",
          title: "Review another result",
        },
      ],
    });
    expect(
      await database
        .select({ id: work.id })
        .from(work)
        .where(eq(work.projectId, projectId)),
    ).toHaveLength(3);
    await expect(listWorkRelations()).resolves.toEqual([]);

    const reconciled = await handoffs.confirmReconcile(accountId, {
      ...plan,
      clientEventId: "confirm-reconcile-partial",
      previewId: preview?.previewId ?? "missing-preview",
      selectedFollowUpWorkIds: ["follow-up-accepted"],
      selectedRelationIds: ["relation-accepted"],
    });
    expect(reconciled).toMatchObject({
      handoffId: plan.handoffId,
      reconcileDecision: {
        createdFollowUpWorks: [{ title: "Verify the external result" }],
        createdRelations: [
          {
            kind: "Origin",
            sourceWorkId: expect.any(String),
            targetWorkId: workId,
          },
          {
            kind: "Related",
            sourceWorkId: workId,
            targetWorkId: "related-work-a",
          },
        ],
        selectedFollowUpWorkIds: ["follow-up-accepted"],
        selectedRelationIds: ["relation-accepted"],
      },
      status: "Reconciled",
    });
    expect(
      await database
        .select({ id: work.id })
        .from(work)
        .where(eq(work.projectId, projectId)),
    ).toHaveLength(4);
    const relations = await listWorkRelations();
    expect(relations).toHaveLength(2);
    expect(relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: "incoming",
          kind: "Origin",
          source: expect.objectContaining({ recordId: expect.any(String) }),
          target: expect.objectContaining({ recordId: workId }),
        }),
        expect.objectContaining({
          direction: "outgoing",
          kind: "Related",
          source: expect.objectContaining({ recordId: workId }),
          target: expect.objectContaining({ recordId: "related-work-a" }),
        }),
      ]),
    );
    await expect(handoffs.list(accountId, workId)).resolves.toEqual([
      reconciled,
    ]);
  });

  test("rejecting or bypassing the reconcile preview creates no Work or relation", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const handoffs = createDatabaseExternalExecutionHandoffs(database, {
      newId: () => "handoff-reconcile-reject",
    });
    const relatedWorkId = "related-work-reject";
    await database.insert(work).values({
      id: relatedWorkId,
      key: "EH-2",
      number: 2,
      projectId,
      title: "Possible relation target",
      type: "Task",
    });
    await database
      .update(project)
      .set({ workCount: 2 })
      .where(eq(project.id, projectId));
    const handoff = await recordReturnedHandoff(
      handoffs,
      accountId,
      workId,
      "handoff-reconcile-reject",
    );
    const plan = {
      followUpWorks: [
        {
          description: null,
          id: "reject-follow-up",
          title: "Create only after approval",
          type: "Task" as const,
        },
      ],
      handoffId: handoff.handoffId,
      proposedRelations: [
        {
          id: "reject-relation",
          kind: "Related" as const,
          targetWorkId: relatedWorkId,
        },
      ],
    };
    const preview = await handoffs.previewReconcile(accountId, plan);

    expect(
      await database
        .select({ id: work.id })
        .from(work)
        .where(eq(work.projectId, projectId)),
    ).toHaveLength(2);
    await expect(listWorkRelations()).resolves.toEqual([]);
    await expect(handoffs.list(accountId, workId)).resolves.toMatchObject([
      { handoffId: handoff.handoffId, status: "Result returned" },
    ]);
    await expect(
      handoffs.confirmReconcile(accountId, {
        ...plan,
        clientEventId: "previewless-confirm",
        previewId: "not-a-preview-id",
        selectedFollowUpWorkIds: ["reject-follow-up"],
        selectedRelationIds: [],
      }),
    ).rejects.toMatchObject({
      code: "EXTERNAL_HANDOFF_RECONCILE_PREVIEW_REQUIRED",
    });
    expect(preview?.previewId).not.toBe("not-a-preview-id");
    expect(
      await database
        .select({ id: work.id })
        .from(work)
        .where(eq(work.projectId, projectId)),
    ).toHaveLength(2);
    await expect(listWorkRelations()).resolves.toEqual([]);
  });

  test("rejects a changed relation preview without creating Work or relation records", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const handoffs = createDatabaseExternalExecutionHandoffs(database, {
      newId: () => "handoff-reconcile-rollback",
    });
    const relatedWorkId = "related-work-rollback";
    await database.insert(work).values({
      id: relatedWorkId,
      key: "EH-2",
      number: 2,
      projectId,
      title: "Target to archive after preview",
      type: "Task",
    });
    await database
      .update(project)
      .set({ workCount: 2 })
      .where(eq(project.id, projectId));
    const handoff = await recordReturnedHandoff(
      handoffs,
      accountId,
      workId,
      "handoff-reconcile-rollback",
    );
    const plan = {
      followUpWorks: [
        {
          description: null,
          id: "rollback-follow-up",
          title: "This Work must roll back",
          type: "Task" as const,
        },
      ],
      handoffId: handoff.handoffId,
      proposedRelations: [
        {
          id: "rollback-relation",
          kind: "Related" as const,
          targetWorkId: relatedWorkId,
        },
      ],
    };
    const preview = await handoffs.previewReconcile(accountId, plan);
    if (!preview) {
      throw new Error("The reconcile preview was unavailable.");
    }
    await database
      .update(work)
      .set({ title: "Target changed after preview" })
      .where(eq(work.id, relatedWorkId));

    await expect(
      handoffs.confirmReconcile(accountId, {
        ...plan,
        clientEventId: "rollback-confirm",
        previewId: preview.previewId,
        selectedFollowUpWorkIds: ["rollback-follow-up"],
        selectedRelationIds: ["rollback-relation"],
      }),
    ).rejects.toMatchObject({
      code: "EXTERNAL_HANDOFF_RECONCILE_PREVIEW_REQUIRED",
    });
    expect(
      await database
        .select({ id: work.id })
        .from(work)
        .where(eq(work.projectId, projectId)),
    ).toHaveLength(2);
    await expect(listWorkRelations()).resolves.toEqual([]);
    await expect(handoffs.list(accountId, workId)).resolves.toMatchObject([
      { handoffId: handoff.handoffId, status: "Result returned" },
    ]);
  });

  test("rolls selected Works and relations back when recording the decision fails", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const handoffs = createDatabaseExternalExecutionHandoffs(database, {
      newId: () => "handoff-reconcile-rollback",
    });
    const relatedWorkId = "related-work-rollback";
    await database.insert(work).values({
      id: relatedWorkId,
      key: "EH-2",
      number: 2,
      projectId,
      title: "Selected relation target",
      type: "Task",
    });
    await database
      .update(project)
      .set({ workCount: 2 })
      .where(eq(project.id, projectId));
    const handoff = await recordReturnedHandoff(
      handoffs,
      accountId,
      workId,
      "handoff-reconcile-rollback",
    );
    const clientEventId = "rollback-decision-event";
    const plan = {
      followUpWorks: [
        {
          description: null,
          id: "rollback-follow-up",
          title: "This Work must roll back",
          type: "Task" as const,
        },
      ],
      handoffId: handoff.handoffId,
      proposedRelations: [
        {
          id: "rollback-relation",
          kind: "Related" as const,
          targetWorkId: relatedWorkId,
        },
      ],
    };
    const preview = await handoffs.previewReconcile(accountId, plan);
    if (!preview) {
      throw new Error("The reconcile preview was unavailable.");
    }
    const collisionFingerprint = await fingerprintMutationPayload({
      clientEventId,
      eventType: "external-execution-handoff-reconciled",
      handoffId: handoff.handoffId,
      workId,
    });
    await database.insert(mutationHistory).values({
      actorId: accountId,
      actorType: "User",
      clientIdempotencyKey: clientEventId,
      id: `external-handoff-event-${collisionFingerprint}`,
      nextValue: { kind: "rollback-test-collision" },
      occurredAt: new Date("2026-09-23T12:45:00.000Z"),
      originKind: "human",
      payloadFingerprint: collisionFingerprint,
      previousValue: { kind: "rollback-test-collision" },
      revision: 0,
      targetId: workId,
    });

    await expect(
      handoffs.confirmReconcile(accountId, {
        ...plan,
        clientEventId,
        previewId: preview.previewId,
        selectedFollowUpWorkIds: ["rollback-follow-up"],
        selectedRelationIds: ["rollback-relation"],
      }),
    ).rejects.toBeDefined();
    expect(
      await database
        .select({ id: work.id })
        .from(work)
        .where(eq(work.projectId, projectId)),
    ).toHaveLength(2);
    await expect(listWorkRelations()).resolves.toEqual([]);
    await expect(handoffs.list(accountId, workId)).resolves.toMatchObject([
      { handoffId: handoff.handoffId, status: "Result returned" },
    ]);
  });
});

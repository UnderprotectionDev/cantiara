import type {
  CancelExternalExecutionHandoffInput,
  ExternalExecutionHandoffStartCommand,
} from "@cantiara/api/external-handoffs";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { workExternalExecutionHandoff } from "@cantiara/db/schema/work-external-handoff";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { createDatabaseExternalExecutionHandoffs } from "./external-handoffs-database";

const databaseUrl =
  process.env.ACCOUNT_ACCESS_DATABASE_URL ?? process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("External Execution Handoff seam", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `external-handoffs-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;
  const workId = `work-${crypto.randomUUID()}`;

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
});

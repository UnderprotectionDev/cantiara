import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  customFieldDefinition,
  customFieldValue,
} from "@cantiara/db/schema/custom-fields";
import { dailyFocusMembership } from "@cantiara/db/schema/daily-focus";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { CustomFieldOptionInvalidError } from "../../custom-fields/server/custom-fields";
import {
  createDatabaseRecordActions,
  RecordActionNameConflictError,
  RecordActionStaleRevisionError,
  RecordActionStepUnavailableError,
} from "./record-actions-database";

const focusDate = "2026-09-23";

const databaseUrl =
  process.env.ACCOUNT_ACCESS_DATABASE_URL ?? process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Record Actions PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `record-actions-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;

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
      name: "Release Project",
      shortCode: `RA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
  });

  afterEach(async () => {
    await database?.delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("stores editable definitions and removes trashed definitions from the active list", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const recordActions = createDatabaseRecordActions(database);
    const created = await recordActions.create(accountId, {
      name: "Start Work",
      projectId,
      steps: [
        { kind: "work-status", status: "In Progress" },
        { kind: "daily-focus-membership", operation: "add" },
      ],
    });

    const updated = await recordActions.update(
      accountId,
      created.id,
      created.revision,
      {
        name: "Start Work",
        steps: [
          { kind: "work-status", status: "In Progress" },
          { kind: "daily-focus-membership", operation: "add" },
        ],
      },
    );
    expect(updated).toMatchObject({ name: "Start Work", revision: 2 });
    await expect(
      recordActions.list(accountId, projectId),
    ).resolves.toHaveLength(1);

    const trashed = await recordActions.trash(
      accountId,
      created.id,
      updated?.revision ?? 2,
    );
    expect(trashed?.trashedAt).not.toBeNull();
    await expect(recordActions.list(accountId, projectId)).resolves.toEqual([]);
    await expect(
      recordActions.update(accountId, created.id, 2, {
        name: "Start Work",
        steps: [
          { kind: "work-status", status: "In Progress" },
          { kind: "daily-focus-membership", operation: "add" },
        ],
      }),
    ).resolves.toBeNull();
  });

  test("only accepts active Work Custom fields and values from their catalog", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const definitionId = `field-${crypto.randomUUID()}`;
    await database.insert(customFieldDefinition).values({
      id: definitionId,
      name: "Release readiness",
      nameKey: "release readiness",
      options: ["Ready"],
      projectId,
      recordTypes: ["Work"],
      type: "Single select",
    });
    const recordActions = createDatabaseRecordActions(database);
    const fieldStep = {
      definitionId,
      kind: "custom-field-value" as const,
      operation: "set" as const,
      value: { kind: "option" as const, option: "Ready" },
    };
    const input = {
      projectId,
      steps: [fieldStep],
    };

    await expect(
      recordActions.create(accountId, { ...input, name: "Mark ready" }),
    ).resolves.toMatchObject({ name: "Mark ready" });
    await expect(
      recordActions.create(accountId, {
        ...input,
        name: "Use unknown value",
        steps: [{ ...fieldStep, value: { kind: "option", option: "Unknown" } }],
      }),
    ).rejects.toBeInstanceOf(CustomFieldOptionInvalidError);
    await expect(
      recordActions.create(accountId, {
        ...input,
        name: "Use unavailable field",
        steps: [{ ...fieldStep, definitionId: "unavailable-field" }],
      }),
    ).rejects.toBeInstanceOf(RecordActionStepUnavailableError);
  });

  test("enforces project-local names and optimistic revisions", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const recordActions = createDatabaseRecordActions(database);
    const first = await recordActions.create(accountId, {
      name: "Start Work",
      projectId,
      steps: [
        { kind: "work-status", status: "In Progress" },
        { kind: "daily-focus-membership", operation: "add" },
      ],
    });
    await expect(
      recordActions.create(accountId, {
        name: "start work",
        projectId,
        steps: [
          { kind: "work-status", status: "In Progress" },
          { kind: "daily-focus-membership", operation: "add" },
        ],
      }),
    ).rejects.toBeInstanceOf(RecordActionNameConflictError);
    await expect(
      recordActions.update(accountId, first.id, first.revision + 1, {
        name: "Start Work",
        steps: [
          { kind: "work-status", status: "In Progress" },
          { kind: "daily-focus-membership", operation: "add" },
        ],
      }),
    ).rejects.toBeInstanceOf(RecordActionStaleRevisionError);
  });

  test("previews without writes, then atomically applies and replays one action", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const workId = `work-${crypto.randomUUID()}`;
    await database.insert(work).values({
      id: workId,
      key: `RA-${crypto.randomUUID().slice(0, 8).toUpperCase()}-1`,
      number: 1,
      projectId,
      title: "Ship the first release",
      type: "Task",
    });
    const access = createDatabaseRecordActions(database);
    const action = await access.create(accountId, {
      name: "Start Work",
      projectId,
      steps: [
        { kind: "work-status", status: "In Progress" },
        { kind: "daily-focus-membership", operation: "add" },
      ],
    });
    const preview = await access.preview(accountId, {
      actionId: action.id,
      focusDate,
      workId,
    });
    if (!preview) {
      throw new Error("The Record Action preview should be available.");
    }

    expect(preview).toMatchObject({
      actionId: action.id,
      actionRevision: action.revision,
      baseRevision: 0,
      changes: [
        {
          after: "In Progress",
          before: "Not Started",
          label: "Work status",
        },
        {
          after: true,
          before: false,
          label: `Daily Focus · ${focusDate}`,
        },
      ],
      focusDate,
      workId,
    });
    await expect(
      database
        .select({ status: work.status, revision: work.revision })
        .from(work)
        .where(eq(work.id, workId)),
    ).resolves.toEqual([{ revision: 0, status: "Not Started" }]);

    const command = {
      actionId: action.id,
      actionRevision: action.revision,
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: "start-work-1",
      focusDate,
      previewFingerprint: preview.previewFingerprint,
      workId,
    };
    const result = await access.apply(accountId, command);
    expect(result.status).toBe("committed");
    if (result.status !== "committed") {
      throw new Error("The Record Action should have committed.");
    }
    expect(result.receipt.nextValue).toEqual(preview.nextValue);
    await expect(
      database
        .select({ status: work.status, revision: work.revision })
        .from(work)
        .where(eq(work.id, workId)),
    ).resolves.toEqual([{ revision: 1, status: "In Progress" }]);
    await expect(
      database
        .select({ focusDate: dailyFocusMembership.focusDate })
        .from(dailyFocusMembership)
        .where(eq(dailyFocusMembership.workId, workId)),
    ).resolves.toEqual([{ focusDate }]);

    const replayedResult = await access.apply(accountId, command);
    expect(replayedResult).toMatchObject({
      receipt: { id: result.receipt.id },
      status: "committed",
    });
    await expect(
      access.apply(accountId, {
        ...command,
        focusDate: "2026-09-24",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("rolls back every Record Action write when a later step fails", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const workId = `work-${crypto.randomUUID()}`;
    await database.insert(work).values({
      id: workId,
      key: `RA-${crypto.randomUUID().slice(0, 8).toUpperCase()}-1`,
      number: 1,
      projectId,
      title: "Ship the first release",
      type: "Task",
    });
    const definitionAccess = createDatabaseRecordActions(database);
    const action = await definitionAccess.create(accountId, {
      name: "Start Work",
      projectId,
      steps: [
        { kind: "work-status", status: "In Progress" },
        { kind: "daily-focus-membership", operation: "add" },
      ],
    });
    const access = createDatabaseRecordActions(database, {
      afterWrite(write) {
        if (write === "dailyFocus") {
          throw new Error("Injected Record Action write failure.");
        }
      },
    });
    const preview = await access.preview(accountId, {
      actionId: action.id,
      focusDate,
      workId,
    });
    if (!preview) {
      throw new Error("The Record Action preview should be available.");
    }
    const command = {
      actionId: action.id,
      actionRevision: action.revision,
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: "start-work-failure-1",
      focusDate,
      previewFingerprint: preview.previewFingerprint,
      workId,
    };
    const result = await access.apply(accountId, command);

    expect(result.status).toBe("rolled-back");
    await expect(
      database
        .select({ status: work.status, revision: work.revision })
        .from(work)
        .where(eq(work.id, workId)),
    ).resolves.toEqual([{ revision: 0, status: "Not Started" }]);
    await expect(
      database
        .select()
        .from(dailyFocusMembership)
        .where(eq(dailyFocusMembership.workId, workId)),
    ).resolves.toEqual([]);
    await expect(
      access.preview(accountId, {
        actionId: action.id,
        focusDate,
        workId,
      }),
    ).resolves.toMatchObject({ changes: preview.changes });
  });

  test("does not write a custom field omitted from the preview diff", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const workId = `work-${crypto.randomUUID()}`;
    const definitionId = `field-${crypto.randomUUID()}`;
    await database.insert(work).values({
      id: workId,
      key: `RA-${crypto.randomUUID().slice(0, 8).toUpperCase()}-1`,
      number: 1,
      projectId,
      title: "Ship the first release",
      type: "Task",
    });
    await database.insert(customFieldDefinition).values({
      id: definitionId,
      name: "Release readiness",
      nameKey: "release readiness",
      options: ["Ready"],
      projectId,
      recordTypes: ["Work"],
      type: "Single select",
    });
    await database.insert(customFieldValue).values({
      definitionId,
      id: `value-${crypto.randomUUID()}`,
      recordId: workId,
      recordType: "Work",
      value: { kind: "option", option: "Ready" },
    });
    const [before] = await database
      .select()
      .from(customFieldValue)
      .where(eq(customFieldValue.recordId, workId));
    const access = createDatabaseRecordActions(database);
    const action = await access.create(accountId, {
      name: "Mark ready and start",
      projectId,
      steps: [
        { kind: "work-status", status: "In Progress" },
        {
          definitionId,
          kind: "custom-field-value",
          operation: "set",
          value: { kind: "option", option: "Ready" },
        },
      ],
    });
    const preview = await access.preview(accountId, {
      actionId: action.id,
      focusDate,
      workId,
    });
    if (!(preview && before)) {
      throw new Error("The Record Action preview and field should exist.");
    }
    expect(preview.changes).toMatchObject([
      {
        after: "In Progress",
        before: "Not Started",
        key: "status",
      },
    ]);

    const result = await access.apply(accountId, {
      actionId: action.id,
      actionRevision: action.revision,
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: "mark-ready-and-start-1",
      focusDate,
      previewFingerprint: preview.previewFingerprint,
      workId,
    });
    expect(result.status).toBe("committed");
    await expect(
      database
        .select()
        .from(customFieldValue)
        .where(eq(customFieldValue.recordId, workId)),
    ).resolves.toEqual([before]);
  });

  test("rejects a stale preview before writing any Record Action step", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const workId = `work-${crypto.randomUUID()}`;
    await database.insert(work).values({
      id: workId,
      key: `RA-${crypto.randomUUID().slice(0, 8).toUpperCase()}-1`,
      number: 1,
      projectId,
      title: "Ship the first release",
      type: "Task",
    });
    const access = createDatabaseRecordActions(database);
    const action = await access.create(accountId, {
      name: "Start Work",
      projectId,
      steps: [
        { kind: "work-status", status: "In Progress" },
        { kind: "daily-focus-membership", operation: "add" },
      ],
    });
    const preview = await access.preview(accountId, {
      actionId: action.id,
      focusDate,
      workId,
    });
    if (!preview) {
      throw new Error("The Record Action preview should be available.");
    }
    await database
      .update(work)
      .set({ revision: 1, status: "Blocked" })
      .where(eq(work.id, workId));

    const result = await access.apply(accountId, {
      actionId: action.id,
      actionRevision: action.revision,
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: "start-work-stale-1",
      focusDate,
      previewFingerprint: preview.previewFingerprint,
      workId,
    });
    expect(result.status).toBe("rolled-back");
    if (result.status !== "rolled-back") {
      throw new Error(
        "A stale Record Action should return a rollback receipt.",
      );
    }
    expect(result.receipt).toMatchObject({
      current: { value: { status: "Blocked" } },
      reason: "stale-base-revision",
    });
    await expect(
      database
        .select({ status: work.status, revision: work.revision })
        .from(work)
        .where(eq(work.id, workId)),
    ).resolves.toEqual([{ revision: 1, status: "Blocked" }]);
    await expect(
      database
        .select()
        .from(dailyFocusMembership)
        .where(eq(dailyFocusMembership.workId, workId)),
    ).resolves.toEqual([]);
  });

  test("undoes the whole Record Action atomically", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const workId = `work-${crypto.randomUUID()}`;
    await database.insert(work).values({
      id: workId,
      key: `RA-${crypto.randomUUID().slice(0, 8).toUpperCase()}-1`,
      number: 1,
      projectId,
      title: "Ship the first release",
      type: "Task",
    });
    const access = createDatabaseRecordActions(database);
    const action = await access.create(accountId, {
      name: "Start Work",
      projectId,
      steps: [
        { kind: "work-status", status: "In Progress" },
        { kind: "daily-focus-membership", operation: "add" },
      ],
    });
    const preview = await access.preview(accountId, {
      actionId: action.id,
      focusDate,
      workId,
    });
    if (!preview) {
      throw new Error("The Record Action preview should be available.");
    }
    const command = {
      actionId: action.id,
      actionRevision: action.revision,
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: "start-work-undo-1",
      focusDate,
      previewFingerprint: preview.previewFingerprint,
      workId,
    };
    const applied = await access.apply(accountId, command);
    if (applied.status !== "committed") {
      throw new Error("The Record Action should have committed.");
    }

    await expect(
      access.undo(accountId, {
        baseRevision: applied.receipt.revision,
        clientIdempotencyKey: "undo-start-work-1",
        receiptId: applied.receipt.id,
        workId,
      }),
    ).resolves.toMatchObject({ undoOf: applied.receipt.id });
    await expect(
      database
        .select({ status: work.status, revision: work.revision })
        .from(work)
        .where(eq(work.id, workId)),
    ).resolves.toEqual([{ revision: 2, status: "Not Started" }]);
    await expect(
      database
        .select()
        .from(dailyFocusMembership)
        .where(eq(dailyFocusMembership.workId, workId)),
    ).resolves.toEqual([]);
  });

  test("rejects the whole undo after a touched field changes", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const workId = `work-${crypto.randomUUID()}`;
    await database.insert(work).values({
      id: workId,
      key: `RA-${crypto.randomUUID().slice(0, 8).toUpperCase()}-1`,
      number: 1,
      projectId,
      title: "Ship the release",
      type: "Task",
    });
    const access = createDatabaseRecordActions(database);
    const action = await access.create(accountId, {
      name: "Start Work",
      projectId,
      steps: [
        { kind: "work-status", status: "In Progress" },
        { kind: "daily-focus-membership", operation: "add" },
      ],
    });
    const preview = await access.preview(accountId, {
      actionId: action.id,
      focusDate,
      workId,
    });
    if (!preview) {
      throw new Error("The Record Action preview should be available.");
    }
    const applied = await access.apply(accountId, {
      actionId: action.id,
      actionRevision: action.revision,
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: "start-work-undo-conflict-1",
      focusDate,
      previewFingerprint: preview.previewFingerprint,
      workId,
    });
    if (applied.status !== "committed") {
      throw new Error("The Record Action should have committed.");
    }
    await database
      .update(work)
      .set({ revision: 2, status: "Blocked" })
      .where(eq(work.id, workId));

    await expect(
      access.undo(accountId, {
        baseRevision: 2,
        clientIdempotencyKey: "undo-start-work-conflict-1",
        receiptId: applied.receipt.id,
        workId,
      }),
    ).rejects.toMatchObject({ name: "MutationUndoConflictError" });
    await expect(
      database
        .select({ status: work.status, revision: work.revision })
        .from(work)
        .where(eq(work.id, workId)),
    ).resolves.toEqual([{ revision: 2, status: "Blocked" }]);
    await expect(
      database
        .select()
        .from(dailyFocusMembership)
        .where(eq(dailyFocusMembership.workId, workId)),
    ).resolves.toHaveLength(1);
  });
});

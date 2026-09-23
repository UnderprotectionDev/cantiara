import { createDb } from "@cantiara/db";
import { accountPreferences, user, workspace } from "@cantiara/db/schema/auth";
import {
  customFieldDefinition,
  customFieldValue,
} from "@cantiara/db/schema/custom-fields";
import { dailyFocusMembership } from "@cantiara/db/schema/daily-focus";
import { project } from "@cantiara/db/schema/project";
import { workRelation } from "@cantiara/db/schema/relation";
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

function createTestRecordActions(
  database: NonNullable<ReturnType<typeof createDb>>,
  options: Parameters<typeof createDatabaseRecordActions>[1] = {},
) {
  return createDatabaseRecordActions(database, {
    now: () => new Date(`${focusDate}T12:00:00.000Z`),
    ...options,
  });
}

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
    const recordActions = createTestRecordActions(database);
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
    const recordActions = createTestRecordActions(database);
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

  test("rejects runtime inputs for fields outside the Date, Number, and Select catalog", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const definitions = [
      {
        id: `field-${crypto.randomUUID()}`,
        name: "Approval required",
        nameKey: `approval-required-${crypto.randomUUID()}`,
        type: "Boolean" as const,
      },
      {
        id: `field-${crypto.randomUUID()}`,
        name: "Run notes",
        nameKey: `run-notes-${crypto.randomUUID()}`,
        type: "Text" as const,
      },
    ];
    await database.insert(customFieldDefinition).values(
      definitions.map((definition) => ({
        ...definition,
        projectId,
        recordTypes: ["Work"],
      })),
    );
    const access = createTestRecordActions(database);

    await Promise.all(
      definitions.map(async (definition) =>
        expect(
          access.create(accountId, {
            name: `Ask for ${definition.name}`,
            projectId,
            steps: [
              {
                definitionId: definition.id,
                kind: "custom-field-value",
                operation: "set",
                value: { kind: "runtime-input" },
              },
            ],
          }),
        ).rejects.toBeInstanceOf(RecordActionStepUnavailableError),
      ),
    );
  });

  test("enforces project-local names and optimistic revisions", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const recordActions = createTestRecordActions(database);
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
    const access = createTestRecordActions(database);
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
      runtimeInputs: { customFieldValues: {}, relations: {} },
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
    const previewedWork = await database
      .select({ status: work.status, revision: work.revision })
      .from(work)
      .where(eq(work.id, workId));
    expect(previewedWork).toEqual([{ revision: 0, status: "Not Started" }]);
    const mismatchedPreview = await access.apply(accountId, {
      actionId: action.id,
      actionRevision: action.revision,
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: "start-work-mismatched-preview-1",
      focusDate: preview.focusDate,
      previewFingerprint: "0".repeat(64),
      runtimeInputs: preview.runtimeInputs,
      workId,
    });
    expect(mismatchedPreview.status).toBe("rolled-back");
    const unchangedAfterMismatch = await database
      .select({ status: work.status, revision: work.revision })
      .from(work)
      .where(eq(work.id, workId));
    expect(unchangedAfterMismatch).toEqual([
      { revision: 0, status: "Not Started" },
    ]);

    const command = {
      actionId: action.id,
      actionRevision: action.revision,
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: "start-work-1",
      focusDate: preview.focusDate,
      runtimeInputs: preview.runtimeInputs,
      previewFingerprint: preview.previewFingerprint,
      workId,
    };
    const result = await access.apply(accountId, command);
    expect(result.status).toBe("committed");
    if (result.status !== "committed") {
      throw new Error("The Record Action should have committed.");
    }
    expect(result.receipt.nextValue).toEqual(preview.nextValue);
    const appliedWork = await database
      .select({ status: work.status, revision: work.revision })
      .from(work)
      .where(eq(work.id, workId));
    expect(appliedWork).toEqual([{ revision: 1, status: "In Progress" }]);
    const memberships = await database
      .select({ focusDate: dailyFocusMembership.focusDate })
      .from(dailyFocusMembership)
      .where(eq(dailyFocusMembership.workId, workId));
    expect(memberships).toEqual([{ focusDate }]);

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
  }, 20_000);

  test("assigns Daily Focus to the saved profile calendar day", async () => {
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
    await database.insert(accountPreferences).values({
      accountId,
      timeZone: "America/Los_Angeles",
    });
    const access = createTestRecordActions(database, {
      now: () => new Date("2026-09-23T01:00:00.000Z"),
    });
    const action = await access.create(accountId, {
      name: "Add to Daily Focus",
      projectId,
      steps: [{ kind: "daily-focus-membership", operation: "add" }],
    });

    const preview = await access.preview(accountId, {
      actionId: action.id,
      runtimeInputs: { customFieldValues: {}, relations: {} },
      workId,
    });

    expect(preview?.focusDate).toBe("2026-09-22");
  });

  test("previews and atomically applies runtime field and Relation inputs", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const workId = `work-${crypto.randomUUID()}`;
    const relatedWorkId = `work-${crypto.randomUUID()}`;
    const otherProjectId = `project-${crypto.randomUUID()}`;
    const otherProjectWorkId = `work-${crypto.randomUUID()}`;
    const dateDefinitionId = `field-${crypto.randomUUID()}`;
    const numberDefinitionId = `field-${crypto.randomUUID()}`;
    const selectDefinitionId = `field-${crypto.randomUUID()}`;
    await database.insert(project).values({
      id: otherProjectId,
      name: "Other Project",
      shortCode: `RA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
    await database.insert(work).values([
      {
        id: workId,
        key: `RA-${crypto.randomUUID().slice(0, 8).toUpperCase()}-1`,
        number: 1,
        projectId,
        title: "Ship the first release",
        type: "Task",
      },
      {
        id: relatedWorkId,
        key: `RA-${crypto.randomUUID().slice(0, 8).toUpperCase()}-2`,
        number: 2,
        projectId,
        title: "Prepare the release notes",
        type: "Task",
      },
      {
        id: otherProjectWorkId,
        key: `RA-${crypto.randomUUID().slice(0, 8).toUpperCase()}-1`,
        number: 1,
        projectId: otherProjectId,
        title: "Prepare another project",
        type: "Task",
      },
    ]);
    await database.insert(customFieldDefinition).values([
      {
        id: dateDefinitionId,
        name: "Release date",
        nameKey: "release date",
        projectId,
        recordTypes: ["Work"],
        type: "Date",
      },
      {
        id: numberDefinitionId,
        name: "Estimate",
        nameKey: "estimate",
        projectId,
        recordTypes: ["Work"],
        type: "Number",
      },
      {
        id: selectDefinitionId,
        name: "Readiness",
        nameKey: "readiness",
        options: ["Ready", "Later"],
        projectId,
        recordTypes: ["Work"],
        type: "Single select",
      },
    ]);
    const access = createTestRecordActions(database);
    const action = await access.create(accountId, {
      name: "Set release details",
      projectId,
      steps: [
        {
          definitionId: dateDefinitionId,
          kind: "custom-field-value",
          operation: "set",
          value: { kind: "runtime-input" },
        },
        {
          definitionId: numberDefinitionId,
          kind: "custom-field-value",
          operation: "set",
          value: { kind: "runtime-input" },
        },
        {
          definitionId: selectDefinitionId,
          kind: "custom-field-value",
          operation: "set",
          value: { kind: "runtime-input" },
        },
        {
          inputId: "related-record",
          kind: "related-work",
          operation: "add",
        },
      ],
    });
    const runtimeInputs = {
      customFieldValues: {
        [dateDefinitionId]: { date: "2026-10-01", kind: "date" as const },
        [numberDefinitionId]: { kind: "number" as const, number: 5 },
        [selectDefinitionId]: { kind: "option" as const, option: "Ready" },
      },
      relations: {
        "related-record": {
          recordId: relatedWorkId,
          recordType: "Work" as const,
        },
      },
    };
    await expect(
      access.preview(accountId, {
        actionId: action.id,
        runtimeInputs: { customFieldValues: {}, relations: {} },
        workId,
      }),
    ).resolves.toBeNull();
    await expect(
      access.preview(accountId, {
        actionId: action.id,
        runtimeInputs: {
          ...runtimeInputs,
          customFieldValues: {
            ...runtimeInputs.customFieldValues,
            [selectDefinitionId]: { kind: "option", option: "Unknown" },
          },
        },
        workId,
      }),
    ).resolves.toBeNull();
    await expect(
      access.preview(accountId, {
        actionId: action.id,
        runtimeInputs: {
          ...runtimeInputs,
          relations: {
            "related-record": {
              recordId: otherProjectWorkId,
              recordType: "Work",
            },
          },
        },
        workId,
      }),
    ).resolves.toBeNull();
    const preview = await access.preview(accountId, {
      actionId: action.id,
      runtimeInputs,
      workId,
    });
    if (!preview) {
      throw new Error("The Record Action preview should be available.");
    }

    const missingInputsResult = await access.apply(accountId, {
      actionId: action.id,
      actionRevision: action.revision,
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: "runtime-input-action-missing-1",
      focusDate: preview.focusDate,
      previewFingerprint: preview.previewFingerprint,
      runtimeInputs: { customFieldValues: {}, relations: {} },
      workId,
    });
    expect(missingInputsResult).toMatchObject({
      receipt: { reason: "target-not-found", status: "rolled-back" },
      status: "rolled-back",
    });
    const [
      workAfterMissingInputs,
      valuesAfterMissingInputs,
      relationsAfterMissingInputs,
    ] = await Promise.all([
      database
        .select({ revision: work.revision, status: work.status })
        .from(work)
        .where(eq(work.id, workId)),
      database
        .select()
        .from(customFieldValue)
        .where(eq(customFieldValue.recordId, workId)),
      database
        .select()
        .from(workRelation)
        .where(eq(workRelation.sourceWorkId, workId)),
    ]);
    expect(workAfterMissingInputs).toEqual([
      { revision: 0, status: "Not Started" },
    ]);
    expect(valuesAfterMissingInputs).toEqual([]);
    expect(relationsAfterMissingInputs).toEqual([]);

    expect(preview.runtimeInputs).toEqual(runtimeInputs);
    expect(preview.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          after: { date: "2026-10-01", kind: "date" },
          label: "Release date",
        }),
        expect.objectContaining({
          after: { kind: "number", number: 5 },
          label: "Estimate",
        }),
        expect.objectContaining({
          after: { kind: "option", option: "Ready" },
          label: "Readiness",
        }),
        expect.objectContaining({
          after: true,
          label: expect.stringContaining("Related"),
        }),
      ]),
    );

    const applied = await access.apply(accountId, {
      actionId: action.id,
      actionRevision: action.revision,
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: "runtime-input-action-1",
      focusDate: preview.focusDate,
      previewFingerprint: preview.previewFingerprint,
      runtimeInputs,
      workId,
    });
    expect(applied.status).toBe("committed");
    const storedValues = await database
      .select({
        definitionId: customFieldValue.definitionId,
        value: customFieldValue.value,
      })
      .from(customFieldValue)
      .where(eq(customFieldValue.recordId, workId));
    expect(storedValues).toEqual(
      expect.arrayContaining([
        {
          definitionId: dateDefinitionId,
          value: { date: "2026-10-01", kind: "date" },
        },
        {
          definitionId: numberDefinitionId,
          value: { kind: "number", number: 5 },
        },
        {
          definitionId: selectDefinitionId,
          value: { kind: "option", option: "Ready" },
        },
      ]),
    );
    const [relation] = await database
      .select()
      .from(workRelation)
      .where(eq(workRelation.sourceWorkId, workId));
    expect(relation).toMatchObject({
      kind: "Related",
      targetRecordId: relatedWorkId,
      targetRecordType: "Work",
    });
    const [relatedWorkAfterApply] = await database
      .select({ revision: work.revision, status: work.status })
      .from(work)
      .where(eq(work.id, relatedWorkId));
    expect(relatedWorkAfterApply).toEqual({
      revision: 0,
      status: "Not Started",
    });
    if (applied.status !== "committed") {
      throw new Error("The Record Action should have committed.");
    }
    await access.undo(accountId, {
      baseRevision: applied.receipt.revision,
      clientIdempotencyKey: "undo-runtime-input-action-1",
      receiptId: applied.receipt.id,
      workId,
    });
    const [undoneRelation] = await database
      .select({ deletedAt: workRelation.deletedAt })
      .from(workRelation)
      .where(eq(workRelation.sourceWorkId, workId));
    expect(undoneRelation?.deletedAt).not.toBeNull();
    const undoneValues = await database
      .select()
      .from(customFieldValue)
      .where(eq(customFieldValue.recordId, workId));
    expect(undoneValues).toEqual([]);
  }, 45_000);

  test("uses an active Related Work row ahead of an older deleted row", async () => {
    if (!database) {
      throw new Error("DATABASE_URL is required");
    }
    const workId = `work-${crypto.randomUUID()}`;
    const relatedWorkId = `work-${crypto.randomUUID()}`;
    const deletedRelationId = `record-action-deleted-${crypto.randomUUID()}`;
    const activeRelationId = `relation-preview:${crypto.randomUUID()}`;
    await database.insert(work).values([
      {
        id: workId,
        key: `RA-${crypto.randomUUID().slice(0, 8).toUpperCase()}-1`,
        number: 1,
        projectId,
        title: "Ship the first release",
        type: "Task",
      },
      {
        id: relatedWorkId,
        key: `RA-${crypto.randomUUID().slice(0, 8).toUpperCase()}-2`,
        number: 2,
        projectId,
        title: "Prepare the release notes",
        type: "Task",
      },
    ]);
    await database.insert(workRelation).values([
      {
        createdAt: new Date("2026-09-20T12:00:00.000Z"),
        deletedAt: new Date("2026-09-21T12:00:00.000Z"),
        id: deletedRelationId,
        kind: "Related",
        revision: 2,
        sourceRecordType: "Work",
        sourceWorkId: workId,
        targetLabel: "Prepare the release notes",
        targetProjectId: projectId,
        targetRecordId: relatedWorkId,
        targetRecordType: "Work",
      },
      {
        createdAt: new Date("2026-09-22T12:00:00.000Z"),
        id: activeRelationId,
        kind: "Related",
        revision: 1,
        sourceRecordType: "Work",
        sourceWorkId: workId,
        targetLabel: "Prepare the release notes",
        targetProjectId: projectId,
        targetRecordId: relatedWorkId,
        targetRecordType: "Work",
      },
    ]);

    const access = createTestRecordActions(database);
    const action = await access.create(accountId, {
      name: "Remove related Work",
      projectId,
      steps: [
        {
          inputId: "related-record",
          kind: "related-work",
          operation: "remove",
        },
      ],
    });
    const runtimeInputs = {
      customFieldValues: {},
      relations: {
        "related-record": {
          recordId: relatedWorkId,
          recordType: "Work" as const,
        },
      },
    };
    const preview = await access.preview(accountId, {
      actionId: action.id,
      runtimeInputs,
      workId,
    });

    expect(preview?.changes).toContainEqual(
      expect.objectContaining({ after: false, before: true }),
    );
    if (!preview) {
      throw new Error("The active Related Work preview should be available.");
    }
    const applied = await access.apply(accountId, {
      actionId: action.id,
      actionRevision: action.revision,
      baseRevision: preview.baseRevision,
      clientIdempotencyKey: "remove-recreated-related-work-1",
      focusDate: preview.focusDate,
      previewFingerprint: preview.previewFingerprint,
      runtimeInputs,
      workId,
    });
    expect(applied.status).toBe("committed");
    const relationHistory = await database
      .select({ deletedAt: workRelation.deletedAt, id: workRelation.id })
      .from(workRelation)
      .where(eq(workRelation.targetRecordId, relatedWorkId));
    expect(relationHistory).toHaveLength(2);
    expect(relationHistory).toEqual(
      expect.arrayContaining([
        { deletedAt: expect.any(Date), id: deletedRelationId },
        { deletedAt: expect.any(Date), id: activeRelationId },
      ]),
    );
  }, 20_000);

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
    const definitionAccess = createTestRecordActions(database);
    const action = await definitionAccess.create(accountId, {
      name: "Start Work",
      projectId,
      steps: [
        { kind: "work-status", status: "In Progress" },
        { kind: "daily-focus-membership", operation: "add" },
      ],
    });
    const access = createTestRecordActions(database, {
      afterWrite(write) {
        if (write === "dailyFocus") {
          throw new Error("Injected Record Action write failure.");
        }
      },
    });
    const preview = await access.preview(accountId, {
      actionId: action.id,
      runtimeInputs: { customFieldValues: {}, relations: {} },
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
      focusDate: preview.focusDate,
      runtimeInputs: preview.runtimeInputs,
      previewFingerprint: preview.previewFingerprint,
      workId,
    };
    const result = await access.apply(accountId, command);

    expect(result.status).toBe("rolled-back");
    const rolledBackWork = await database
      .select({ status: work.status, revision: work.revision })
      .from(work)
      .where(eq(work.id, workId));
    expect(rolledBackWork).toEqual([{ revision: 0, status: "Not Started" }]);
    const memberships = await database
      .select()
      .from(dailyFocusMembership)
      .where(eq(dailyFocusMembership.workId, workId));
    expect(memberships).toEqual([]);
    await expect(
      access.preview(accountId, {
        actionId: action.id,
        runtimeInputs: { customFieldValues: {}, relations: {} },
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
    const access = createTestRecordActions(database);
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
      runtimeInputs: { customFieldValues: {}, relations: {} },
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
      focusDate: preview.focusDate,
      runtimeInputs: preview.runtimeInputs,
      previewFingerprint: preview.previewFingerprint,
      workId,
    });
    expect(result.status).toBe("committed");
    const values = await database
      .select()
      .from(customFieldValue)
      .where(eq(customFieldValue.recordId, workId));
    expect(values).toEqual([before]);
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
    const access = createTestRecordActions(database);
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
      runtimeInputs: { customFieldValues: {}, relations: {} },
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
      focusDate: preview.focusDate,
      runtimeInputs: preview.runtimeInputs,
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
    const staleWork = await database
      .select({ status: work.status, revision: work.revision })
      .from(work)
      .where(eq(work.id, workId));
    expect(staleWork).toEqual([{ revision: 1, status: "Blocked" }]);
    const staleMemberships = await database
      .select()
      .from(dailyFocusMembership)
      .where(eq(dailyFocusMembership.workId, workId));
    expect(staleMemberships).toEqual([]);
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
    const access = createTestRecordActions(database);
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
      runtimeInputs: { customFieldValues: {}, relations: {} },
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
      focusDate: preview.focusDate,
      runtimeInputs: preview.runtimeInputs,
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
    const undoneWork = await database
      .select({ status: work.status, revision: work.revision })
      .from(work)
      .where(eq(work.id, workId));
    expect(undoneWork).toEqual([{ revision: 2, status: "Not Started" }]);
    const undoneMemberships = await database
      .select()
      .from(dailyFocusMembership)
      .where(eq(dailyFocusMembership.workId, workId));
    expect(undoneMemberships).toEqual([]);
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
    const access = createTestRecordActions(database);
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
      runtimeInputs: { customFieldValues: {}, relations: {} },
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
      focusDate: preview.focusDate,
      runtimeInputs: preview.runtimeInputs,
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
    const workAfterRejectedUndo = await database
      .select({ status: work.status, revision: work.revision })
      .from(work)
      .where(eq(work.id, workId));
    expect(workAfterRejectedUndo).toEqual([{ revision: 2, status: "Blocked" }]);
    const membershipsAfterRejectedUndo = await database
      .select()
      .from(dailyFocusMembership)
      .where(eq(dailyFocusMembership.workId, workId));
    expect(membershipsAfterRejectedUndo).toHaveLength(1);
  }, 20_000);
});

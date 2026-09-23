import {
  customFieldValuePayloadSchema,
  type ParsedCustomFieldValuePayload,
} from "@cantiara/api/custom-fields";
import {
  canonicalizeMutationPayload,
  fingerprintMutationPayload,
  type MutationCommand,
  type MutationPayload,
  type MutationTarget,
} from "@cantiara/api/mutation-and-undo";
import {
  type ApplyRecordActionInput,
  type PreviewRecordActionInput,
  RECORD_ACTION_CUSTOM_FIELD_CHANGE_KEY_PREFIX,
  type RecordAction,
  type RecordActionMutationValue,
  type RecordActionPreview,
  type RecordActionRunPayload,
  type RecordActionStep,
  type RecordActionsAccess,
  recordActionMutationValueSchema,
  recordActionRunPayloadSchema,
  recordActionSchema,
  recordActionStepSchema,
  type UndoRecordActionInput,
} from "@cantiara/api/record-actions";
import { workStatusSchema } from "@cantiara/api/work-lifecycle";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  customFieldDefinition,
  customFieldValue,
} from "@cantiara/db/schema/custom-fields";
import { dailyFocusMembership } from "@cantiara/db/schema/daily-focus";
import { project } from "@cantiara/db/schema/project";
import { recordAction } from "@cantiara/db/schema/record-action";
import { work } from "@cantiara/db/schema/work";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { assertValueMatchesDefinition } from "../../custom-fields/server/custom-fields";
import { toCustomFieldDefinition } from "../../custom-fields/server/custom-fields-database";
import { MutationUndoNotSupportedError } from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";

type WorkDatabaseRecord = typeof work.$inferSelect;
type RecordActionDatabaseRecord = typeof recordAction.$inferSelect;
type CustomFieldDefinitionDatabaseRecord =
  typeof customFieldDefinition.$inferSelect;
type RecordActionRunSelection = Pick<
  ApplyRecordActionInput,
  "actionId" | "actionRevision" | "focusDate" | "workId"
>;
interface RecordActionProjection {
  customFieldIds: readonly string[];
  focusDate?: string;
  hasStatus: boolean;
}

export type RecordActionWrite = "customFieldValue" | "dailyFocus" | "work";

export interface RecordActionApplicationOptions {
  afterWrite?: (write: RecordActionWrite) => void | Promise<void>;
}

interface OwnedWork {
  record: WorkDatabaseRecord;
  workspaceId: string;
}

interface ActionRunTarget {
  action: RecordAction;
  customFieldDefinitions: Map<string, CustomFieldDefinitionDatabaseRecord>;
  customFieldNames: Map<string, string>;
  target: MutationTarget<RecordActionMutationValue>;
  work: WorkDatabaseRecord;
}

function toRecordAction(record: RecordActionDatabaseRecord): RecordAction {
  return recordActionSchema.parse({
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    name: record.name,
    projectId: record.projectId,
    revision: record.revision,
    steps: record.steps,
    trashedAt: record.trashedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
  });
}

async function findOwnedRecordAction(
  executor: MutationDatabaseExecutor,
  accountId: string,
  actionId: string,
  lock: boolean,
) {
  const [candidate] = await executor
    .select()
    .from(recordAction)
    .where(eq(recordAction.id, actionId))
    .limit(1);
  if (!candidate || candidate.trashedAt) {
    return null;
  }

  const [ownedProject] = await executor
    .select({ id: project.id })
    .from(project)
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(
        eq(project.id, candidate.projectId),
        eq(workspace.ownerAccountId, accountId),
      ),
    )
    .limit(1);
  if (!ownedProject) {
    return null;
  }

  if (!lock) {
    return toRecordAction(candidate);
  }

  const [locked] = await executor
    .select()
    .from(recordAction)
    .where(
      and(
        eq(recordAction.id, actionId),
        eq(recordAction.projectId, ownedProject.id),
        isNull(recordAction.trashedAt),
      ),
    )
    .limit(1)
    .for("update");
  return locked ? toRecordAction(locked) : null;
}

async function findOwnedWork(
  executor: MutationDatabaseExecutor,
  accountId: string,
  workId: string,
  lock: boolean,
): Promise<OwnedWork | null> {
  const [candidate] = await executor
    .select()
    .from(work)
    .where(eq(work.id, workId))
    .limit(1);
  if (!candidate) {
    return null;
  }

  const [scope] = await executor
    .select({ workspaceId: workspace.id })
    .from(project)
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(
        eq(project.id, candidate.projectId),
        eq(workspace.ownerAccountId, accountId),
      ),
    )
    .limit(1);
  if (!scope) {
    return null;
  }

  if (!lock) {
    return { record: candidate, workspaceId: scope.workspaceId };
  }

  const [locked] = await executor
    .select()
    .from(work)
    .where(and(eq(work.id, workId), eq(work.projectId, candidate.projectId)))
    .limit(1)
    .for("update");
  return locked ? { record: locked, workspaceId: scope.workspaceId } : null;
}

function projectionFromSteps(
  steps: readonly RecordActionStep[],
  focusDate: string,
): RecordActionProjection {
  return {
    customFieldIds: steps.flatMap((step) =>
      step.kind === "custom-field-value" ? [step.definitionId] : [],
    ),
    ...(steps.some((step) => step.kind === "daily-focus-membership")
      ? { focusDate }
      : {}),
    hasStatus: steps.some((step) => step.kind === "work-status"),
  };
}

function projectionFromValue(
  value: RecordActionMutationValue,
): RecordActionProjection {
  return {
    customFieldIds: Object.keys(value.customFields ?? {}),
    ...(value.dailyFocus ? { focusDate: value.dailyFocus.date } : {}),
    hasStatus: value.status !== undefined,
  };
}

async function readCustomFieldProjection(
  executor: MutationDatabaseExecutor,
  record: WorkDatabaseRecord,
  definitionIds: readonly string[],
  lock: boolean,
) {
  const definitionsById = new Map<
    string,
    CustomFieldDefinitionDatabaseRecord
  >();
  const customFieldNames = new Map<string, string>();
  const customFields: Record<string, ParsedCustomFieldValuePayload | null> = {};
  if (definitionIds.length === 0) {
    return {
      customFieldDefinitions: definitionsById,
      customFieldNames,
      customFields,
    };
  }

  const definitionQuery = executor
    .select()
    .from(customFieldDefinition)
    .where(
      and(
        eq(customFieldDefinition.projectId, record.projectId),
        inArray(customFieldDefinition.id, [...definitionIds]),
        isNull(customFieldDefinition.trashedAt),
      ),
    );
  const definitions = lock
    ? await definitionQuery.for("update")
    : await definitionQuery;
  if (definitions.length !== definitionIds.length) {
    return null;
  }
  for (const definition of definitions) {
    if (!definition.recordTypes.includes("Work")) {
      return null;
    }
    definitionsById.set(definition.id, definition);
    customFieldNames.set(definition.id, definition.name);
  }

  const valuesQuery = executor
    .select()
    .from(customFieldValue)
    .where(
      and(
        eq(customFieldValue.recordId, record.id),
        eq(customFieldValue.recordType, "Work"),
        inArray(customFieldValue.definitionId, [...definitionIds]),
      ),
    );
  const valueRecords = lock
    ? await valuesQuery.for("update")
    : await valuesQuery;
  const valuesByDefinition = new Map(
    valueRecords.map((valueRecord) => [
      valueRecord.definitionId,
      customFieldValuePayloadSchema.parse(valueRecord.value),
    ]),
  );
  for (const definitionId of definitionIds) {
    customFields[definitionId] = valuesByDefinition.get(definitionId) ?? null;
  }

  return {
    customFieldDefinitions: definitionsById,
    customFieldNames,
    customFields,
  };
}

async function readDailyFocusProjection(
  executor: MutationDatabaseExecutor,
  ownedWork: OwnedWork,
  focusDate: string | undefined,
  lock: boolean,
) {
  if (!focusDate) {
    return;
  }
  const membershipQuery = executor
    .select({ id: dailyFocusMembership.id })
    .from(dailyFocusMembership)
    .where(
      and(
        eq(dailyFocusMembership.workspaceId, ownedWork.workspaceId),
        eq(dailyFocusMembership.workId, ownedWork.record.id),
        eq(dailyFocusMembership.focusDate, focusDate),
      ),
    )
    .limit(1);
  const memberships = lock
    ? await membershipQuery.for("update")
    : await membershipQuery;
  return {
    date: focusDate,
    included: memberships.length > 0,
  };
}

async function readMutationValue(
  executor: MutationDatabaseExecutor,
  ownedWork: OwnedWork,
  projection: RecordActionProjection,
  lock: boolean,
) {
  const { record } = ownedWork;
  const customFieldProjection = await readCustomFieldProjection(
    executor,
    ownedWork.record,
    projection.customFieldIds,
    lock,
  );
  if (!customFieldProjection) {
    return null;
  }
  const dailyFocus = await readDailyFocusProjection(
    executor,
    ownedWork,
    projection.focusDate,
    lock,
  );

  const value = recordActionMutationValueSchema.parse({
    ...(projection.customFieldIds.length > 0
      ? { customFields: customFieldProjection.customFields }
      : {}),
    ...(projection.hasStatus
      ? {
          closureReason: record.closureReason,
          closureResult: record.closureResult,
          status: workStatusSchema.parse(record.status),
        }
      : {}),
    ...(dailyFocus ? { dailyFocus } : {}),
  });
  return {
    customFieldDefinitions: customFieldProjection.customFieldDefinitions,
    customFieldNames: customFieldProjection.customFieldNames,
    value,
  };
}

async function findActionRunTarget(
  executor: MutationDatabaseExecutor,
  accountId: string,
  selection: RecordActionRunSelection,
  lock: boolean,
): Promise<ActionRunTarget | null> {
  const action = await findOwnedRecordAction(
    executor,
    accountId,
    selection.actionId,
    lock,
  );
  if (!action || action.revision !== selection.actionRevision) {
    return null;
  }

  const steps = recordActionStepSchema.array().parse(action.steps);
  const ownedWork = await findOwnedWork(
    executor,
    accountId,
    selection.workId,
    lock,
  );
  if (!ownedWork || ownedWork.record.projectId !== action.projectId) {
    return null;
  }
  const projection = projectionFromSteps(steps, selection.focusDate);
  const current = await readMutationValue(
    executor,
    ownedWork,
    projection,
    lock,
  );
  if (!current) {
    return null;
  }

  const customSteps = steps.filter(
    (step): step is Extract<RecordActionStep, { kind: "custom-field-value" }> =>
      step.kind === "custom-field-value",
  );
  try {
    for (const step of customSteps) {
      const definition = current.customFieldDefinitions.get(step.definitionId);
      if (!definition) {
        return null;
      }
      assertValueMatchesDefinition(
        toCustomFieldDefinition(definition),
        step.value,
      );
    }
  } catch {
    return null;
  }

  return {
    action,
    customFieldDefinitions: current.customFieldDefinitions,
    customFieldNames: current.customFieldNames,
    target: {
      id: ownedWork.record.id,
      revision: ownedWork.record.revision,
      value: current.value,
    },
    work: ownedWork.record,
  };
}

function applySteps(
  currentValue: RecordActionMutationValue,
  steps: readonly RecordActionStep[],
  focusDate: string,
) {
  const next: RecordActionMutationValue = {
    ...currentValue,
    ...(currentValue.customFields
      ? { customFields: { ...currentValue.customFields } }
      : {}),
  };
  for (const step of steps) {
    switch (step.kind) {
      case "work-status":
        next.status = step.status;
        if (currentValue.status === "Closed") {
          next.closureReason = null;
          next.closureResult = null;
        }
        break;
      case "daily-focus-membership":
        next.dailyFocus = {
          date: focusDate,
          included: step.operation === "add",
        };
        break;
      case "custom-field-value":
        next.customFields = {
          ...(next.customFields ?? {}),
          [step.definitionId]: step.value,
        };
        break;
      default:
        throw new Error("Unsupported Record Action step.");
    }
  }
  return recordActionMutationValueSchema.parse(next);
}

function mutationValuesEqual(
  left: RecordActionMutationValue,
  right: RecordActionMutationValue,
) {
  return (
    canonicalizeMutationPayload(left) === canonicalizeMutationPayload(right)
  );
}

function previewFingerprint(
  input: RecordActionRunSelection,
  steps: readonly RecordActionStep[],
  currentValue: RecordActionMutationValue,
) {
  return fingerprintMutationPayload({
    actionId: input.actionId,
    actionRevision: input.actionRevision,
    currentValue,
    focusDate: input.focusDate,
    steps: [...steps],
    workId: input.workId,
  });
}

function addRecordActionChange(
  changes: RecordActionPreview["changes"],
  key: string,
  label: string,
  previous: string | null | boolean | ParsedCustomFieldValuePayload,
  next: string | null | boolean | ParsedCustomFieldValuePayload,
) {
  if (
    canonicalizeMutationPayload(previous) !== canonicalizeMutationPayload(next)
  ) {
    changes.push({ after: next, before: previous, key, label });
  }
}

function addWorkStatusChanges(
  changes: RecordActionPreview["changes"],
  before: RecordActionMutationValue,
  after: RecordActionMutationValue,
) {
  addRecordActionChange(
    changes,
    "status",
    "Work status",
    before.status ?? null,
    after.status ?? null,
  );
  if (before.closureResult || after.closureResult) {
    addRecordActionChange(
      changes,
      "closure-result",
      "Closure result",
      before.closureResult ?? null,
      after.closureResult ?? null,
    );
  }
  if (before.closureReason || after.closureReason) {
    addRecordActionChange(
      changes,
      "closure-reason",
      "Closure reason",
      before.closureReason ?? null,
      after.closureReason ?? null,
    );
  }
}

function recordActionChanges(
  steps: readonly RecordActionStep[],
  before: RecordActionMutationValue,
  after: RecordActionMutationValue,
  customFieldNames: ReadonlyMap<string, string>,
): RecordActionPreview["changes"] {
  const changes: RecordActionPreview["changes"] = [];

  for (const step of steps) {
    switch (step.kind) {
      case "work-status":
        addWorkStatusChanges(changes, before, after);
        break;
      case "daily-focus-membership":
        addRecordActionChange(
          changes,
          "daily-focus-membership",
          (after.dailyFocus?.date ?? before.dailyFocus?.date)
            ? `Daily Focus · ${after.dailyFocus?.date ?? before.dailyFocus?.date}`
            : "Daily Focus",
          before.dailyFocus?.included ?? false,
          after.dailyFocus?.included ?? false,
        );
        break;
      case "custom-field-value":
        addRecordActionChange(
          changes,
          `${RECORD_ACTION_CUSTOM_FIELD_CHANGE_KEY_PREFIX}${step.definitionId}`,
          customFieldNames.get(step.definitionId) ?? "Custom field",
          before.customFields?.[step.definitionId] ?? null,
          after.customFields?.[step.definitionId] ?? null,
        );
        break;
      default:
        throw new Error("Unsupported Record Action step.");
    }
  }
  return changes;
}

async function writeCustomFieldValues(
  executor: MutationDatabaseExecutor,
  input: {
    committedAt: Date;
    nextValue: RecordActionMutationValue;
    targetId: string;
  },
  options: RecordActionApplicationOptions,
) {
  const customFieldEntries = Object.entries(input.nextValue.customFields ?? {});
  if (customFieldEntries.length === 0) {
    return;
  }

  const currentValues = await executor
    .select()
    .from(customFieldValue)
    .where(
      and(
        eq(customFieldValue.recordId, input.targetId),
        eq(customFieldValue.recordType, "Work"),
        inArray(
          customFieldValue.definitionId,
          customFieldEntries.map(([definitionId]) => definitionId),
        ),
      ),
    )
    .for("update");
  const currentValuesByDefinition = new Map(
    currentValues.map((record) => [
      record.definitionId,
      customFieldValuePayloadSchema.parse(record.value),
    ]),
  );

  // Each selected field is written in order within the Mutation Contract transaction.
  for (const [definitionId, value] of customFieldEntries) {
    const currentValue = currentValuesByDefinition.get(definitionId);
    const isUnchanged =
      value === null
        ? currentValue === undefined
        : currentValue !== undefined &&
          canonicalizeMutationPayload(currentValue) ===
            canonicalizeMutationPayload(value);
    if (isUnchanged) {
      continue;
    }

    const where = and(
      eq(customFieldValue.definitionId, definitionId),
      eq(customFieldValue.recordId, input.targetId),
      eq(customFieldValue.recordType, "Work"),
    );
    if (value === null) {
      // biome-ignore lint/performance/noAwaitInLoops: Each field write stays ordered inside the same atomic transaction.
      await executor.delete(customFieldValue).where(where);
    } else {
      await executor
        .insert(customFieldValue)
        .values({
          definitionId,
          id: crypto.randomUUID(),
          recordId: input.targetId,
          recordType: "Work",
          value,
        })
        .onConflictDoUpdate({
          target: [customFieldValue.definitionId, customFieldValue.recordId],
          set: {
            revision: sql`${customFieldValue.revision} + 1`,
            updatedAt: input.committedAt,
            value,
          },
        });
    }
    await options.afterWrite?.("customFieldValue");
  }
}

async function writeMutationValue(
  executor: MutationDatabaseExecutor,
  accountId: string,
  input: {
    committedAt: Date;
    expectedRevision: number;
    nextValue: RecordActionMutationValue;
    targetId: string;
  },
  options: RecordActionApplicationOptions,
) {
  const ownedWork = await findOwnedWork(
    executor,
    accountId,
    input.targetId,
    true,
  );
  if (!ownedWork || ownedWork.record.revision !== input.expectedRevision) {
    return null;
  }

  const update: Partial<typeof work.$inferInsert> = {
    revision: input.expectedRevision + 1,
    updatedAt: input.committedAt,
  };
  if (input.nextValue.status !== undefined) {
    update.status = input.nextValue.status;
    update.closureReason = input.nextValue.closureReason ?? null;
    update.closureResult = input.nextValue.closureResult ?? null;
  }
  const [updated] = await executor
    .update(work)
    .set(update)
    .where(
      and(
        eq(work.id, input.targetId),
        eq(work.projectId, ownedWork.record.projectId),
        eq(work.revision, input.expectedRevision),
      ),
    )
    .returning({ id: work.id, revision: work.revision });
  if (!updated) {
    return null;
  }
  await options.afterWrite?.("work");

  await writeCustomFieldValues(executor, input, options);

  const { dailyFocus } = input.nextValue;
  if (dailyFocus) {
    const membershipWhere = and(
      eq(dailyFocusMembership.workspaceId, ownedWork.workspaceId),
      eq(dailyFocusMembership.workId, input.targetId),
      eq(dailyFocusMembership.focusDate, dailyFocus.date),
    );
    if (dailyFocus.included) {
      await executor
        .insert(dailyFocusMembership)
        .values({
          focusDate: dailyFocus.date,
          id: crypto.randomUUID(),
          workId: input.targetId,
          workspaceId: ownedWork.workspaceId,
        })
        .onConflictDoNothing({
          target: [
            dailyFocusMembership.workspaceId,
            dailyFocusMembership.workId,
            dailyFocusMembership.focusDate,
          ],
        });
    } else {
      await executor.delete(dailyFocusMembership).where(membershipWhere);
    }
    await options.afterWrite?.("dailyFocus");
  }

  return {
    id: updated.id,
    revision: updated.revision,
    value: input.nextValue,
  } satisfies MutationTarget<RecordActionMutationValue>;
}

function createRunTargetAdapter(
  accountId: string,
  input: RecordActionRunSelection,
  options: RecordActionApplicationOptions,
): MutationDatabaseTargetAdapter<RecordActionMutationValue> {
  return {
    async find(executor, targetId, lock, context) {
      const parsed = recordActionRunPayloadSchema.safeParse(context?.payload);
      if (
        targetId !== input.workId ||
        !parsed.success ||
        parsed.data.actionId !== input.actionId ||
        parsed.data.actionRevision !== input.actionRevision ||
        parsed.data.focusDate !== input.focusDate ||
        parsed.data.workId !== input.workId
      ) {
        return null;
      }
      const result = await findActionRunTarget(
        executor,
        accountId,
        input,
        lock,
      );
      return result?.target ?? null;
    },

    update(executor, updateInput) {
      return writeMutationValue(executor, accountId, updateInput, options);
    },
  };
}

function createUndoTargetAdapter(
  accountId: string,
  workId: string,
  projection: RecordActionProjection,
  options: RecordActionApplicationOptions,
): MutationDatabaseTargetAdapter<RecordActionMutationValue> {
  return {
    async find(executor, targetId, lock) {
      if (targetId !== workId) {
        return null;
      }
      const ownedWork = await findOwnedWork(executor, accountId, workId, lock);
      if (!ownedWork) {
        return null;
      }
      const current = await readMutationValue(
        executor,
        ownedWork,
        projection,
        lock,
      );
      return current
        ? {
            id: workId,
            revision: ownedWork.record.revision,
            value: current.value,
          }
        : null;
    },

    update(executor, updateInput) {
      return writeMutationValue(executor, accountId, updateInput, options);
    },
  };
}

function createMutation(
  database: Database,
  accountId: string,
  targetId: string,
  target: MutationDatabaseTargetAdapter<RecordActionMutationValue>,
) {
  return createDatabaseMutationContract<RecordActionMutationValue>(database, {
    barrierChecks: {
      authorization: ({ actor }) =>
        actor.type === "User" && actor.actorId === accountId,
      quota: () => true,
      scope: ({ targetId: currentTargetId }) => currentTargetId === targetId,
    },
    target,
  });
}

export function createDatabaseRecordActionApplication(
  database: Database,
  options: RecordActionApplicationOptions = {},
): Pick<RecordActionsAccess, "apply" | "preview" | "undo"> {
  return {
    async apply(accountId, input: ApplyRecordActionInput) {
      const selection: RecordActionRunSelection = {
        actionId: input.actionId,
        actionRevision: input.actionRevision,
        focusDate: input.focusDate,
        workId: input.workId,
      };
      const action = await findOwnedRecordAction(
        database,
        accountId,
        input.actionId,
        false,
      );
      const steps =
        action?.revision === input.actionRevision
          ? recordActionStepSchema.array().parse(action.steps)
          : [];
      const mutation = createMutation(
        database,
        accountId,
        input.workId,
        createRunTargetAdapter(accountId, selection, options),
      );
      const payload: RecordActionRunPayload = {
        actionId: input.actionId,
        actionRevision: input.actionRevision,
        focusDate: input.focusDate,
        previewFingerprint: input.previewFingerprint,
        workId: input.workId,
      };
      const command: MutationCommand<RecordActionRunPayload> = {
        actor: { actorId: accountId, type: "User" },
        baseRevision: input.baseRevision,
        clientIdempotencyKey: input.clientIdempotencyKey,
        kind: "human",
        payload,
        targetId: input.workId,
      };
      const undoPlan = { kind: "atomic-transform" as const, scope: "$" };
      const staged = await mutation.stage(command, { undo: undoPlan });
      return mutation.finalize(
        staged.id,
        async ({ currentValue, payload: stagedPayload }) => {
          const actualFingerprint = await previewFingerprint(
            selection,
            steps,
            currentValue,
          );
          if (actualFingerprint !== stagedPayload.previewFingerprint) {
            throw new Error("Record Action preview changed before apply.");
          }
          const nextValue = applySteps(
            currentValue,
            steps,
            selection.focusDate,
          );
          if (mutationValuesEqual(currentValue, nextValue)) {
            throw new Error("The Record Action would make no changes.");
          }
          return nextValue;
        },
        command,
        { undo: undoPlan },
      );
    },

    async preview(
      accountId: string,
      input: PreviewRecordActionInput,
    ): Promise<RecordActionPreview | null> {
      const action = await findOwnedRecordAction(
        database,
        accountId,
        input.actionId,
        false,
      );
      if (!action) {
        return null;
      }
      const selection: RecordActionRunSelection = {
        actionId: action.id,
        actionRevision: action.revision,
        focusDate: input.focusDate,
        workId: input.workId,
      };
      const target = await findActionRunTarget(
        database,
        accountId,
        selection,
        false,
      );
      if (!target) {
        return null;
      }
      const steps = recordActionStepSchema.array().parse(action.steps);
      const nextValue = applySteps(target.target.value, steps, input.focusDate);
      return {
        actionId: action.id,
        actionName: action.name,
        actionRevision: action.revision,
        baseRevision: target.target.revision,
        changes: recordActionChanges(
          steps,
          target.target.value,
          nextValue,
          target.customFieldNames,
        ),
        focusDate: input.focusDate,
        nextValue,
        previewFingerprint: await previewFingerprint(
          selection,
          steps,
          target.target.value,
        ),
        workId: target.work.id,
        workKey: target.work.key,
        workTitle: target.work.title,
      };
    },

    async undo(accountId, input: UndoRecordActionInput) {
      const receiptReader =
        createDatabaseMutationContract<RecordActionMutationValue>(database);
      if (!receiptReader.findReceiptById) {
        throw new Error("Mutation receipts are unavailable.");
      }
      const sourceReceipt = await receiptReader.findReceiptById(
        input.receiptId,
      );
      if (
        !sourceReceipt ||
        sourceReceipt.targetId !== input.workId ||
        sourceReceipt.actor.type !== "User" ||
        sourceReceipt.actor.actorId !== accountId ||
        sourceReceipt.undo?.kind !== "atomic-transform" ||
        sourceReceipt.undo.scope !== "$"
      ) {
        throw new MutationUndoNotSupportedError("not-recorded", {
          targetId: input.workId,
        });
      }

      const projection = projectionFromValue(sourceReceipt.nextValue);
      const mutation = createMutation(
        database,
        accountId,
        input.workId,
        createUndoTargetAdapter(accountId, input.workId, projection, options),
      );
      const command: MutationCommand<MutationPayload> = {
        actor: { actorId: accountId, type: "User" },
        baseRevision: input.baseRevision,
        clientIdempotencyKey: input.clientIdempotencyKey,
        kind: "human",
        payload: {
          operation: "undo-record-action",
          receiptId: input.receiptId,
          workId: input.workId,
        },
        targetId: input.workId,
      };
      return mutation.undo(
        sourceReceipt,
        command,
        ({ previousValue }) => previousValue,
      );
    },
  };
}

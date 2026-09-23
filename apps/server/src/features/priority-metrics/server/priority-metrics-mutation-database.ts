import type { MutationTarget } from "@cantiara/api/mutation-and-undo";
import {
  fingerprintMutationPayload,
  type MutationApply,
  type MutationCommand,
  type MutationContract,
  type MutationOptions,
  type MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import {
  clearPriorityMetricValueInputSchema,
  copyPriorityMetricDefinitionsPayloadSchema,
  createPriorityMetricInputSchema,
  type PriorityMetric,
  type PriorityMetricDefinitionsCopyMutationValue,
  type PriorityMetricMutationContracts,
  type PriorityMetricMutationValue,
  type PriorityMetricValue,
  type PriorityMetricValueMutationValue,
  priorityMetricNameKey,
  priorityMetricSchema,
  priorityMetricValueSchema,
  setPriorityMetricValueInputSchema,
  updatePriorityMetricInputSchema,
} from "@cantiara/api/priority-metrics";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  priorityMetricDefinition,
  workPriorityMetricValue,
} from "@cantiara/db/schema/priority-metrics";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { accountActorAlias } from "../../account-access/server/github-identity-confirmation";
import {
  MutationConflictError,
  mutationIdempotencyKey,
  mutationOrigin,
} from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import { PriorityMetricNameConflictError } from "./priority-metrics";
import {
  toPriorityMetric,
  toPriorityMetricValue,
} from "./priority-metrics-database";
import {
  createDatabasePriorityMetricTrashMaintenance,
  erasePriorityMetricContent,
  PRIORITY_METRIC_PERMANENT_DELETE_EVENT_TYPE,
  type PriorityMetricPermanentDeleteEventStore,
  priorityMetricPermanentDeleteEventId,
  priorityMetricPermanentDeleteEventKeyPrefix,
  priorityMetricPermanentDeleteEventRevision,
} from "./priority-metrics-trash-database";

type DefinitionUpdateInput = Parameters<
  MutationDatabaseTargetAdapter<PriorityMetricMutationValue>["update"]
>[1];
type ValueUpdateInput = Parameters<
  MutationDatabaseTargetAdapter<PriorityMetricValueMutationValue>["update"]
>[1];
type DefinitionsCopyUpdateInput = Parameters<
  MutationDatabaseTargetAdapter<PriorityMetricDefinitionsCopyMutationValue>["update"]
>[1];
type PriorityMetricValueDatabaseRecord =
  typeof workPriorityMetricValue.$inferSelect;

type DefinitionOperation = "create" | "delete" | "restore" | "trash" | "update";
type ExistingDefinitionOperation = Exclude<DefinitionOperation, "create">;
type MutableDefinitionOperation = Extract<
  DefinitionOperation,
  "restore" | "trash" | "update"
>;
type ValueOperation = "clear" | "set";

export class PriorityMetricProjectNotFoundError extends Error {
  readonly code = "PRIORITY_METRIC_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "PriorityMetricProjectNotFoundError";
  }
}

export class PriorityMetricTrashedError extends Error {
  readonly code = "PRIORITY_METRIC_TRASHED" as const;

  constructor(metricId: string) {
    super(`Priority metric ${metricId} is in configuration trash.`);
    this.name = "PriorityMetricTrashedError";
  }
}

export class PriorityMetricNotTrashedError extends Error {
  readonly code = "PRIORITY_METRIC_NOT_TRASHED" as const;

  constructor(metricId: string) {
    super(`Priority metric ${metricId} is not in configuration trash.`);
    this.name = "PriorityMetricNotTrashedError";
  }
}

export class PriorityMetricDisabledError extends Error {
  readonly code = "PRIORITY_METRIC_DISABLED" as const;

  constructor(metricId: string) {
    super(`Priority metric ${metricId} is disabled.`);
    this.name = "PriorityMetricDisabledError";
  }
}

export class PriorityMetricWorkNotFoundError extends Error {
  readonly code = "PRIORITY_METRIC_WORK_NOT_FOUND" as const;

  constructor(workId: string) {
    super(`Work ${workId} was not found.`);
    this.name = "PriorityMetricWorkNotFoundError";
  }
}

export class PriorityMetricProjectMismatchError extends Error {
  readonly code = "PRIORITY_METRIC_PROJECT_MISMATCH" as const;

  constructor() {
    super("Priority metric and Work must belong to the same Project.");
    this.name = "PriorityMetricProjectMismatchError";
  }
}

function emptyMetricTarget(
  targetId: string,
): MutationTarget<PriorityMetricMutationValue> {
  return { id: targetId, revision: 0, value: { metric: null } };
}

function metricValueTargetId(workId: string, metricId: string) {
  return `${workId}:${metricId}`;
}

async function ownedWorkspaceId(
  executor: MutationDatabaseExecutor,
  accountId: string,
) {
  const [record] = await executor
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  return record?.id ?? null;
}

async function projectIsOwned(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
) {
  const workspaceId = await ownedWorkspaceId(executor, accountId);
  if (!workspaceId) {
    return false;
  }
  const [record] = await executor
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.workspaceId, workspaceId)))
    .limit(1);
  return Boolean(record);
}

async function findOwnedMetric(
  executor: MutationDatabaseExecutor,
  accountId: string,
  metricId: string,
  lock: boolean,
) {
  const workspaceId = await ownedWorkspaceId(executor, accountId);
  if (!workspaceId) {
    return null;
  }
  const query = executor
    .select({ metric: priorityMetricDefinition })
    .from(priorityMetricDefinition)
    .innerJoin(project, eq(project.id, priorityMetricDefinition.projectId))
    .where(
      and(
        eq(priorityMetricDefinition.id, metricId),
        eq(project.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  return records[0]?.metric ?? null;
}

async function metricNameIsAvailable(
  executor: MutationDatabaseExecutor,
  projectId: string,
  name: string,
  exceptMetricId?: string,
) {
  const nameKey = priorityMetricNameKey(name);
  const [record] = await executor
    .select({ id: priorityMetricDefinition.id })
    .from(priorityMetricDefinition)
    .where(
      and(
        eq(priorityMetricDefinition.projectId, projectId),
        eq(priorityMetricDefinition.nameKey, nameKey),
        ...(exceptMetricId
          ? [ne(priorityMetricDefinition.id, exceptMetricId)]
          : []),
      ),
    )
    .limit(1);
  return !record;
}

async function createMetric(
  executor: MutationDatabaseExecutor,
  accountId: string,
  input: DefinitionUpdateInput,
) {
  const { metric } = input.nextValue;
  if (!metric) {
    return null;
  }
  if (!(await projectIsOwned(executor, accountId, metric.projectId))) {
    throw new PriorityMetricProjectNotFoundError(metric.projectId);
  }
  const parsed = priorityMetricSchema.parse(metric);
  if (!(await metricNameIsAvailable(executor, parsed.projectId, parsed.name))) {
    throw new PriorityMetricNameConflictError(parsed.name);
  }
  const [created] = await executor
    .insert(priorityMetricDefinition)
    .values({
      createdAt: input.committedAt,
      enabled: parsed.enabled,
      id: parsed.id,
      name: parsed.name,
      nameKey: priorityMetricNameKey(parsed.name),
      projectId: parsed.projectId,
      rankDescriptions: parsed.rankDescriptions,
      revision: input.expectedRevision + 1,
      shortDescription: parsed.shortDescription,
      trashedAt: null,
      updatedAt: input.committedAt,
    })
    .returning();
  return created
    ? {
        id: created.id,
        revision: created.revision,
        value: { metric: toPriorityMetric(created) },
      }
    : null;
}

async function findCreateDefinitionTarget(
  executor: MutationDatabaseExecutor,
  accountId: string,
  targetId: string,
  payload: MutationPayload | undefined,
) {
  const parsed = createPriorityMetricInputSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }
  if (!(await projectIsOwned(executor, accountId, parsed.data.projectId))) {
    throw new PriorityMetricProjectNotFoundError(parsed.data.projectId);
  }
  if (
    !(await metricNameIsAvailable(
      executor,
      parsed.data.projectId,
      parsed.data.name,
    ))
  ) {
    throw new PriorityMetricNameConflictError(parsed.data.name);
  }
  return emptyMetricTarget(targetId);
}

async function findDefinitionsCopyTarget(
  executor: MutationDatabaseExecutor,
  accountId: string,
  targetId: string,
  payload: MutationPayload | undefined,
) {
  const parsed = copyPriorityMetricDefinitionsPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }
  const [sourceOwned, targetOwned] = await Promise.all([
    projectIsOwned(executor, accountId, parsed.data.sourceProjectId),
    projectIsOwned(executor, accountId, parsed.data.targetProjectId),
  ]);
  if (!sourceOwned) {
    throw new PriorityMetricProjectNotFoundError(parsed.data.sourceProjectId);
  }
  if (!targetOwned) {
    throw new PriorityMetricProjectNotFoundError(parsed.data.targetProjectId);
  }
  return {
    id: targetId,
    revision: 0,
    value: { ...parsed.data, definitions: [] },
  } satisfies MutationTarget<PriorityMetricDefinitionsCopyMutationValue>;
}

async function copyMetricDefinitions(
  executor: MutationDatabaseExecutor,
  input: DefinitionsCopyUpdateInput,
) {
  const definitions: PriorityMetric[] = [];
  const sourceRecords = await executor
    .select()
    .from(priorityMetricDefinition)
    .where(
      and(
        eq(priorityMetricDefinition.projectId, input.nextValue.sourceProjectId),
        isNull(priorityMetricDefinition.trashedAt),
      ),
    )
    .orderBy(
      asc(priorityMetricDefinition.createdAt),
      asc(priorityMetricDefinition.nameKey),
    );

  for (const sourceRecord of sourceRecords) {
    const source = toPriorityMetric(sourceRecord);
    const [created] =
      // biome-ignore lint/performance/noAwaitInLoops: Copy definitions in deterministic order and roll the entire Mutation Contract transaction back on a name conflict.
      await executor
        .insert(priorityMetricDefinition)
        .values({
          enabled: source.enabled,
          id: crypto.randomUUID(),
          name: source.name,
          nameKey: priorityMetricNameKey(source.name),
          projectId: input.nextValue.targetProjectId,
          rankDescriptions: source.rankDescriptions,
          shortDescription: source.shortDescription,
        })
        .onConflictDoNothing({
          target: [
            priorityMetricDefinition.projectId,
            priorityMetricDefinition.nameKey,
          ],
        })
        .returning();
    if (!created) {
      throw new PriorityMetricNameConflictError(source.name);
    }
    definitions.push(toPriorityMetric(created));
  }

  return {
    id: input.targetId,
    revision: input.expectedRevision + 1,
    value: { ...input.nextValue, definitions },
  } satisfies MutationTarget<PriorityMetricDefinitionsCopyMutationValue>;
}

function createDefinitionsCopyMutationTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<PriorityMetricDefinitionsCopyMutationValue> {
  return {
    committedValue: (target) => target.value,
    find(executor, targetId, _lock, context) {
      return findDefinitionsCopyTarget(
        executor,
        accountId,
        targetId,
        context?.payload,
      );
    },

    update(executor, input) {
      return copyMetricDefinitions(executor, input);
    },
  };
}

function assertDefinitionOperationState(
  record: typeof priorityMetricDefinition.$inferSelect,
  operation: ExistingDefinitionOperation,
) {
  if (operation === "restore" || operation === "delete") {
    if (!record.trashedAt) {
      throw new PriorityMetricNotTrashedError(record.id);
    }
    return;
  }
  if (record.trashedAt) {
    throw new PriorityMetricTrashedError(record.id);
  }
}

async function findExistingDefinitionTarget(
  executor: MutationDatabaseExecutor,
  accountId: string,
  operation: ExistingDefinitionOperation,
  targetId: string,
  lock: boolean,
  payload: MutationPayload | undefined,
) {
  const record = await findOwnedMetric(executor, accountId, targetId, lock);
  if (!record) {
    return null;
  }
  assertDefinitionOperationState(record, operation);
  if (operation === "update") {
    await assertMetricNameAvailableForUpdate(executor, record, payload);
  }
  return {
    id: record.id,
    revision: record.revision,
    value: { metric: toPriorityMetric(record) },
  } satisfies MutationTarget<PriorityMetricMutationValue>;
}

async function assertMetricNameAvailableForUpdate(
  executor: MutationDatabaseExecutor,
  record: typeof priorityMetricDefinition.$inferSelect,
  payload: MutationPayload | undefined,
) {
  if (!payload) {
    return;
  }
  const parsed = updatePriorityMetricInputSchema.safeParse(payload);
  if (!parsed.success) {
    return;
  }
  if (
    !(await metricNameIsAvailable(
      executor,
      record.projectId,
      parsed.data.name,
      record.id,
    ))
  ) {
    throw new PriorityMetricNameConflictError(parsed.data.name);
  }
}

function definitionUpdatesFor(
  operation: MutableDefinitionOperation,
  nextMetric: NonNullable<PriorityMetricMutationValue["metric"]>,
  input: DefinitionUpdateInput,
): Partial<typeof priorityMetricDefinition.$inferInsert> {
  if (operation === "trash") {
    return {
      revision: input.expectedRevision + 1,
      trashedAt: input.committedAt,
      updatedAt: input.committedAt,
    };
  }
  if (operation === "restore") {
    return {
      revision: input.expectedRevision + 1,
      trashedAt: null,
      updatedAt: input.committedAt,
    };
  }
  return {
    enabled: nextMetric.enabled,
    name: nextMetric.name,
    nameKey: priorityMetricNameKey(nextMetric.name),
    rankDescriptions: nextMetric.rankDescriptions,
    revision: input.expectedRevision + 1,
    shortDescription: nextMetric.shortDescription,
    updatedAt: input.committedAt,
  };
}

async function updateExistingDefinition(
  executor: MutationDatabaseExecutor,
  accountId: string,
  operation: ExistingDefinitionOperation,
  input: DefinitionUpdateInput,
  permanentDeleteEvents?: PriorityMetricPermanentDeleteEventStore,
) {
  const record = await findOwnedMetric(
    executor,
    accountId,
    input.targetId,
    true,
  );
  if (!record) {
    return null;
  }
  assertDefinitionOperationState(record, operation);
  const identity = and(
    eq(priorityMetricDefinition.id, input.targetId),
    eq(priorityMetricDefinition.revision, input.expectedRevision),
  );
  if (operation === "delete") {
    if (
      input.nextValue.metric !== null ||
      input.expectedRevision !== record.revision
    ) {
      return null;
    }
    if (!permanentDeleteEvents) {
      throw new Error("Priority metric permanent delete log is unavailable.");
    }
    if (!input.actor?.actorId) {
      throw new Error("Priority metric permanent delete has no actor alias.");
    }
    const eventId = await priorityMetricPermanentDeleteEventId(
      record.id,
      record.revision,
      input.idempotencyKey,
      input.payloadFingerprint,
    );
    const event = {
      actorAlias: await accountActorAlias(input.actor.actorId),
      occurredAt: input.committedAt.toISOString(),
      id: eventId,
      targetAlias: record.id,
      type: PRIORITY_METRIC_PERMANENT_DELETE_EVENT_TYPE,
      version: 1,
    } as const;
    await permanentDeleteEvents.append(event);
    const deleted = await erasePriorityMetricContent(executor, {
      actorAlias: event.actorAlias,
      auditRecordId: `audit:${event.id}`,
      expectedRevision: input.expectedRevision,
      historyId: input.historyId,
      metricId: record.id,
      occurredAt: input.committedAt,
    });
    return deleted
      ? {
          id: input.targetId,
          revision: input.expectedRevision + 1,
          value: { metric: null },
        }
      : null;
  }

  const nextMetric = input.nextValue.metric;
  if (
    !nextMetric ||
    nextMetric.id !== record.id ||
    nextMetric.projectId !== record.projectId
  ) {
    return null;
  }
  const [updated] = await executor
    .update(priorityMetricDefinition)
    .set(definitionUpdatesFor(operation, nextMetric, input))
    .where(identity)
    .returning();
  return updated
    ? {
        id: updated.id,
        revision: updated.revision,
        value: { metric: toPriorityMetric(updated) },
      }
    : null;
}

function recoverableDeleteContract(
  contract: MutationContract<PriorityMetricMutationValue>,
  database: Database,
  events: PriorityMetricPermanentDeleteEventStore,
): MutationContract<PriorityMetricMutationValue> {
  const maintenance = createDatabasePriorityMetricTrashMaintenance(
    database,
    events,
  );
  return {
    ...contract,
    async mutate<TPayload extends MutationPayload>(
      command: MutationCommand<TPayload>,
      apply: MutationApply<PriorityMetricMutationValue, TPayload>,
      options?: MutationOptions,
    ) {
      try {
        return await contract.mutate(command, apply, options);
      } catch (error) {
        if (error instanceof MutationConflictError) {
          throw error;
        }
        const receipt = await recoverDeleteReceipt(
          contract,
          command,
          maintenance,
          events,
          error,
        );
        if (!receipt) {
          throw error;
        }
        return receipt;
      }
    },
  };
}

async function recoverDeleteReceipt<TPayload extends MutationPayload>(
  contract: MutationContract<PriorityMetricMutationValue>,
  command: MutationCommand<TPayload>,
  maintenance: ReturnType<typeof createDatabasePriorityMetricTrashMaintenance>,
  events: PriorityMetricPermanentDeleteEventStore,
  originalError: unknown,
) {
  let recovery: Awaited<ReturnType<typeof recoverProtectedDelete>>;
  try {
    recovery = await recoverProtectedDelete(command, maintenance, events);
  } catch (recoveryError) {
    if (recoveryError instanceof MutationConflictError) {
      throw recoveryError;
    }
    throw new Error(
      `Priority metric delete recovery failed after ${String(originalError)}.`,
      { cause: recoveryError },
    );
  }
  if (!recovery) {
    return null;
  }

  const durableReceipt = await contract.replay(command);
  if (durableReceipt) {
    return durableReceipt;
  }
  return {
    actor: command.actor,
    committedAt: recovery.event.occurredAt,
    id: recovery.event.id,
    nextValue: { metric: null },
    origin: mutationOrigin(command),
    payloadFingerprint: await fingerprintMutationPayload(command.payload),
    previousValue: { metric: null },
    revision: recovery.expectedRevision + 1,
    targetId: command.targetId,
  };
}

async function recoverProtectedDelete<TPayload extends MutationPayload>(
  command: MutationCommand<TPayload>,
  maintenance: ReturnType<typeof createDatabasePriorityMetricTrashMaintenance>,
  events: PriorityMetricPermanentDeleteEventStore,
) {
  const actorAlias = await accountActorAlias(command.actor.actorId);
  const idempotencyKey = mutationIdempotencyKey(command);
  const eventKeyPrefix = await priorityMetricPermanentDeleteEventKeyPrefix(
    command.targetId,
    idempotencyKey,
  );
  const payloadFingerprint = await fingerprintMutationPayload(command.payload);
  const matchingKeyEvents = (await events.list()).filter(
    (candidate) =>
      candidate.id.startsWith(eventKeyPrefix) &&
      candidate.actorAlias === actorAlias &&
      candidate.targetAlias === command.targetId,
  );
  const event = matchingKeyEvents.find((candidate) =>
    candidate.id.endsWith(`:p${payloadFingerprint}`),
  );
  if (!event) {
    if (matchingKeyEvents.length > 0) {
      throw new MutationConflictError(command.targetId);
    }
    return null;
  }
  const expectedRevision = priorityMetricPermanentDeleteEventRevision(
    event.id,
    eventKeyPrefix,
  );
  if (expectedRevision === null) {
    throw new Error("Unsupported priority metric delete event identity.");
  }
  await maintenance.replayPermanentDeletes();
  return { event, expectedRevision };
}

function createDefinitionMutationTarget(
  accountId: string,
  operation: DefinitionOperation,
  permanentDeleteEvents?: PriorityMetricPermanentDeleteEventStore,
): MutationDatabaseTargetAdapter<PriorityMetricMutationValue> {
  return {
    ...(operation === "delete"
      ? {
          historyPreviousValue: () => ({ metric: null }),
          receiptIdForCommit: ({
            expectedRevision,
            idempotencyKey,
            payloadFingerprint,
            targetId,
          }) =>
            priorityMetricPermanentDeleteEventId(
              targetId,
              expectedRevision,
              idempotencyKey,
              payloadFingerprint,
            ),
        }
      : {}),
    find(executor, targetId, lock, context) {
      if (operation === "create") {
        return findCreateDefinitionTarget(
          executor,
          accountId,
          targetId,
          context?.payload,
        );
      }
      return findExistingDefinitionTarget(
        executor,
        accountId,
        operation,
        targetId,
        lock,
        context?.payload,
      );
    },

    update(executor, input) {
      if (operation === "create") {
        return createMetric(executor, accountId, input);
      }
      return updateExistingDefinition(
        executor,
        accountId,
        operation,
        input,
        permanentDeleteEvents,
      );
    },
  };
}

async function findOwnedWork(
  executor: MutationDatabaseExecutor,
  accountId: string,
  workId: string,
  lock: boolean,
) {
  const workspaceId = await ownedWorkspaceId(executor, accountId);
  if (!workspaceId) {
    return null;
  }
  const query = executor
    .select({ id: work.id, projectId: work.projectId })
    .from(work)
    .innerJoin(project, eq(project.id, work.projectId))
    .where(and(eq(work.id, workId), eq(project.workspaceId, workspaceId)))
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  return records[0] ?? null;
}

async function findValueRow(
  executor: MutationDatabaseExecutor,
  projectId: string,
  workId: string,
  metricId: string,
  lock: boolean,
) {
  const query = executor
    .select()
    .from(workPriorityMetricValue)
    .where(
      and(
        eq(workPriorityMetricValue.projectId, projectId),
        eq(workPriorityMetricValue.workId, workId),
        eq(workPriorityMetricValue.metricId, metricId),
      ),
    )
    .limit(1);
  const rows = lock ? await query.for("update") : await query;
  return rows[0] ?? null;
}

async function findValueMutationTarget(
  executor: MutationDatabaseExecutor,
  accountId: string,
  targetId: string,
  lock: boolean,
  input:
    | ReturnType<typeof setPriorityMetricValueInputSchema.parse>
    | ReturnType<typeof clearPriorityMetricValueInputSchema.parse>,
) {
  if (metricValueTargetId(input.workId, input.metricId) !== targetId) {
    return null;
  }
  const owned = await findOwnedWork(executor, accountId, input.workId, lock);
  if (!owned) {
    throw new PriorityMetricWorkNotFoundError(input.workId);
  }
  if (owned.projectId !== input.projectId) {
    throw new PriorityMetricProjectMismatchError();
  }
  const metricQuery = executor
    .select()
    .from(priorityMetricDefinition)
    .where(
      and(
        eq(priorityMetricDefinition.id, input.metricId),
        eq(priorityMetricDefinition.projectId, owned.projectId),
      ),
    )
    .limit(1);
  const [metric] = lock ? await metricQuery.for("update") : await metricQuery;
  if (!metric) {
    throw new PriorityMetricProjectMismatchError();
  }
  if (metric.trashedAt) {
    throw new PriorityMetricTrashedError(metric.id);
  }
  if (!metric.enabled && "rank" in input) {
    throw new PriorityMetricDisabledError(metric.id);
  }
  const valueRow = await findValueRow(
    executor,
    owned.projectId,
    input.workId,
    input.metricId,
    lock,
  );
  return {
    id: targetId,
    revision: valueRow?.revision ?? 0,
    value: {
      value: valueRow?.rank ? toPriorityMetricValue(valueRow) : null,
    },
  } satisfies MutationTarget<PriorityMetricValueMutationValue>;
}

function createValueMutationTarget(
  accountId: string,
  operation: ValueOperation,
): MutationDatabaseTargetAdapter<PriorityMetricValueMutationValue> {
  return {
    find(executor, targetId, lock, context) {
      if (operation === "set") {
        const parsed = setPriorityMetricValueInputSchema.safeParse(
          context?.payload,
        );
        return parsed.success
          ? findValueMutationTarget(
              executor,
              accountId,
              targetId,
              lock,
              parsed.data,
            )
          : Promise.resolve(null);
      }
      const parsed = clearPriorityMetricValueInputSchema.safeParse(
        context?.payload,
      );
      return parsed.success
        ? findValueMutationTarget(
            executor,
            accountId,
            targetId,
            lock,
            parsed.data,
          )
        : Promise.resolve(null);
    },

    update(executor, input: ValueUpdateInput) {
      return updatePriorityMetricValue(executor, accountId, input);
    },
  };
}

async function updatePriorityMetricValue(
  executor: MutationDatabaseExecutor,
  accountId: string,
  input: ValueUpdateInput,
) {
  const target = parseMetricValueTargetId(input.targetId);
  if (!target) {
    return null;
  }
  const owned = await findOwnedWork(executor, accountId, target.workId, true);
  if (!owned) {
    return null;
  }
  const current = await findValueRow(
    executor,
    owned.projectId,
    target.workId,
    target.metricId,
    true,
  );
  const nextValue = input.nextValue.value;
  if (!nextValue) {
    return clearPriorityMetricValue(
      executor,
      input,
      current,
      target,
      owned.projectId,
    );
  }
  if (!isTargetPriorityMetricValue(nextValue, target, owned.projectId)) {
    return null;
  }
  const parsedValue = priorityMetricValueSchema.parse(nextValue);
  if (current) {
    return updateExistingPriorityMetricValue(
      executor,
      input,
      current,
      parsedValue,
    );
  }
  if (input.expectedRevision !== 0) {
    return null;
  }
  return insertPriorityMetricValue(executor, input, parsedValue);
}

function parseMetricValueTargetId(targetId: string) {
  const separatorIndex = targetId.indexOf(":");
  if (separatorIndex < 0) {
    return null;
  }
  const workId = targetId.slice(0, separatorIndex);
  const metricId = targetId.slice(separatorIndex + 1);
  return workId && metricId ? { metricId, workId } : null;
}

function isTargetPriorityMetricValue(
  value: PriorityMetricValue,
  target: { metricId: string; workId: string },
  projectId: string,
) {
  return (
    value.workId === target.workId &&
    value.metricId === target.metricId &&
    value.projectId === projectId
  );
}

async function clearPriorityMetricValue(
  executor: MutationDatabaseExecutor,
  input: ValueUpdateInput,
  current: PriorityMetricValueDatabaseRecord | null,
  target: { metricId: string; workId: string },
  projectId: string,
) {
  if (!current && input.expectedRevision !== 0) {
    return null;
  }
  const nextRevision = input.expectedRevision + 1;
  if (current) {
    const [updated] = await executor
      .update(workPriorityMetricValue)
      .set({
        rank: null,
        revision: nextRevision,
        updatedAt: input.committedAt,
      })
      .where(
        and(
          eq(workPriorityMetricValue.id, current.id),
          eq(workPriorityMetricValue.revision, input.expectedRevision),
        ),
      )
      .returning({ revision: workPriorityMetricValue.revision });
    if (!updated) {
      return null;
    }
  } else {
    const [created] = await executor
      .insert(workPriorityMetricValue)
      .values({
        createdAt: input.committedAt,
        id: crypto.randomUUID(),
        metricId: target.metricId,
        projectId,
        rank: null,
        revision: nextRevision,
        updatedAt: input.committedAt,
        workId: target.workId,
      })
      .returning({ revision: workPriorityMetricValue.revision });
    if (!created) {
      return null;
    }
  }
  return {
    id: input.targetId,
    revision: nextRevision,
    value: { value: null },
  } satisfies MutationTarget<PriorityMetricValueMutationValue>;
}

async function updateExistingPriorityMetricValue(
  executor: MutationDatabaseExecutor,
  input: ValueUpdateInput,
  current: PriorityMetricValueDatabaseRecord,
  nextValue: PriorityMetricValue,
) {
  const [updated] = await executor
    .update(workPriorityMetricValue)
    .set({
      rank: nextValue.rank,
      revision: input.expectedRevision + 1,
      updatedAt: input.committedAt,
    })
    .where(
      and(
        eq(workPriorityMetricValue.id, current.id),
        eq(workPriorityMetricValue.revision, input.expectedRevision),
      ),
    )
    .returning();
  return updated
    ? {
        id: input.targetId,
        revision: updated.revision,
        value: { value: toPriorityMetricValue(updated) },
      }
    : null;
}

async function insertPriorityMetricValue(
  executor: MutationDatabaseExecutor,
  input: ValueUpdateInput,
  value: PriorityMetricValue,
) {
  const [created] = await executor
    .insert(workPriorityMetricValue)
    .values({
      createdAt: input.committedAt,
      id: value.id,
      metricId: value.metricId,
      projectId: value.projectId,
      rank: value.rank,
      revision: input.expectedRevision + 1,
      updatedAt: input.committedAt,
      workId: value.workId,
    })
    .returning();
  return created
    ? {
        id: input.targetId,
        revision: created.revision,
        value: { value: toPriorityMetricValue(created) },
      }
    : null;
}

export function createDatabasePriorityMetricMutationContracts(
  database: Database,
  permanentDeleteEvents?: PriorityMetricPermanentDeleteEventStore,
): PriorityMetricMutationContracts {
  return {
    clearValue: (accountId) =>
      createDatabaseMutationContract<PriorityMetricValueMutationValue>(
        database,
        { target: createValueMutationTarget(accountId, "clear") },
      ),
    copyDefinitions: (accountId) =>
      createDatabaseMutationContract<PriorityMetricDefinitionsCopyMutationValue>(
        database,
        { target: createDefinitionsCopyMutationTarget(accountId) },
      ),
    create: (accountId) =>
      createDatabaseMutationContract<PriorityMetricMutationValue>(database, {
        target: createDefinitionMutationTarget(accountId, "create"),
      }),
    delete: (accountId) => {
      const contract =
        createDatabaseMutationContract<PriorityMetricMutationValue>(database, {
          target: createDefinitionMutationTarget(
            accountId,
            "delete",
            permanentDeleteEvents,
          ),
        });
      return permanentDeleteEvents
        ? recoverableDeleteContract(contract, database, permanentDeleteEvents)
        : contract;
    },
    restore: (accountId) =>
      createDatabaseMutationContract<PriorityMetricMutationValue>(database, {
        target: createDefinitionMutationTarget(accountId, "restore"),
      }),
    setValue: (accountId) =>
      createDatabaseMutationContract<PriorityMetricValueMutationValue>(
        database,
        { target: createValueMutationTarget(accountId, "set") },
      ),
    trash: (accountId) =>
      createDatabaseMutationContract<PriorityMetricMutationValue>(database, {
        target: createDefinitionMutationTarget(accountId, "trash"),
      }),
    update: (accountId) =>
      createDatabaseMutationContract<PriorityMetricMutationValue>(database, {
        target: createDefinitionMutationTarget(accountId, "update"),
      }),
  };
}

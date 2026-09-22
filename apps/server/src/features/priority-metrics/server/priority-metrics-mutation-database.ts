import type {
  MutationPayload,
  MutationTarget,
} from "@cantiara/api/mutation-and-undo";
import {
  clearPriorityMetricValueInputSchema,
  createPriorityMetricInputSchema,
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
import { and, eq, ne } from "drizzle-orm";

import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import {
  toPriorityMetric,
  toPriorityMetricValue,
} from "./priority-metrics-database";

type DefinitionUpdateInput = Parameters<
  MutationDatabaseTargetAdapter<PriorityMetricMutationValue>["update"]
>[1];
type ValueUpdateInput = Parameters<
  MutationDatabaseTargetAdapter<PriorityMetricValueMutationValue>["update"]
>[1];
type PriorityMetricValueDatabaseRecord =
  typeof workPriorityMetricValue.$inferSelect;

type DefinitionOperation = "create" | "trash" | "update";
type ValueOperation = "clear" | "set";

export class PriorityMetricProjectNotFoundError extends Error {
  readonly code = "PRIORITY_METRIC_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "PriorityMetricProjectNotFoundError";
  }
}

export class PriorityMetricNameConflictError extends Error {
  readonly code = "PRIORITY_METRIC_NAME_CONFLICT" as const;

  constructor(name: string) {
    super(`A Priority metric named ${name} already exists in this Project.`);
    this.name = "PriorityMetricNameConflictError";
  }
}

export class PriorityMetricTrashedError extends Error {
  readonly code = "PRIORITY_METRIC_TRASHED" as const;

  constructor(metricId: string) {
    super(`Priority metric ${metricId} is in configuration trash.`);
    this.name = "PriorityMetricTrashedError";
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

async function findExistingDefinitionTarget(
  executor: MutationDatabaseExecutor,
  accountId: string,
  operation: DefinitionOperation,
  targetId: string,
  lock: boolean,
  payload: MutationPayload | undefined,
) {
  const record = await findOwnedMetric(executor, accountId, targetId, lock);
  if (!record) {
    return null;
  }
  if (record.trashedAt) {
    throw new PriorityMetricTrashedError(record.id);
  }
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

function createDefinitionMutationTarget(
  accountId: string,
  operation: DefinitionOperation,
): MutationDatabaseTargetAdapter<PriorityMetricMutationValue> {
  return {
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

    async update(executor, input) {
      if (operation === "create") {
        return createMetric(executor, accountId, input);
      }
      const record = await findOwnedMetric(
        executor,
        accountId,
        input.targetId,
        true,
      );
      if (!record || record.trashedAt) {
        return null;
      }
      const identity = and(
        eq(priorityMetricDefinition.id, input.targetId),
        eq(priorityMetricDefinition.revision, input.expectedRevision),
      );
      const nextMetric = input.nextValue.metric;
      if (
        !nextMetric ||
        nextMetric.id !== record.id ||
        nextMetric.projectId !== record.projectId
      ) {
        return null;
      }

      const updates =
        operation === "trash"
          ? {
              enabled: false,
              revision: input.expectedRevision + 1,
              trashedAt: input.committedAt,
              updatedAt: input.committedAt,
            }
          : {
              enabled: nextMetric.enabled,
              name: nextMetric.name,
              nameKey: priorityMetricNameKey(nextMetric.name),
              rankDescriptions: nextMetric.rankDescriptions,
              revision: input.expectedRevision + 1,
              shortDescription: nextMetric.shortDescription,
              updatedAt: input.committedAt,
            };
      const [updated] = await executor
        .update(priorityMetricDefinition)
        .set(updates)
        .where(identity)
        .returning();
      return updated
        ? {
            id: updated.id,
            revision: updated.revision,
            value: { metric: toPriorityMetric(updated) },
          }
        : null;
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
    value: { value: valueRow ? toPriorityMetricValue(valueRow) : null },
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
    return clearPriorityMetricValue(executor, input, current);
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
) {
  if (!current && input.expectedRevision !== 0) {
    return null;
  }
  if (current) {
    const [deleted] = await executor
      .delete(workPriorityMetricValue)
      .where(
        and(
          eq(workPriorityMetricValue.id, current.id),
          eq(workPriorityMetricValue.revision, input.expectedRevision),
        ),
      )
      .returning({ id: workPriorityMetricValue.id });
    if (!deleted) {
      return null;
    }
  }
  return {
    id: input.targetId,
    revision: input.expectedRevision + 1,
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
): PriorityMetricMutationContracts {
  return {
    clearValue: (accountId) =>
      createDatabaseMutationContract<PriorityMetricValueMutationValue>(
        database,
        { target: createValueMutationTarget(accountId, "clear") },
      ),
    create: (accountId) =>
      createDatabaseMutationContract<PriorityMetricMutationValue>(database, {
        target: createDefinitionMutationTarget(accountId, "create"),
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

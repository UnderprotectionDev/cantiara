import type {
  MutationPayload,
  MutationTarget,
} from "@cantiara/api/mutation-and-undo";
import {
  createProjectSourceRecordInputSchema,
  decisionRecordSchema,
  milestoneRecordSchema,
  type ProjectSourceRecord,
  ProjectSourceRecordConflictError,
  type ProjectSourceRecordsAccess,
  type ProjectSourceType,
  productionIncidentRecordSchema,
  projectReleaseRecordSchema,
  projectSourceRecordInputSchema,
  projectSourceRecordSchema,
  projectSourceRecordsProjectInputSchema,
  transitionProjectSourceRecordInputSchema,
  updateProjectSourceRecordInputSchema,
} from "@cantiara/api/project-source-records";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { productionIncident } from "@cantiara/db/schema/production-incident";
import { project } from "@cantiara/db/schema/project";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { and, asc, eq } from "drizzle-orm";

import {
  MutationConflictError,
  MutationStaleBaseRevisionError,
  MutationTargetNotFoundError,
} from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";

type DecisionRecord = typeof decision.$inferSelect;
type MilestoneRecord = typeof projectMilestone.$inferSelect;
type ReleaseRecord = typeof projectRelease.$inferSelect;
type IncidentRecord = typeof productionIncident.$inferSelect;

type ProjectSourceMutationValue =
  | { decision: ProjectSourceRecord | null }
  | { milestone: ProjectSourceRecord | null }
  | { projectRelease: ProjectSourceRecord | null }
  | { productionIncident: ProjectSourceRecord | null };

function assertNever(value: never): never {
  throw new Error(`Unsupported project source record: ${String(value)}`);
}

function toDecision(record: DecisionRecord): ProjectSourceRecord {
  return decisionRecordSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    sourceType: "Decision",
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toMilestone(record: MilestoneRecord): ProjectSourceRecord {
  return milestoneRecordSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    sourceType: "Milestone",
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toProjectRelease(record: ReleaseRecord): ProjectSourceRecord {
  return projectReleaseRecordSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    sourceType: "Project Release",
    updatedAt: record.updatedAt.toISOString(),
  });
}

function toProductionIncident(record: IncidentRecord): ProjectSourceRecord {
  return productionIncidentRecordSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    occurredAt: record.occurredAt.toISOString(),
    sourceType: "Production Incident",
    updatedAt: record.updatedAt.toISOString(),
  });
}

function targetForRecord(
  record: ProjectSourceRecord,
): MutationTarget<ProjectSourceMutationValue> {
  switch (record.sourceType) {
    case "Decision":
      return {
        id: record.id,
        revision: record.revision,
        value: { decision: record },
      };
    case "Milestone":
      return {
        id: record.id,
        revision: record.revision,
        value: { milestone: record },
      };
    case "Project Release":
      return {
        id: record.id,
        revision: record.revision,
        value: { projectRelease: record },
      };
    case "Production Incident":
      return {
        id: record.id,
        revision: record.revision,
        value: { productionIncident: record },
      };
    default:
      return assertNever(record);
  }
}

function emptyTarget(
  sourceType: ProjectSourceType,
  targetId: string,
): MutationTarget<ProjectSourceMutationValue> {
  switch (sourceType) {
    case "Decision":
      return { id: targetId, revision: 0, value: { decision: null } };
    case "Milestone":
      return { id: targetId, revision: 0, value: { milestone: null } };
    case "Project Release":
      return { id: targetId, revision: 0, value: { projectRelease: null } };
    case "Production Incident":
      return {
        id: targetId,
        revision: 0,
        value: { productionIncident: null },
      };
    default:
      return assertNever(sourceType);
  }
}

function recordFromValue(value: ProjectSourceMutationValue) {
  return Object.values(value)[0] ?? null;
}

function sourceTypeFromPayload(
  payload?: MutationPayload,
): ProjectSourceType | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const { sourceType } = payload as Record<string, unknown>;
  return sourceType === "Decision" ||
    sourceType === "Milestone" ||
    sourceType === "Project Release" ||
    sourceType === "Production Incident"
    ? sourceType
    : null;
}

function projectIdFromPayload(payload?: MutationPayload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const { projectId } = payload as Record<string, unknown>;
  return typeof projectId === "string" ? projectId : null;
}

async function findOwnedProject(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
  lock: boolean,
) {
  const [ownedWorkspace] = await executor
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  if (!ownedWorkspace) {
    return null;
  }

  const query = executor
    .select()
    .from(project)
    .where(
      and(
        eq(project.id, projectId),
        eq(project.workspaceId, ownedWorkspace.id),
      ),
    )
    .limit(1);
  const rows = lock ? await query.for("update") : await query;
  return rows[0] ?? null;
}

async function findMutationTarget(
  executor: MutationDatabaseExecutor,
  accountId: string,
  sourceType: ProjectSourceType,
  targetId: string,
  projectId: string,
  lock: boolean,
): Promise<MutationTarget<ProjectSourceMutationValue> | null> {
  const ownedProject = await findOwnedProject(
    executor,
    accountId,
    projectId,
    lock,
  );
  if (!ownedProject || (lock && ownedProject.archivedAt !== null)) {
    return null;
  }

  switch (sourceType) {
    case "Decision": {
      const query = executor
        .select()
        .from(decision)
        .where(
          and(eq(decision.id, targetId), eq(decision.projectId, projectId)),
        )
        .limit(1);
      const [record] = lock ? await query.for("update") : await query;
      return record
        ? targetForRecord(toDecision(record))
        : emptyTarget(sourceType, targetId);
    }
    case "Milestone": {
      const query = executor
        .select()
        .from(projectMilestone)
        .where(
          and(
            eq(projectMilestone.id, targetId),
            eq(projectMilestone.projectId, projectId),
          ),
        )
        .limit(1);
      const [record] = lock ? await query.for("update") : await query;
      return record
        ? targetForRecord(toMilestone(record))
        : emptyTarget(sourceType, targetId);
    }
    case "Project Release": {
      const query = executor
        .select()
        .from(projectRelease)
        .where(
          and(
            eq(projectRelease.id, targetId),
            eq(projectRelease.projectId, projectId),
          ),
        )
        .limit(1);
      const [record] = lock ? await query.for("update") : await query;
      return record
        ? targetForRecord(toProjectRelease(record))
        : emptyTarget(sourceType, targetId);
    }
    case "Production Incident": {
      const query = executor
        .select()
        .from(productionIncident)
        .where(
          and(
            eq(productionIncident.id, targetId),
            eq(productionIncident.projectId, projectId),
          ),
        )
        .limit(1);
      const [record] = lock ? await query.for("update") : await query;
      return record
        ? targetForRecord(toProductionIncident(record))
        : emptyTarget(sourceType, targetId);
    }
    default:
      return assertNever(sourceType);
  }
}

interface WriteSourceRecordInput {
  committedAt: Date;
  executor: MutationDatabaseExecutor;
  expectedRevision: number;
  record: ProjectSourceRecord;
  targetId: string;
}

async function writeDecisionRecord(
  input: WriteSourceRecordInput & {
    record: Extract<ProjectSourceRecord, { sourceType: "Decision" }>;
  },
) {
  const { committedAt, expectedRevision, executor, record, targetId } = input;
  const values = {
    decision: record.decision,
    life: record.life,
    projectId: record.projectId,
    rationale: record.rationale,
    revision: expectedRevision + 1,
    title: record.title,
    updatedAt: committedAt,
  };
  if (expectedRevision === 0) {
    const [inserted] = await executor
      .insert(decision)
      .values({ ...values, createdAt: committedAt, id: record.id })
      .onConflictDoNothing({ target: decision.id })
      .returning();
    return inserted ? targetForRecord(toDecision(inserted)) : null;
  }
  const [updated] = await executor
    .update(decision)
    .set(values)
    .where(
      and(
        eq(decision.id, targetId),
        eq(decision.projectId, record.projectId),
        eq(decision.revision, expectedRevision),
      ),
    )
    .returning();
  return updated ? targetForRecord(toDecision(updated)) : null;
}

async function writeMilestoneRecord(
  input: WriteSourceRecordInput & {
    record: Extract<ProjectSourceRecord, { sourceType: "Milestone" }>;
  },
) {
  const { committedAt, expectedRevision, executor, record, targetId } = input;
  const values = {
    description: record.description,
    projectId: record.projectId,
    revision: expectedRevision + 1,
    status: record.status,
    targetDate: record.targetDate,
    title: record.title,
    updatedAt: committedAt,
  };
  if (expectedRevision === 0) {
    const [inserted] = await executor
      .insert(projectMilestone)
      .values({ ...values, createdAt: committedAt, id: record.id })
      .onConflictDoNothing({ target: projectMilestone.id })
      .returning();
    return inserted ? targetForRecord(toMilestone(inserted)) : null;
  }
  const [updated] = await executor
    .update(projectMilestone)
    .set(values)
    .where(
      and(
        eq(projectMilestone.id, targetId),
        eq(projectMilestone.projectId, record.projectId),
        eq(projectMilestone.revision, expectedRevision),
      ),
    )
    .returning();
  return updated ? targetForRecord(toMilestone(updated)) : null;
}

async function writeProjectReleaseRecord(
  input: WriteSourceRecordInput & {
    record: Extract<ProjectSourceRecord, { sourceType: "Project Release" }>;
  },
) {
  const { committedAt, expectedRevision, executor, record, targetId } = input;
  const values = {
    description: record.description,
    name: record.name,
    projectId: record.projectId,
    revision: expectedRevision + 1,
    status: record.status,
    updatedAt: committedAt,
    versionLabel: record.versionLabel,
  };
  if (expectedRevision === 0) {
    const [inserted] = await executor
      .insert(projectRelease)
      .values({ ...values, createdAt: committedAt, id: record.id })
      .onConflictDoNothing({ target: projectRelease.id })
      .returning();
    return inserted ? targetForRecord(toProjectRelease(inserted)) : null;
  }
  const [updated] = await executor
    .update(projectRelease)
    .set(values)
    .where(
      and(
        eq(projectRelease.id, targetId),
        eq(projectRelease.projectId, record.projectId),
        eq(projectRelease.revision, expectedRevision),
      ),
    )
    .returning();
  return updated ? targetForRecord(toProjectRelease(updated)) : null;
}

async function writeProductionIncidentRecord(
  input: WriteSourceRecordInput & {
    record: Extract<ProjectSourceRecord, { sourceType: "Production Incident" }>;
  },
) {
  const { committedAt, expectedRevision, executor, record, targetId } = input;
  const values = {
    detectedHow: record.detectedHow,
    impact: record.impact,
    learning: record.learning,
    occurredAt: new Date(record.occurredAt),
    projectId: record.projectId,
    resolution: record.resolution,
    revision: expectedRevision + 1,
    rootCause: record.rootCause,
    status: record.status,
    title: record.title,
    updatedAt: committedAt,
  };
  if (expectedRevision === 0) {
    const [inserted] = await executor
      .insert(productionIncident)
      .values({ ...values, createdAt: committedAt, id: record.id })
      .onConflictDoNothing({ target: productionIncident.id })
      .returning();
    return inserted ? targetForRecord(toProductionIncident(inserted)) : null;
  }
  const [updated] = await executor
    .update(productionIncident)
    .set(values)
    .where(
      and(
        eq(productionIncident.id, targetId),
        eq(productionIncident.projectId, record.projectId),
        eq(productionIncident.revision, expectedRevision),
      ),
    )
    .returning();
  return updated ? targetForRecord(toProductionIncident(updated)) : null;
}

function writeProjectSourceRecord(input: WriteSourceRecordInput) {
  switch (input.record.sourceType) {
    case "Decision":
      return writeDecisionRecord({ ...input, record: input.record });
    case "Milestone":
      return writeMilestoneRecord({ ...input, record: input.record });
    case "Project Release":
      return writeProjectReleaseRecord({ ...input, record: input.record });
    case "Production Incident":
      return writeProductionIncidentRecord({ ...input, record: input.record });
    default:
      return assertNever(input.record);
  }
}

function projectSourceMutationTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<ProjectSourceMutationValue> {
  return {
    committedValue(target) {
      return target.value;
    },

    find(executor, targetId, lock, context) {
      const sourceType = sourceTypeFromPayload(context?.payload);
      const projectId = projectIdFromPayload(context?.payload);
      if (!(sourceType && projectId)) {
        return Promise.resolve(null);
      }
      return findMutationTarget(
        executor,
        accountId,
        sourceType,
        targetId,
        projectId,
        lock,
      );
    },

    async update(executor, input) {
      const record = recordFromValue(input.nextValue);
      if (!record || record.id !== input.targetId) {
        return null;
      }
      const ownedProject = await findOwnedProject(
        executor,
        accountId,
        record.projectId,
        true,
      );
      if (!ownedProject || ownedProject.archivedAt !== null) {
        return null;
      }
      return writeProjectSourceRecord({
        committedAt: input.committedAt,
        expectedRevision: input.expectedRevision,
        executor,
        record,
        targetId: input.targetId,
      });
    },
  };
}

function requireMutationContract(database: Database, accountId: string) {
  return createDatabaseMutationContract<ProjectSourceMutationValue>(database, {
    target: projectSourceMutationTarget(accountId),
  });
}

function recordFromReceipt(value: ProjectSourceMutationValue) {
  return recordFromValue(value);
}

function currentRecord(value: ProjectSourceMutationValue) {
  return recordFromValue(value);
}

function statusOf(record: ProjectSourceRecord) {
  return record.sourceType === "Decision" ? record.life : record.status;
}

function allowsTransition(
  record: ProjectSourceRecord,
  next: ProjectSourceRecord,
) {
  const previousStatus = statusOf(record);
  const nextStatus = statusOf(next);
  if (previousStatus === nextStatus) {
    return false;
  }
  if (record.sourceType === "Decision") {
    return record.life === "Valid" && next.sourceType === "Decision";
  }
  if (record.sourceType === "Milestone") {
    return record.status === "Planned" && next.sourceType === "Milestone";
  }
  if (record.sourceType === "Project Release") {
    return (
      (record.status === "Draft" || record.status === "Preparing") &&
      next.sourceType === "Project Release"
    );
  }
  return next.sourceType === "Production Incident";
}

export function createDatabaseProjectSourceRecords(
  database: Database,
): ProjectSourceRecordsAccess {
  return {
    async create(accountId, rawInput) {
      const input = createProjectSourceRecordInputSchema.parse(rawInput);
      const mutation = requireMutationContract(database, accountId);
      const { baseRevision, clientIdempotencyKey, ...fields } = input;
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: accountId, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: { operation: "create", ...fields },
            targetId: input.id,
          },
          ({ committedAt, currentRevision, currentValue }) => {
            if (currentRecord(currentValue)) {
              throw new MutationConflictError(input.id);
            }
            let initialValue: object;
            switch (fields.sourceType) {
              case "Decision":
                initialValue = { ...fields, life: "Valid" };
                break;
              case "Milestone":
                initialValue = { ...fields, status: "Planned" };
                break;
              case "Project Release":
                initialValue = { ...fields, status: "Draft" };
                break;
              case "Production Incident":
                initialValue = { ...fields, status: "Open" };
                break;
              default:
                assertNever(fields);
            }
            const record = projectSourceRecordSchema.parse({
              ...initialValue,
              createdAt: committedAt,
              revision: currentRevision + 1,
              updatedAt: committedAt,
            });
            return targetForRecord(record).value;
          },
        );
        return recordFromReceipt(receipt.nextValue);
      } catch (error) {
        if (error instanceof MutationTargetNotFoundError) {
          return null;
        }
        if (
          error instanceof MutationConflictError ||
          error instanceof MutationStaleBaseRevisionError
        ) {
          throw new ProjectSourceRecordConflictError(input.id, {
            cause: error,
          });
        }
        throw error;
      }
    },

    async update(accountId, rawInput) {
      const input = updateProjectSourceRecordInputSchema.parse(rawInput);
      const mutation = requireMutationContract(database, accountId);
      const { baseRevision, clientIdempotencyKey, ...fields } = input;
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: accountId, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: { operation: "update", ...fields },
            targetId: input.sourceId,
          },
          ({ committedAt, currentRevision, currentValue }) => {
            const current = currentRecord(currentValue);
            if (
              !current ||
              current.projectId !== input.projectId ||
              current.sourceType !== input.sourceType
            ) {
              throw new MutationConflictError(input.sourceId);
            }
            let record: ProjectSourceRecord;
            switch (input.sourceType) {
              case "Decision":
                record = decisionRecordSchema.parse({
                  ...current,
                  decision: input.decision,
                  id: input.sourceId,
                  rationale: input.rationale,
                  revision: currentRevision + 1,
                  sourceType: "Decision",
                  title: input.title,
                  updatedAt: committedAt,
                });
                break;
              case "Milestone":
                record = milestoneRecordSchema.parse({
                  ...current,
                  description: input.description,
                  id: input.sourceId,
                  revision: currentRevision + 1,
                  sourceType: "Milestone",
                  targetDate: input.targetDate,
                  title: input.title,
                  updatedAt: committedAt,
                });
                break;
              case "Project Release":
                record = projectReleaseRecordSchema.parse({
                  ...current,
                  description: input.description,
                  id: input.sourceId,
                  name: input.name,
                  revision: currentRevision + 1,
                  sourceType: "Project Release",
                  updatedAt: committedAt,
                  versionLabel: input.versionLabel,
                });
                break;
              case "Production Incident":
                record = productionIncidentRecordSchema.parse({
                  ...current,
                  detectedHow: input.detectedHow,
                  id: input.sourceId,
                  impact: input.impact,
                  learning: input.learning,
                  occurredAt: input.occurredAt,
                  resolution: input.resolution,
                  revision: currentRevision + 1,
                  rootCause: input.rootCause,
                  sourceType: "Production Incident",
                  title: input.title,
                  updatedAt: committedAt,
                });
                break;
              default:
                assertNever(input);
            }
            return targetForRecord(record).value;
          },
        );
        return recordFromReceipt(receipt.nextValue);
      } catch (error) {
        if (error instanceof MutationTargetNotFoundError) {
          return null;
        }
        if (
          error instanceof MutationConflictError ||
          error instanceof MutationStaleBaseRevisionError
        ) {
          throw new ProjectSourceRecordConflictError(input.sourceId, {
            cause: error,
          });
        }
        throw error;
      }
    },

    async transition(accountId, rawInput) {
      const input = transitionProjectSourceRecordInputSchema.parse(rawInput);
      const mutation = requireMutationContract(database, accountId);
      const { baseRevision, clientIdempotencyKey, ...fields } = input;
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: accountId, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: { operation: "transition", ...fields },
            targetId: input.sourceId,
          },
          ({ committedAt, currentRevision, currentValue }) => {
            const current = currentRecord(currentValue);
            if (
              !current ||
              current.projectId !== input.projectId ||
              current.sourceType !== input.sourceType
            ) {
              throw new MutationConflictError(input.sourceId);
            }
            const record = projectSourceRecordSchema.parse(
              input.sourceType === "Decision"
                ? {
                    ...current,
                    life: input.life,
                    revision: currentRevision + 1,
                    updatedAt: committedAt,
                  }
                : {
                    ...current,
                    revision: currentRevision + 1,
                    status: input.status,
                    updatedAt: committedAt,
                  },
            );
            if (!allowsTransition(current, record)) {
              throw new MutationConflictError(input.sourceId);
            }
            return targetForRecord(record).value;
          },
        );
        return recordFromReceipt(receipt.nextValue);
      } catch (error) {
        if (error instanceof MutationTargetNotFoundError) {
          return null;
        }
        if (
          error instanceof MutationConflictError ||
          error instanceof MutationStaleBaseRevisionError
        ) {
          throw new ProjectSourceRecordConflictError(input.sourceId, {
            cause: error,
          });
        }
        throw error;
      }
    },

    async find(accountId, sourceType, sourceId) {
      const identity = projectSourceRecordInputSchema.parse({
        sourceId,
        sourceType,
      });
      const record = await readRecord(
        database,
        accountId,
        identity.sourceType,
        identity.sourceId,
      );
      return record;
    },

    async list(accountId, projectId) {
      const input = projectSourceRecordsProjectInputSchema.parse({ projectId });
      const ownedProject = await findOwnedProject(
        database,
        accountId,
        input.projectId,
        false,
      );
      if (!ownedProject) {
        return null;
      }
      const [decisions, milestones, releases, incidents] = await Promise.all([
        database
          .select()
          .from(decision)
          .where(eq(decision.projectId, input.projectId))
          .orderBy(asc(decision.createdAt), asc(decision.id)),
        database
          .select()
          .from(projectMilestone)
          .where(eq(projectMilestone.projectId, input.projectId))
          .orderBy(asc(projectMilestone.createdAt), asc(projectMilestone.id)),
        database
          .select()
          .from(projectRelease)
          .where(eq(projectRelease.projectId, input.projectId))
          .orderBy(asc(projectRelease.createdAt), asc(projectRelease.id)),
        database
          .select()
          .from(productionIncident)
          .where(eq(productionIncident.projectId, input.projectId))
          .orderBy(
            asc(productionIncident.createdAt),
            asc(productionIncident.id),
          ),
      ]);
      return [
        ...decisions.map(toDecision),
        ...milestones.map(toMilestone),
        ...releases.map(toProjectRelease),
        ...incidents.map(toProductionIncident),
      ].sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.sourceType.localeCompare(right.sourceType) ||
          left.id.localeCompare(right.id),
      );
    },
  };
}

async function readRecord(
  database: Database,
  accountId: string,
  sourceType: ProjectSourceType,
  sourceId: string,
): Promise<ProjectSourceRecord | null> {
  let record: ProjectSourceRecord | null = null;
  switch (sourceType) {
    case "Decision": {
      const [row] = await database
        .select()
        .from(decision)
        .where(eq(decision.id, sourceId))
        .limit(1);
      record = row ? toDecision(row) : null;
      break;
    }
    case "Milestone": {
      const [row] = await database
        .select()
        .from(projectMilestone)
        .where(eq(projectMilestone.id, sourceId))
        .limit(1);
      record = row ? toMilestone(row) : null;
      break;
    }
    case "Project Release": {
      const [row] = await database
        .select()
        .from(projectRelease)
        .where(eq(projectRelease.id, sourceId))
        .limit(1);
      record = row ? toProjectRelease(row) : null;
      break;
    }
    case "Production Incident": {
      const [row] = await database
        .select()
        .from(productionIncident)
        .where(eq(productionIncident.id, sourceId))
        .limit(1);
      record = row ? toProductionIncident(row) : null;
      break;
    }
    default:
      return assertNever(sourceType);
  }
  if (!record) {
    return null;
  }
  const ownedProject = await findOwnedProject(
    database,
    accountId,
    record.projectId,
    false,
  );
  return ownedProject ? record : null;
}

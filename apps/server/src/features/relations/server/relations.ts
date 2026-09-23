import { fileAttachmentLocationSchema } from "@cantiara/api/file-attachments";
import type {
  MutationCommand,
  MutationPayload,
  MutationReceipt,
} from "@cantiara/api/mutation-and-undo";
import { fingerprintMutationPayload } from "@cantiara/api/mutation-and-undo";
import {
  type BlockingRelationHistoryEntry,
  type BlockingRelationStatus,
  type BrokenReferenceReason,
  brokenReferenceReasonSchema,
  isAllowedRelationEndpoints,
  type ReactivateBlockerInput,
  type RelationCreateInput,
  type RelationCreatePreviewInput,
  type RelationEndpoint,
  type RelationEndpointView,
  type RelationKind,
  type RelationMutationResult,
  type RelationOriginPosition,
  type RelationPayloadRelation,
  type RelationPreview,
  type RelationRecordType,
  type RelationsAccess,
  type RelationUsageView,
  type RelationView,
  type RemoveRelationInput,
  type ResolveBlockerInput,
  reactivateBlockerInputSchema,
  relationCreateInputSchema,
  relationCreatePreviewInputSchema,
  relationDefinition,
  relationKindSchema,
  relationLabel,
  relationRecordTypeSchema,
  relationsInputSchema,
  relationUniqueness,
  relationUsageCreateInputSchema,
  relationUsageKindSchema,
  relationUsageRemoveInputSchema,
  removeRelationInputSchema,
  resolveBlockerInputSchema,
  type StoredRelationValue,
  type UndoRelationInput,
  type UsedInSummary,
  undoRelationInputSchema,
} from "@cantiara/api/relations";
import type { WorkStatus, WorkType } from "@cantiara/api/work-lifecycle";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  project,
  usageLink,
  work,
  workRelation,
} from "@cantiara/db/schema/index";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { and, asc, eq, inArray, isNull, ne, or } from "drizzle-orm";

import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import { relationBlockingStatus } from "./relation-blocking-status";

type WorkRecord = typeof work.$inferSelect;
type ProjectRecord = typeof project.$inferSelect;
type RelationRecord = typeof workRelation.$inferSelect;
type UsageLinkRecord = typeof usageLink.$inferSelect;

/**
 * The value stored by the Mutation Contract for a relation target. Creation
 * time stays on the row; blocker resolution metadata travels with target
 * snapshots so Undo can restore the resolved state.
 */
export interface RelationStoreValue {
  relation: RelationPayloadRelation | null;
}

type RelationMutationPayload =
  | {
      operation: "create";
      relation: RelationPayloadRelation;
    }
  | {
      operation: "blocking-status";
      blockingStatus: "Active" | "Resolved";
      note: string | null;
      relationId: string;
    }
  | {
      operation: "remove";
      relationId: string;
    }
  | {
      operation: "undo";
      receiptId: string;
      relationId: string;
    };

export class RelationsError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "RelationsError";
  }
}

export class RelationEndpointNotAllowedError extends RelationsError {
  constructor() {
    super(
      "RELATION_ENDPOINT_NOT_ALLOWED",
      "The selected relation endpoints are not allowed by the catalog.",
    );
  }
}

export class RelationRecordUnavailableError extends RelationsError {
  constructor() {
    super("RELATION_RECORD_UNAVAILABLE", "The selected record is unavailable.");
  }
}

export class RelationDuplicateError extends RelationsError {
  constructor() {
    super("RELATION_DUPLICATE", "This relation already exists.");
  }
}

export class BlockingRelationStateError extends RelationsError {
  constructor() {
    super(
      "BLOCKING_RELATION_STATE_CONFLICT",
      "The blocker is no longer in the expected state.",
    );
  }
}

export class RelationCycleError extends RelationsError {
  constructor() {
    super(
      "RELATION_CYCLE",
      "This relation would create a cycle in the catalog.",
    );
  }
}

export class RelationPreviewRequiredError extends RelationsError {
  constructor() {
    super(
      "RELATION_PREVIEW_REQUIRED",
      "Review the current relation preview before confirming.",
    );
  }
}

export class RelationNotFoundError extends RelationsError {
  constructor() {
    super("RELATION_NOT_FOUND", "The relation is unavailable.");
  }
}

export class RelationUndoUnavailableError extends RelationsError {
  constructor() {
    super(
      "RELATION_UNDO_UNAVAILABLE",
      "This relation is no longer available for Undo.",
    );
  }
}

interface WorkWithProject {
  project: ProjectRecord;
  record: WorkRecord;
}

type OwnedWork = WorkWithProject;

interface RelationWithSource {
  relation: RelationRecord;
  sourceProject: ProjectRecord;
  sourceWork: WorkRecord;
}

interface RelationEndsInput {
  kind: RelationKind;
  sourceId: string;
  sourceType: RelationRecordType;
  targetId: string;
  targetType: RelationRecordType;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseMutationPayload(
  payload: MutationPayload | undefined,
): RelationMutationPayload | null {
  if (!isRecord(payload) || typeof payload.operation !== "string") {
    return null;
  }
  if (payload.operation === "create" && isRecord(payload.relation)) {
    return payload as unknown as RelationMutationPayload;
  }
  if (
    payload.operation === "remove" &&
    typeof payload.relationId === "string"
  ) {
    return payload as unknown as RelationMutationPayload;
  }
  if (
    payload.operation === "blocking-status" &&
    typeof payload.relationId === "string"
  ) {
    return payload as unknown as RelationMutationPayload;
  }
  if (
    payload.operation === "undo" &&
    typeof payload.receiptId === "string" &&
    typeof payload.relationId === "string"
  ) {
    return payload as unknown as RelationMutationPayload;
  }
  return null;
}

async function findOwnedWorkspaceId(
  executor: MutationDatabaseExecutor,
  accountId: string,
): Promise<string | null> {
  const [record] = await executor
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  return record?.id ?? null;
}

async function findOwnedWork(
  executor: MutationDatabaseExecutor,
  accountId: string,
  workId: string,
  lock: boolean,
): Promise<OwnedWork | null> {
  const workspaceId = await findOwnedWorkspaceId(executor, accountId);
  if (!workspaceId) {
    return null;
  }

  const query = executor
    .select({ project, record: work })
    .from(work)
    .innerJoin(project, eq(work.projectId, project.id))
    .where(and(eq(work.id, workId), eq(project.workspaceId, workspaceId)))
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  return records[0] ?? null;
}

async function findOwnedProject(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
): Promise<ProjectRecord | null> {
  const workspaceId = await findOwnedWorkspaceId(executor, accountId);
  if (!workspaceId) {
    return null;
  }
  const [record] = await executor
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.workspaceId, workspaceId)))
    .limit(1);
  return record ?? null;
}

async function findAnyProject(
  executor: MutationDatabaseExecutor,
  projectId: string,
): Promise<ProjectRecord | null> {
  const [record] = await executor
    .select()
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  return record ?? null;
}

async function findAnyWork(
  executor: MutationDatabaseExecutor,
  workId: string,
): Promise<WorkWithProject | null> {
  const [record] = await executor
    .select({ project, record: work })
    .from(work)
    .innerJoin(project, eq(work.projectId, project.id))
    .where(eq(work.id, workId))
    .limit(1);
  return record ?? null;
}

async function findRelationWithSource(
  executor: MutationDatabaseExecutor,
  accountId: string,
  relationId: string,
  lock: boolean,
): Promise<RelationWithSource | null> {
  const workspaceId = await findOwnedWorkspaceId(executor, accountId);
  if (!workspaceId) {
    return null;
  }
  const query = executor
    .select({
      relation: workRelation,
      sourceProject: project,
      sourceWork: work,
    })
    .from(workRelation)
    .innerJoin(work, eq(workRelation.sourceWorkId, work.id))
    .innerJoin(project, eq(work.projectId, project.id))
    .where(
      and(
        eq(workRelation.id, relationId),
        eq(workRelation.sourceRecordType, "Work"),
        eq(project.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  return records[0] ?? null;
}

function relationKind(value: string): RelationKind {
  return relationKindSchema.parse(value);
}

function relationRecordType(value: string): RelationRecordType {
  return relationRecordTypeSchema.parse(value);
}

function relationUsageKind(value: string) {
  return relationUsageKindSchema.parse(value);
}

function payloadRelationFromRecord(
  record: RelationRecord,
): RelationPayloadRelation {
  const kind = relationKind(record.kind);
  return {
    blockingStatus: relationBlockingStatus(kind, record.blockingStatus),
    blockingResolvedAt: record.blockingResolvedAt?.toISOString() ?? null,
    blockingResolutionNote: record.blockingResolutionNote,
    id: record.id,
    kind,
    sourceRecordId: record.sourceWorkId,
    sourceRecordType: relationRecordType(record.sourceRecordType),
    targetLabel: record.targetLabel,
    targetProjectId: record.targetProjectId,
    targetRecordId: record.targetRecordId,
    targetRecordType: relationRecordType(record.targetRecordType),
  };
}

function storedRelationFromRecord(record: RelationRecord): StoredRelationValue {
  const kind = relationKind(record.kind);
  return {
    blockingStatus: relationBlockingStatus(kind, record.blockingStatus),
    blockingResolvedAt: record.blockingResolvedAt?.toISOString() ?? null,
    blockingResolutionNote: record.blockingResolutionNote,
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    kind,
    sourceRecordId: record.sourceWorkId,
    sourceRecordType: relationRecordType(record.sourceRecordType),
    targetLabel: record.targetLabel,
    targetProjectId: record.targetProjectId,
    targetRecordId: record.targetRecordId,
    targetRecordType: relationRecordType(record.targetRecordType),
  };
}

function targetFromRecord(record: RelationRecord) {
  return {
    id: record.id,
    revision: record.revision,
    value: {
      relation: record.deletedAt ? null : payloadRelationFromRecord(record),
    },
  } satisfies {
    id: string;
    revision: number;
    value: RelationStoreValue;
  };
}

async function relationTargetAdapterFind(
  executor: MutationDatabaseExecutor,
  accountId: string,
  targetId: string,
  lock: boolean,
  payload?: MutationPayload,
) {
  const query = executor
    .select({ relation: workRelation })
    .from(workRelation)
    .innerJoin(work, eq(workRelation.sourceWorkId, work.id))
    .innerJoin(project, eq(work.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(
        eq(workRelation.id, targetId),
        eq(workRelation.sourceRecordType, "Work"),
        eq(workspace.ownerAccountId, accountId),
      ),
    )
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  const [record] = records;
  if (record) {
    return targetFromRecord(record.relation);
  }

  const parsedPayload = parseMutationPayload(payload);
  if (parsedPayload?.operation === "create") {
    return {
      id: targetId,
      revision: 0,
      value: { relation: null },
    } satisfies {
      id: string;
      revision: number;
      value: RelationStoreValue;
    };
  }
  return null;
}

async function validateStoredRelation(
  executor: MutationDatabaseExecutor,
  accountId: string,
  relation: RelationPayloadRelation,
) {
  const source = await findOwnedWork(
    executor,
    accountId,
    relation.sourceRecordId,
    false,
  );
  const target =
    relation.targetRecordType === "Work"
      ? await findOwnedWork(executor, accountId, relation.targetRecordId, false)
      : null;
  if (
    relation.sourceRecordType !== "Work" ||
    relation.targetRecordType !== "Work" ||
    !source ||
    !target
  ) {
    return false;
  }
  return isAllowedRelationEndpoints(
    relation.kind,
    relation.sourceRecordType,
    relation.targetRecordType,
  );
}

async function hasDuplicateRelation(
  executor: MutationDatabaseExecutor,
  input: RelationEndsInput,
  excludeRelationId?: string,
): Promise<boolean> {
  const sameDirection = and(
    eq(workRelation.sourceWorkId, input.sourceId),
    eq(workRelation.targetRecordId, input.targetId),
  );
  const reverseDirection = and(
    eq(workRelation.sourceWorkId, input.targetId),
    eq(workRelation.targetRecordId, input.sourceId),
  );
  const conditions = [
    eq(workRelation.kind, input.kind),
    eq(workRelation.sourceRecordType, input.sourceType),
    eq(workRelation.targetRecordType, input.targetType),
    isNull(workRelation.deletedAt),
    input.kind === "Related"
      ? or(sameDirection, reverseDirection)
      : sameDirection,
  ];
  if (excludeRelationId) {
    conditions.push(ne(workRelation.id, excludeRelationId));
  }
  const [record] = await executor
    .select({ id: workRelation.id })
    .from(workRelation)
    .where(and(...conditions))
    .limit(1);
  return Boolean(record);
}

async function hasUniquenessConflict(
  executor: MutationDatabaseExecutor,
  input: RelationEndsInput,
  excludeRelationId?: string,
): Promise<boolean> {
  const uniqueness = relationUniqueness(input.kind);
  let endpointCondition: ReturnType<typeof and>;
  switch (uniqueness) {
    case "unique-per-pair":
      endpointCondition = and(
        eq(workRelation.sourceRecordType, input.sourceType),
        eq(workRelation.sourceWorkId, input.sourceId),
        eq(workRelation.targetRecordType, input.targetType),
        eq(workRelation.targetRecordId, input.targetId),
      );
      break;
    case "unique-per-source":
      endpointCondition = and(
        eq(workRelation.sourceRecordType, input.sourceType),
        eq(workRelation.sourceWorkId, input.sourceId),
      );
      break;
    case "unique-per-target":
      endpointCondition = and(
        eq(workRelation.targetRecordType, input.targetType),
        eq(workRelation.targetRecordId, input.targetId),
      );
      break;
    default:
      return false;
  }
  const conditions = [
    eq(workRelation.kind, input.kind),
    isNull(workRelation.deletedAt),
    endpointCondition,
  ];
  if (excludeRelationId) {
    conditions.push(ne(workRelation.id, excludeRelationId));
  }
  const [record] = await executor
    .select({ id: workRelation.id })
    .from(workRelation)
    .where(and(...conditions))
    .limit(1);
  return Boolean(record);
}

const SUPERSEDES_CYCLE_MAX_DEPTH = 64;

/**
 * `Supersedes` is directed-acyclic in the PRD 02 catalog. The walk follows
 * supersede edges from the target end; reaching the source end again means
 * the new edge closes a cycle.
 */
export async function assertAcyclicSupersedes(
  executor: MutationDatabaseExecutor,
  input: RelationEndsInput,
): Promise<void> {
  if (input.kind !== "Supersedes") {
    return;
  }
  if (input.sourceId === input.targetId) {
    throw new RelationCycleError();
  }
  const visited = new Set<string>([input.sourceId]);
  let frontier = [input.targetId];
  for (
    let depth = 0;
    frontier.length > 0 && depth < SUPERSEDES_CYCLE_MAX_DEPTH;
    depth += 1
  ) {
    // biome-ignore lint/performance/noAwaitInLoops: Breadth-first traversal queries each frontier before expanding the next one.
    const rows = await executor
      .select({
        sourceId: workRelation.sourceWorkId,
        targetId: workRelation.targetRecordId,
      })
      .from(workRelation)
      .where(
        and(
          eq(workRelation.kind, "Supersedes"),
          eq(workRelation.sourceRecordType, input.sourceType),
          isNull(workRelation.deletedAt),
          inArray(workRelation.sourceWorkId, frontier),
        ),
      );
    frontier = [];
    for (const row of rows) {
      if (row.targetId === input.sourceId) {
        throw new RelationCycleError();
      }
      if (!visited.has(row.targetId)) {
        visited.add(row.targetId);
        frontier.push(row.targetId);
      }
    }
  }
}

/**
 * Live-row catalog checks shared by create, resurrect, and undo-restore so
 * every write path enforces the same duplicate, uniqueness, and acyclicity
 * rules. Runs inside the caller's transaction when one is open.
 */
async function assertRelationWritable(
  executor: MutationDatabaseExecutor,
  relation: RelationPayloadRelation,
  excludeRelationId: string,
): Promise<void> {
  const ends: RelationEndsInput = {
    kind: relation.kind,
    sourceId: relation.sourceRecordId,
    sourceType: relation.sourceRecordType,
    targetId: relation.targetRecordId,
    targetType: relation.targetRecordType,
  };
  if (await hasDuplicateRelation(executor, ends, excludeRelationId)) {
    throw new RelationDuplicateError();
  }
  if (await hasUniquenessConflict(executor, ends, excludeRelationId)) {
    throw new RelationDuplicateError();
  }
  await assertAcyclicSupersedes(executor, ends);
}

function blockerResolutionFields(
  relation: RelationPayloadRelation,
  committedAt: Date,
) {
  if (relation.kind !== "Blocks" || relation.blockingStatus !== "Resolved") {
    return {
      blockingResolvedAt: null,
      blockingResolutionNote: null,
    };
  }
  return {
    blockingResolvedAt: relation.blockingResolvedAt
      ? new Date(relation.blockingResolvedAt)
      : committedAt,
    blockingResolutionNote: relation.blockingResolutionNote,
  };
}

function createRelationTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<RelationStoreValue> {
  return {
    find: (executor, targetId, lock, context) =>
      relationTargetAdapterFind(
        executor,
        accountId,
        targetId,
        lock,
        context?.payload,
      ),

    async update(executor, input) {
      const nextRelation = input.nextValue.relation;
      const [current] = await executor
        .select({ relation: workRelation })
        .from(workRelation)
        .where(eq(workRelation.id, input.targetId))
        .limit(1);

      if (!nextRelation) {
        if (!current) {
          return null;
        }
        const [updated] = await executor
          .update(workRelation)
          .set({
            deletedAt: input.committedAt,
            revision: input.expectedRevision + 1,
          })
          .where(
            and(
              eq(workRelation.id, input.targetId),
              eq(workRelation.revision, input.expectedRevision),
            ),
          )
          .returning();
        return updated ? targetFromRecord(updated) : null;
      }

      if (!(await validateStoredRelation(executor, accountId, nextRelation))) {
        return null;
      }
      await assertRelationWritable(executor, nextRelation, input.targetId);

      if (!current) {
        const [inserted] = await executor
          .insert(workRelation)
          .values({
            ...blockerResolutionFields(nextRelation, input.committedAt),
            createdAt: input.committedAt,
            id: nextRelation.id,
            kind: nextRelation.kind,
            blockingStatus: relationBlockingStatus(
              nextRelation.kind,
              nextRelation.blockingStatus,
            ),
            revision: input.expectedRevision + 1,
            sourceRecordType: nextRelation.sourceRecordType,
            sourceWorkId: nextRelation.sourceRecordId,
            targetLabel: nextRelation.targetLabel,
            targetProjectId: nextRelation.targetProjectId,
            targetRecordId: nextRelation.targetRecordId,
            targetRecordType: nextRelation.targetRecordType,
          })
          .onConflictDoNothing()
          .returning();
        return inserted ? targetFromRecord(inserted) : null;
      }

      const [updated] = await executor
        .update(workRelation)
        .set({
          ...blockerResolutionFields(nextRelation, input.committedAt),
          brokenReason: null,
          deletedAt: null,
          kind: nextRelation.kind,
          blockingStatus: relationBlockingStatus(
            nextRelation.kind,
            nextRelation.blockingStatus,
          ),
          revision: input.expectedRevision + 1,
          sourceRecordType: nextRelation.sourceRecordType,
          sourceWorkId: nextRelation.sourceRecordId,
          targetLabel: nextRelation.targetLabel,
          targetProjectId: nextRelation.targetProjectId,
          targetRecordId: nextRelation.targetRecordId,
          targetRecordType: nextRelation.targetRecordType,
        })
        .where(
          and(
            eq(workRelation.id, input.targetId),
            eq(workRelation.revision, input.expectedRevision),
          ),
        )
        .returning();
      return updated ? targetFromRecord(updated) : null;
    },
  };
}

function createRelationMutation(database: Database, accountId: string) {
  return createDatabaseMutationContract<RelationStoreValue>(database, {
    target: createRelationTarget(accountId),
  });
}

function brokenEndpoint(
  endpoint: RelationEndpoint,
  reason: BrokenReferenceReason,
  establishedAt: string,
  projectId: string | null,
): RelationEndpointView {
  const canOpenSourceRecord = reason === "Archived" || reason === "In Trash";
  return {
    ...endpoint,
    broken: { canOpenSourceRecord, establishedAt, reason },
    key: null,
    label: null,
    originPosition: null,
    projectId: canOpenSourceRecord ? projectId : null,
    status: null,
    title: null,
    workType: null,
  };
}

interface ResolvedWorkEndpoint {
  archived: boolean;
  key: string | null;
  originPosition: RelationOriginPosition | null;
  projectId: string | null;
  status: WorkStatus | null;
  title: string | null;
  workType: WorkType | null;
}

/**
 * Endpoint resolvers are registered per record type by the owning feature.
 * Record types without a resolver fail closed: the end is presented as the
 * shared broken-reference tombstone with no title, so an end the store cannot
 * resolve never leaks names and never claims access. Register a resolver here
 * when an owning store for a record type lands.
 */
const ENDPOINT_RESOLVERS: Partial<
  Record<
    RelationRecordType,
    (
      executor: MutationDatabaseExecutor,
      accountId: string,
      recordId: string,
    ) => Promise<ResolvedWorkEndpoint | null>
  >
> = {
  Work: async (executor, accountId, recordId) => {
    const owned = await findOwnedWork(executor, accountId, recordId, false);
    if (!owned) {
      return null;
    }
    const originLocation = owned.record.originLocation
      ? fileAttachmentLocationSchema.safeParse(owned.record.originLocation).data
      : undefined;
    return {
      archived: owned.record.archivedAt !== null,
      key: owned.record.key,
      originPosition:
        owned.record.originOwnerRecordId && owned.record.originComponentId
          ? {
              componentId: owned.record.originComponentId,
              ...(originLocation ? { location: originLocation } : {}),
              ownerRecordId: owned.record.originOwnerRecordId,
              sourceVersion: owned.record.originSourceVersion,
            }
          : null,
      projectId: owned.record.projectId,
      status: owned.record.status as WorkStatus,
      title: owned.record.title,
      workType: owned.record.type as WorkType,
    };
  },
};

function resolvedEndpointView(
  endpoint: RelationEndpoint,
  resolved: ResolvedWorkEndpoint,
  establishedAt: string,
): RelationEndpointView {
  return {
    ...endpoint,
    broken: resolved.archived
      ? {
          canOpenSourceRecord: true,
          establishedAt,
          reason: "Archived",
        }
      : null,
    key: resolved.key,
    label: resolved.key,
    originPosition: resolved.originPosition,
    projectId: resolved.projectId,
    status: resolved.status,
    title: resolved.title,
    workType: resolved.workType,
  };
}

async function endpointView(
  executor: MutationDatabaseExecutor,
  accountId: string,
  endpoint: RelationEndpoint,
  relation: RelationRecord,
  role: "source" | "target",
): Promise<RelationEndpointView> {
  const explicitReason =
    role === "target" && relation.brokenReason
      ? brokenReferenceReasonSchema.safeParse(relation.brokenReason)
      : null;
  if (explicitReason?.success && explicitReason.data !== "Archived") {
    return brokenEndpoint(
      endpoint,
      explicitReason.data,
      relation.createdAt.toISOString(),
      relation.targetProjectId,
    );
  }

  const resolver = ENDPOINT_RESOLVERS[endpoint.recordType];
  if (!resolver) {
    return brokenEndpoint(
      endpoint,
      "No access",
      relation.createdAt.toISOString(),
      null,
    );
  }

  const resolved = await resolver(executor, accountId, endpoint.recordId);
  if (resolved) {
    return resolvedEndpointView(
      endpoint,
      resolved,
      relation.createdAt.toISOString(),
    );
  }

  const ownedTargetProject = await findOwnedProject(
    executor,
    accountId,
    relation.targetProjectId,
  );
  const anyTargetProject = await findAnyProject(
    executor,
    relation.targetProjectId,
  );
  let reason: BrokenReferenceReason = "Permanently deleted";
  if (!ownedTargetProject && anyTargetProject) {
    reason = "No access";
  }
  return brokenEndpoint(
    endpoint,
    reason,
    relation.createdAt.toISOString(),
    relation.targetProjectId,
  );
}

async function usageSurfaceView(
  executor: MutationDatabaseExecutor,
  accountId: string,
  endpoint: RelationEndpoint,
  establishedAt: string,
): Promise<RelationEndpointView> {
  const resolver = ENDPOINT_RESOLVERS[endpoint.recordType];
  if (!resolver) {
    return brokenEndpoint(endpoint, "No access", establishedAt, null);
  }
  const resolved = await resolver(executor, accountId, endpoint.recordId);
  if (!resolved) {
    if (
      endpoint.recordType === "Work" &&
      (await findAnyWork(executor, endpoint.recordId))
    ) {
      return brokenEndpoint(endpoint, "No access", establishedAt, null);
    }
    return brokenEndpoint(endpoint, "Permanently deleted", establishedAt, null);
  }
  return resolvedEndpointView(endpoint, resolved, establishedAt);
}

async function usageView(
  executor: MutationDatabaseExecutor,
  accountId: string,
  record: UsageLinkRecord,
): Promise<RelationUsageView> {
  const surface = await usageSurfaceView(
    executor,
    accountId,
    {
      recordId: record.surfaceRecordId,
      recordType: relationRecordType(record.surfaceRecordType),
    },
    record.createdAt.toISOString(),
  );
  return {
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    kind: relationUsageKind(record.kind),
    source: {
      recordId: record.sourceRecordId,
      recordType: relationRecordType(record.sourceRecordType),
    },
    surface,
  };
}

function blockingStateFromMutationValue(
  value: unknown,
  relationId: string,
): {
  note: string | null;
  resolvedAt: string | null;
  status: BlockingRelationStatus;
} | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { relation } = value as { relation?: unknown };
  if (typeof relation !== "object" || relation === null) {
    return null;
  }
  const snapshot = relation as {
    blockingResolutionNote?: unknown;
    blockingResolvedAt?: unknown;
    blockingStatus?: unknown;
    id?: unknown;
    kind?: unknown;
  };
  if (snapshot.id !== relationId || snapshot.kind !== "Blocks") {
    return null;
  }
  const status = relationBlockingStatus(
    "Blocks",
    typeof snapshot.blockingStatus === "string"
      ? snapshot.blockingStatus
      : null,
  );
  if (!status) {
    return null;
  }
  return {
    note:
      typeof snapshot.blockingResolutionNote === "string"
        ? snapshot.blockingResolutionNote
        : null,
    resolvedAt:
      typeof snapshot.blockingResolvedAt === "string"
        ? snapshot.blockingResolvedAt
        : null,
    status,
  };
}

async function blockerHistory(
  executor: MutationDatabaseExecutor,
  record: RelationRecord,
): Promise<BlockingRelationHistoryEntry[]> {
  const kind = relationKind(record.kind);
  if (kind !== "Blocks") {
    return [];
  }
  const records = await executor
    .select({
      id: mutationHistory.id,
      nextValue: mutationHistory.nextValue,
      occurredAt: mutationHistory.occurredAt,
      previousValue: mutationHistory.previousValue,
      undoOf: mutationHistory.undoOf,
    })
    .from(mutationHistory)
    .where(eq(mutationHistory.targetId, record.id))
    .orderBy(asc(mutationHistory.revision));
  const history: BlockingRelationHistoryEntry[] = [];
  for (const item of records) {
    const previous = blockingStateFromMutationValue(
      item.previousValue,
      record.id,
    );
    const next = blockingStateFromMutationValue(item.nextValue, record.id);
    if (!next || previous?.status === next.status) {
      continue;
    }
    history.push({
      id: item.id,
      isUndo: item.undoOf !== null,
      note: next.status === "Resolved" ? next.note : null,
      occurredAt: item.occurredAt.toISOString(),
      resolutionAt: next.status === "Resolved" ? next.resolvedAt : null,
      status: next.status,
    });
  }

  const currentStatus = relationBlockingStatus(kind, record.blockingStatus);
  if (history.length === 0) {
    history.push({
      id: `${record.id}:created`,
      isUndo: false,
      note: null,
      occurredAt: record.createdAt.toISOString(),
      resolutionAt: null,
      status: "Active",
    });
  } else if (history[0]?.status !== "Active") {
    history.unshift({
      id: `${record.id}:created`,
      isUndo: false,
      note: null,
      occurredAt: record.createdAt.toISOString(),
      resolutionAt: null,
      status: "Active",
    });
  }
  if (history.at(-1)?.status !== currentStatus) {
    history.push({
      id: `${record.id}:${currentStatus}:${record.revision}`,
      isUndo: false,
      note: currentStatus === "Resolved" ? record.blockingResolutionNote : null,
      occurredAt:
        currentStatus === "Resolved" && record.blockingResolvedAt
          ? record.blockingResolvedAt.toISOString()
          : record.createdAt.toISOString(),
      resolutionAt:
        currentStatus === "Resolved" && record.blockingResolvedAt
          ? record.blockingResolvedAt.toISOString()
          : null,
      status: currentStatus as BlockingRelationStatus,
    });
  }
  return history;
}

async function relationView(
  executor: MutationDatabaseExecutor,
  accountId: string,
  record: RelationWithSource,
  direction: "incoming" | "outgoing",
): Promise<RelationView> {
  const stored = storedRelationFromRecord(record.relation);
  const source: RelationEndpoint = {
    recordId: stored.sourceRecordId,
    recordType: stored.sourceRecordType,
  };
  const target: RelationEndpoint = {
    recordId: stored.targetRecordId,
    recordType: stored.targetRecordType,
  };
  const [sourceView, targetView, history] = await Promise.all([
    endpointView(executor, accountId, source, record.relation, "source"),
    endpointView(executor, accountId, target, record.relation, "target"),
    blockerHistory(executor, record.relation),
  ]);
  const { kind } = stored;
  return {
    blockingHistory: history,
    blockingStatus: stored.blockingStatus,
    blockingResolvedAt: stored.blockingResolvedAt,
    blockingResolutionNote: stored.blockingResolutionNote,
    createdAt: stored.createdAt,
    direction,
    id: stored.id,
    inverseLabel: relationDefinition(kind).inverseLabel,
    kind,
    label: relationLabel(kind, direction),
    revision: record.relation.revision,
    source: sourceView,
    target: targetView,
  };
}

function assertCatalogEndpoints(input: RelationCreatePreviewInput) {
  if (
    !isAllowedRelationEndpoints(
      input.kind,
      input.source.recordType,
      input.target.recordType,
    )
  ) {
    throw new RelationEndpointNotAllowedError();
  }
}

async function assertWorkEndpoints(
  executor: MutationDatabaseExecutor,
  accountId: string,
  input: RelationCreatePreviewInput,
) {
  if (
    input.source.recordType !== "Work" ||
    input.target.recordType !== "Work"
  ) {
    throw new RelationRecordUnavailableError();
  }
  const [source, target] = await Promise.all([
    findOwnedWork(executor, accountId, input.source.recordId, false),
    findOwnedWork(executor, accountId, input.target.recordId, false),
  ]);
  if (!(source && target)) {
    throw new RelationRecordUnavailableError();
  }
  return { source, target };
}

function endsFromCreateInput(
  input: RelationCreatePreviewInput,
): RelationEndsInput {
  return {
    kind: input.kind,
    sourceId: input.source.recordId,
    sourceType: input.source.recordType,
    targetId: input.target.recordId,
    targetType: input.target.recordType,
  };
}

async function assertRelationCreatable(
  executor: MutationDatabaseExecutor,
  input: RelationCreatePreviewInput,
): Promise<void> {
  const ends = endsFromCreateInput(input);
  if (await hasDuplicateRelation(executor, ends)) {
    throw new RelationDuplicateError();
  }
  if (await hasUniquenessConflict(executor, ends)) {
    throw new RelationDuplicateError();
  }
  await assertAcyclicSupersedes(executor, ends);
}

const RELATION_PREVIEW_PREFIX = "relation-preview:";

/**
 * Preview ids are deterministic fingerprints of the stable create inputs, the
 * same pattern as Work lifecycle previews. Confirming recomputes the id, so
 * previews survive restarts and multiple server instances without storage.
 */
async function relationPreviewId(
  input: RelationCreatePreviewInput,
): Promise<string> {
  return `${RELATION_PREVIEW_PREFIX}${await fingerprintMutationPayload({
    kind: input.kind,
    source: input.source,
    target: input.target,
  })}`;
}

async function findRelationViewById(
  database: Database,
  accountId: string,
  relationId: string,
): Promise<RelationView | null> {
  const record = await findRelationWithSource(
    database,
    accountId,
    relationId,
    false,
  );
  if (!record || record.relation.deletedAt) {
    return null;
  }
  return relationView(database, accountId, record, "outgoing");
}

async function mutationResult(
  database: Database,
  accountId: string,
  receipt: MutationReceipt<RelationStoreValue>,
): Promise<RelationMutationResult> {
  const relationId = receipt.targetId;
  const previousRelation = receipt.previousValue.relation;
  const nextRelation = receipt.nextValue.relation;
  const emittedSignal =
    nextRelation?.kind === "Blocks" &&
    nextRelation.blockingStatus === "Active" &&
    previousRelation?.blockingStatus !== "Active"
      ? {
          blockedWork: {
            recordId: nextRelation.targetRecordId,
            recordType: "Work" as const,
          },
          eventId: receipt.id,
          kind: "work-blocked" as const,
          occurredAt: receipt.committedAt,
          relationId: nextRelation.id,
          source: {
            recordId: nextRelation.sourceRecordId,
            recordType: nextRelation.sourceRecordType,
          },
        }
      : null;
  return {
    signals: emittedSignal ? [emittedSignal] : [],
    receiptId: receipt.id,
    relation: receipt.nextValue.relation
      ? await findRelationViewById(database, accountId, relationId)
      : null,
    relationId,
  };
}

async function changeBlockerStatus(
  database: Database,
  accountId: string,
  input: ResolveBlockerInput | ReactivateBlockerInput,
  status: "Active" | "Resolved",
  note: string | null,
): Promise<RelationMutationResult> {
  const mutation = createRelationMutation(database, accountId);
  const command: MutationCommand<RelationMutationPayload> = {
    actor: { actorId: accountId, type: "User" },
    baseRevision: input.baseRevision,
    clientIdempotencyKey: input.clientIdempotencyKey,
    kind: "human",
    payload: {
      blockingStatus: status,
      note,
      operation: "blocking-status",
      relationId: input.relationId,
    },
    targetId: input.relationId,
  };
  const replay = await mutation.replay(command);
  if (replay) {
    return mutationResult(database, accountId, replay);
  }

  const current = await findRelationWithSource(
    database,
    accountId,
    input.relationId,
    false,
  );
  if (!current || current.relation.deletedAt) {
    throw new RelationNotFoundError();
  }
  const expectedStatus = status === "Resolved" ? "Active" : "Resolved";
  if (
    current.relation.kind !== "Blocks" ||
    relationBlockingStatus(
      current.relation.kind,
      current.relation.blockingStatus,
    ) !== expectedStatus
  ) {
    throw new BlockingRelationStateError();
  }

  const receipt = await mutation.mutate(
    command,
    ({ currentValue: { relation } }) => {
      if (
        relation?.kind !== "Blocks" ||
        relation.blockingStatus !== expectedStatus
      ) {
        throw new BlockingRelationStateError();
      }
      return {
        relation: {
          ...relation,
          blockingResolvedAt: null,
          blockingResolutionNote: status === "Resolved" ? note : null,
          blockingStatus: status,
        },
      };
    },
    { undo: { kind: "relation", scope: "relation" } },
  );
  return mutationResult(database, accountId, receipt);
}

function relationCreatePayload(
  input: RelationCreateInput,
  source: OwnedWork,
  target: OwnedWork,
): RelationMutationPayload {
  return {
    operation: "create",
    relation: {
      blockingStatus: input.kind === "Blocks" ? "Active" : null,
      blockingResolvedAt: null,
      blockingResolutionNote: null,
      id: input.previewId,
      kind: input.kind,
      sourceRecordId: source.record.id,
      sourceRecordType: input.source.recordType,
      targetLabel: target.record.key,
      targetProjectId: target.project.id,
      targetRecordId: target.record.id,
      targetRecordType: input.target.recordType,
    },
  };
}

async function assertUsageEndpointResolvable(
  executor: MutationDatabaseExecutor,
  accountId: string,
  endpoint: RelationEndpoint,
): Promise<OwnedWork> {
  if (endpoint.recordType !== "Work") {
    throw new RelationRecordUnavailableError();
  }
  const owned = await findOwnedWork(
    executor,
    accountId,
    endpoint.recordId,
    false,
  );
  if (!owned) {
    throw new RelationRecordUnavailableError();
  }
  return owned;
}

export function createDatabaseRelations(database: Database): RelationsAccess {
  return {
    async previewCreate(accountId, rawInput) {
      const input = relationCreatePreviewInputSchema.parse(rawInput);
      await assertCatalogEndpoints(input);
      const { source, target } = await assertWorkEndpoints(
        database,
        accountId,
        input,
      );
      if (source.record.id === target.record.id) {
        throw new RelationEndpointNotAllowedError();
      }
      await assertRelationCreatable(database, input);

      const previewId = await relationPreviewId(input);
      const [existing] = await database
        .select({ revision: workRelation.revision })
        .from(workRelation)
        .where(eq(workRelation.id, previewId))
        .limit(1);
      return {
        blockingStatus: input.kind === "Blocks" ? "Active" : null,
        baseRevision: existing?.revision ?? 0,
        id: previewId,
        inverseLabel: relationDefinition(input.kind).inverseLabel,
        kind: input.kind,
        label: relationLabel(input.kind, "outgoing"),
        previewId,
        source: {
          broken: null,
          key: source.record.key,
          label: source.record.key,
          originPosition: null,
          projectId: source.record.projectId,
          recordId: source.record.id,
          recordType: input.source.recordType,
          status: source.record.status as WorkStatus,
          title: source.record.title,
          workType: source.record.type as WorkType,
        },
        target: {
          broken: null,
          key: target.record.key,
          label: target.record.key,
          originPosition: null,
          projectId: target.record.projectId,
          recordId: target.record.id,
          recordType: input.target.recordType,
          status: target.record.status as WorkStatus,
          title: target.record.title,
          workType: target.record.type as WorkType,
        },
      } satisfies RelationPreview;
    },

    async create(accountId, rawInput) {
      const input = relationCreateInputSchema.parse(rawInput);
      await assertCatalogEndpoints(input);
      const { source, target } = await assertWorkEndpoints(
        database,
        accountId,
        input,
      );
      if (source.record.id === target.record.id) {
        throw new RelationEndpointNotAllowedError();
      }
      const expectedPreviewId = await relationPreviewId(input);
      if (input.previewId !== expectedPreviewId) {
        throw new RelationPreviewRequiredError();
      }

      const stablePayload = relationCreatePayload(input, source, target);
      const mutation = createRelationMutation(database, accountId);
      const command: MutationCommand<RelationMutationPayload> = {
        actor: { actorId: accountId, type: "User" },
        baseRevision: input.baseRevision,
        clientIdempotencyKey: input.clientIdempotencyKey,
        kind: "human",
        payload: stablePayload,
        targetId: input.previewId,
      };
      const replay = await mutation.replay(command);
      if (replay) {
        return mutationResult(database, accountId, replay);
      }
      await assertRelationCreatable(database, input);

      const receipt = await mutation.mutate(
        command,
        ({ currentValue, payload: nextPayload }) => {
          if (currentValue.relation) {
            throw new RelationDuplicateError();
          }
          if (nextPayload.operation !== "create") {
            throw new RelationPreviewRequiredError();
          }
          return { relation: nextPayload.relation };
        },
        { undo: { kind: "relation", scope: "relation" } },
      );
      return mutationResult(database, accountId, receipt);
    },

    resolveBlocker(accountId, rawInput) {
      const input = resolveBlockerInputSchema.parse(rawInput);
      return changeBlockerStatus(
        database,
        accountId,
        input,
        "Resolved",
        input.note?.trim() || null,
      );
    },

    reactivateBlocker(accountId, rawInput) {
      const input = reactivateBlockerInputSchema.parse(rawInput);
      return changeBlockerStatus(database, accountId, input, "Active", null);
    },

    async list(accountId, rawInput) {
      const input = relationsInputSchema.parse(rawInput);
      if (input.recordType !== "Work") {
        return [];
      }
      const workspaceId = await findOwnedWorkspaceId(database, accountId);
      if (!workspaceId) {
        return [];
      }
      if (!(await findOwnedWork(database, accountId, input.recordId, false))) {
        return [];
      }
      const records = await database
        .select({
          relation: workRelation,
          sourceProject: project,
          sourceWork: work,
        })
        .from(workRelation)
        .innerJoin(work, eq(workRelation.sourceWorkId, work.id))
        .innerJoin(project, eq(work.projectId, project.id))
        .where(
          and(
            eq(project.workspaceId, workspaceId),
            eq(workRelation.sourceRecordType, "Work"),
            isNull(workRelation.deletedAt),
            or(
              eq(workRelation.sourceWorkId, input.recordId),
              and(
                eq(workRelation.targetRecordType, input.recordType),
                eq(workRelation.targetRecordId, input.recordId),
              ),
            ),
          ),
        )
        .orderBy(asc(workRelation.createdAt), asc(workRelation.id));
      return Promise.all(
        records.map((record) =>
          relationView(
            database,
            accountId,
            record,
            record.relation.sourceWorkId === input.recordId
              ? "outgoing"
              : "incoming",
          ),
        ),
      );
    },

    async listUsageLinks(accountId, rawInput) {
      const input = relationsInputSchema.parse(rawInput);
      if (input.recordType !== "Work") {
        return [];
      }
      const workspaceId = await findOwnedWorkspaceId(database, accountId);
      if (!workspaceId) {
        return [];
      }
      if (!(await findOwnedWork(database, accountId, input.recordId, false))) {
        return [];
      }
      const records = await database
        .select({ link: usageLink })
        .from(usageLink)
        .where(
          and(
            eq(usageLink.workspaceId, workspaceId),
            eq(usageLink.sourceRecordType, input.recordType),
            eq(usageLink.sourceRecordId, input.recordId),
          ),
        )
        .orderBy(asc(usageLink.createdAt), asc(usageLink.id));
      const views = await Promise.all(
        records.map(({ link }) => usageView(database, accountId, link)),
      );
      return views.filter(
        (view) => view.surface.broken?.reason !== "No access",
      );
    },

    async listUsedIn(accountId, rawInput): Promise<UsedInSummary> {
      const input = relationsInputSchema.parse(rawInput);
      const empty: UsedInSummary = {
        relationBacklinks: [],
        usageLinks: [],
      };
      if (input.recordType !== "Work") {
        return empty;
      }
      const workspaceId = await findOwnedWorkspaceId(database, accountId);
      if (
        !(
          workspaceId &&
          (await findOwnedWork(database, accountId, input.recordId, false))
        )
      ) {
        return empty;
      }

      const relationRecords = await database
        .select({
          relation: workRelation,
          sourceProject: project,
          sourceWork: work,
        })
        .from(workRelation)
        .innerJoin(work, eq(workRelation.sourceWorkId, work.id))
        .innerJoin(project, eq(work.projectId, project.id))
        .where(
          and(
            eq(project.workspaceId, workspaceId),
            eq(workRelation.sourceRecordType, "Work"),
            isNull(workRelation.deletedAt),
            eq(workRelation.targetRecordType, input.recordType),
            eq(workRelation.targetRecordId, input.recordId),
          ),
        )
        .orderBy(asc(workRelation.createdAt), asc(workRelation.id));
      const relationBacklinks = await Promise.all(
        relationRecords.map((record) =>
          relationView(database, accountId, record, "incoming"),
        ),
      );

      const usageRecords = await database
        .select({ link: usageLink })
        .from(usageLink)
        .where(
          and(
            eq(usageLink.workspaceId, workspaceId),
            eq(usageLink.sourceRecordType, input.recordType),
            eq(usageLink.sourceRecordId, input.recordId),
          ),
        )
        .orderBy(asc(usageLink.createdAt), asc(usageLink.id));
      const usageViews = await Promise.all(
        usageRecords.map(({ link }) => usageView(database, accountId, link)),
      );

      return {
        relationBacklinks,
        usageLinks: usageViews.filter(
          (view) => view.surface.broken?.reason !== "No access",
        ),
      };
    },

    async createUsageLink(accountId, rawInput) {
      const input = relationUsageCreateInputSchema.parse(rawInput);
      const source = await assertUsageEndpointResolvable(
        database,
        accountId,
        input.source,
      );
      const surface = await assertUsageEndpointResolvable(database, accountId, {
        recordId: input.surface.recordId,
        recordType: input.surface.recordType,
      });
      if (
        input.source.recordType === input.surface.recordType &&
        source.record.id === surface.record.id
      ) {
        throw new RelationEndpointNotAllowedError();
      }

      const workspaceId = await findOwnedWorkspaceId(database, accountId);
      if (!workspaceId) {
        throw new RelationRecordUnavailableError();
      }
      const surfaceContext = input.surface.context ?? null;
      const [duplicate] = await database
        .select({ id: usageLink.id, location: usageLink.location })
        .from(usageLink)
        .where(
          and(
            eq(usageLink.kind, input.kind),
            eq(usageLink.workspaceId, workspaceId),
            eq(usageLink.sourceRecordType, input.source.recordType),
            eq(usageLink.sourceRecordId, source.record.id),
            eq(usageLink.surfaceRecordType, input.surface.recordType),
            eq(usageLink.surfaceRecordId, surface.record.id),
          ),
        )
        .limit(1);
      const duplicateContext =
        duplicate?.location &&
        typeof duplicate.location === "object" &&
        "context" in duplicate.location &&
        typeof duplicate.location.context === "string"
          ? duplicate.location.context
          : null;
      if (duplicate && duplicateContext === surfaceContext) {
        throw new RelationDuplicateError();
      }

      const [inserted] = await database
        .insert(usageLink)
        .values({
          id: crypto.randomUUID(),
          kind: input.kind,
          location:
            surfaceContext === null ? null : { context: surfaceContext },
          revision: 1,
          sourceRecordId: source.record.id,
          sourceRecordType: input.source.recordType,
          surfaceRecordId: surface.record.id,
          surfaceRecordType: input.surface.recordType,
          workspaceId,
        })
        .returning();
      if (!inserted) {
        throw new RelationsError(
          "USAGE_LINK_WRITE_FAILED",
          "The usage link could not be created.",
        );
      }
      return usageView(database, accountId, inserted);
    },

    async removeUsageLink(accountId, rawInput) {
      const input = relationUsageRemoveInputSchema.parse(rawInput);
      const workspaceId = await findOwnedWorkspaceId(database, accountId);
      if (!workspaceId) {
        throw new RelationNotFoundError();
      }
      const [record] = await database
        .select({ link: usageLink })
        .from(usageLink)
        .where(
          and(
            eq(usageLink.id, input.usageLinkId),
            eq(usageLink.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      if (!record) {
        throw new RelationNotFoundError();
      }
      await database
        .delete(usageLink)
        .where(
          and(
            eq(usageLink.id, input.usageLinkId),
            eq(usageLink.workspaceId, workspaceId),
          ),
        );
    },

    async remove(accountId, rawInput) {
      const input: RemoveRelationInput =
        removeRelationInputSchema.parse(rawInput);
      const current = await findRelationWithSource(
        database,
        accountId,
        input.relationId,
        false,
      );
      if (!current || current.relation.deletedAt) {
        throw new RelationNotFoundError();
      }
      const mutation = createRelationMutation(database, accountId);
      const command: MutationCommand<RelationMutationPayload> = {
        actor: { actorId: accountId, type: "User" },
        baseRevision: input.baseRevision,
        clientIdempotencyKey: input.clientIdempotencyKey,
        kind: "human",
        payload: { operation: "remove", relationId: input.relationId },
        targetId: input.relationId,
      };
      const replay = await mutation.replay(command);
      if (replay) {
        return mutationResult(database, accountId, replay);
      }
      const receipt = await mutation.mutate(
        command,
        ({ currentValue }) => {
          if (!currentValue.relation) {
            throw new RelationNotFoundError();
          }
          return { relation: null };
        },
        { undo: { kind: "relation", scope: "relation" } },
      );
      return mutationResult(database, accountId, receipt);
    },

    async undo(accountId, rawInput) {
      const input: UndoRelationInput = undoRelationInputSchema.parse(rawInput);
      const mutation = createRelationMutation(database, accountId);
      if (!(mutation.findReceiptById && mutation.undo)) {
        throw new RelationUndoUnavailableError();
      }
      const sourceReceipt = await mutation.findReceiptById(input.receiptId);
      if (
        !sourceReceipt ||
        sourceReceipt.targetId !== input.relationId ||
        sourceReceipt.undo?.kind !== "relation"
      ) {
        throw new RelationUndoUnavailableError();
      }
      const current = await findRelationWithSource(
        database,
        accountId,
        input.relationId,
        false,
      );
      if (!current) {
        throw new RelationUndoUnavailableError();
      }
      const command: MutationCommand<RelationMutationPayload> = {
        actor: { actorId: accountId, type: "User" },
        baseRevision: input.baseRevision,
        clientIdempotencyKey: input.clientIdempotencyKey,
        kind: "human",
        payload: {
          operation: "undo",
          receiptId: input.receiptId,
          relationId: input.relationId,
        },
        targetId: input.relationId,
      };
      const replay = await mutation.replay(command);
      if (replay) {
        return mutationResult(database, accountId, replay);
      }
      const receipt = await mutation.undo(sourceReceipt, command);
      return mutationResult(database, accountId, receipt);
    },
  } satisfies RelationsAccess;
}

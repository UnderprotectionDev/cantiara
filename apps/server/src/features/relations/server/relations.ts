import type {
  MutationCommand,
  MutationPayload,
  MutationReceipt,
} from "@cantiara/api/mutation-and-undo";
import { fingerprintMutationPayload } from "@cantiara/api/mutation-and-undo";
import {
  type BrokenReferenceReason,
  brokenReferenceReasonSchema,
  isAllowedRelationEndpoints,
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
  type StoredRelationValue,
  type UndoRelationInput,
  undoRelationInputSchema,
} from "@cantiara/api/relations";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  project,
  usageLink,
  work,
  workRelation,
} from "@cantiara/db/schema/index";
import { and, asc, eq, inArray, isNull, ne, or } from "drizzle-orm";

import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";

type WorkRecord = typeof work.$inferSelect;
type ProjectRecord = typeof project.$inferSelect;
type RelationRecord = typeof workRelation.$inferSelect;
type UsageLinkRecord = typeof usageLink.$inferSelect;

/**
 * The value stored by the Mutation Contract for a relation target. It carries
 * no wall-clock fields: deterministic payloads keep retries replayable, and
 * `createdAt` is read from the row when presenting.
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

interface OwnedWork {
  project: ProjectRecord;
  record: WorkRecord;
}

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
  return {
    id: record.id,
    kind: relationKind(record.kind),
    sourceRecordId: record.sourceWorkId,
    sourceRecordType: relationRecordType(record.sourceRecordType),
    targetLabel: record.targetLabel,
    targetProjectId: record.targetProjectId,
    targetRecordId: record.targetRecordId,
    targetRecordType: relationRecordType(record.targetRecordType),
  };
}

function storedRelationFromRecord(record: RelationRecord): StoredRelationValue {
  return {
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    kind: relationKind(record.kind),
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
  if (uniqueness === "many") {
    return false;
  }
  const conditions = [
    eq(workRelation.kind, input.kind),
    isNull(workRelation.deletedAt),
    uniqueness === "unique-per-source"
      ? and(
          eq(workRelation.sourceRecordType, input.sourceType),
          eq(workRelation.sourceWorkId, input.sourceId),
        )
      : and(
          eq(workRelation.targetRecordType, input.targetType),
          eq(workRelation.targetRecordId, input.targetId),
        ),
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
            createdAt: input.committedAt,
            id: nextRelation.id,
            kind: nextRelation.kind,
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
          brokenReason: null,
          deletedAt: null,
          kind: nextRelation.kind,
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
    title: null,
  };
}

interface ResolvedWorkEndpoint {
  archived: boolean;
  key: string | null;
  originPosition: RelationOriginPosition | null;
  projectId: string | null;
  title: string | null;
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
    return {
      archived: owned.record.archivedAt !== null,
      key: owned.record.key,
      originPosition:
        owned.record.originOwnerRecordId && owned.record.originComponentId
          ? {
              componentId: owned.record.originComponentId,
              ownerRecordId: owned.record.originOwnerRecordId,
              sourceVersion: owned.record.originSourceVersion,
            }
          : null,
      projectId: owned.record.projectId,
      title: owned.record.title,
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
    title: resolved.title,
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
    // Usage links only exist inside the founder's workspace, so a surface the
    // resolver cannot find was permanently deleted, not moved out of reach.
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
  const [sourceView, targetView] = await Promise.all([
    endpointView(executor, accountId, source, record.relation, "source"),
    endpointView(executor, accountId, target, record.relation, "target"),
  ]);
  const { kind } = stored;
  return {
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
  return {
    receiptId: receipt.id,
    relation: receipt.nextValue.relation
      ? await findRelationViewById(database, accountId, relationId)
      : null,
    relationId,
  };
}

function relationCreatePayload(
  input: RelationCreateInput,
  source: OwnedWork,
  target: OwnedWork,
): RelationMutationPayload {
  return {
    operation: "create",
    relation: {
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
          title: source.record.title,
        },
        target: {
          broken: null,
          key: target.record.key,
          label: target.record.key,
          originPosition: null,
          projectId: target.record.projectId,
          recordId: target.record.id,
          recordType: input.target.recordType,
          title: target.record.title,
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
      await assertRelationCreatable(database, input);

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

    async list(accountId, rawInput) {
      const input = relationsInputSchema.parse(rawInput);
      if (input.recordType !== "Work") {
        return [];
      }
      const workspaceId = await findOwnedWorkspaceId(database, accountId);
      if (!workspaceId) {
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
      return Promise.all(
        records.map(({ link }) => usageView(database, accountId, link)),
      );
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

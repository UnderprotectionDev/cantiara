import type {
  MutationCommand,
  MutationPayload,
  MutationReceipt,
} from "@cantiara/api/mutation-and-undo";
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
  type RelationMutationValue,
  type RelationPreview,
  type RelationRecordType,
  type RelationsAccess,
  type RelationView,
  type RemoveRelationInput,
  relationCreateInputSchema,
  relationCreatePreviewInputSchema,
  relationDefinition,
  relationKindSchema,
  relationLabel,
  relationRecordTypeSchema,
  relationsInputSchema,
  removeRelationInputSchema,
  type StoredRelationValue,
  type UndoRelationInput,
  undoRelationInputSchema,
} from "@cantiara/api/relations";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { project, work, workRelation } from "@cantiara/db/schema/index";
import { and, asc, eq, isNull, or } from "drizzle-orm";

import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";

type WorkRecord = typeof work.$inferSelect;
type ProjectRecord = typeof project.$inferSelect;
type RelationRecord = typeof workRelation.$inferSelect;

type RelationMutationPayload =
  | {
      operation: "create";
      relation: StoredRelationValue;
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

function targetFromRecord(record: RelationRecord): {
  id: string;
  revision: number;
  value: RelationMutationValue;
} {
  return {
    id: record.id,
    revision: record.revision,
    value: {
      relation: record.deletedAt ? null : storedRelationFromRecord(record),
    },
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
      value: RelationMutationValue;
    };
  }
  return null;
}

async function validateStoredRelation(
  executor: MutationDatabaseExecutor,
  accountId: string,
  relation: StoredRelationValue,
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

function createRelationTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<RelationMutationValue> {
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

      if (!current) {
        const [inserted] = await executor
          .insert(workRelation)
          .values({
            createdAt: new Date(nextRelation.createdAt),
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
  return createDatabaseMutationContract<RelationMutationValue>(database, {
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
    projectId: canOpenSourceRecord ? projectId : null,
    title: null,
  };
}

async function endpointView(
  executor: MutationDatabaseExecutor,
  accountId: string,
  endpoint: RelationEndpoint,
  relation: RelationRecord,
  role: "source" | "target",
): Promise<RelationEndpointView> {
  if (endpoint.recordType !== "Work") {
    return brokenEndpoint(
      endpoint,
      "No access",
      relation.createdAt.toISOString(),
      null,
    );
  }

  const owned = await findOwnedWork(
    executor,
    accountId,
    endpoint.recordId,
    false,
  );
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

  if (owned) {
    const archived = owned.record.archivedAt !== null;
    return {
      ...endpoint,
      broken: archived
        ? {
            canOpenSourceRecord: true,
            establishedAt: relation.createdAt.toISOString(),
            reason: "Archived",
          }
        : null,
      key: owned.record.key,
      label: owned.record.key,
      projectId: owned.record.projectId,
      title: owned.record.title,
    };
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

function relationPreviewMatches(
  preview: RelationCreatePreviewInput,
  input: RelationCreateInput,
): boolean {
  return (
    preview.kind === input.kind &&
    preview.source.recordId === input.source.recordId &&
    preview.source.recordType === input.source.recordType &&
    preview.target.recordId === input.target.recordId &&
    preview.target.recordType === input.target.recordType
  );
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

async function hasDuplicateRelation(
  executor: MutationDatabaseExecutor,
  input: RelationCreatePreviewInput,
): Promise<boolean> {
  const sameDirection = and(
    eq(workRelation.sourceWorkId, input.source.recordId),
    eq(workRelation.targetRecordId, input.target.recordId),
  );
  const reverseDirection = and(
    eq(workRelation.sourceWorkId, input.target.recordId),
    eq(workRelation.targetRecordId, input.source.recordId),
  );
  const [record] = await executor
    .select({ id: workRelation.id })
    .from(workRelation)
    .where(
      and(
        eq(workRelation.kind, input.kind),
        eq(workRelation.sourceRecordType, input.source.recordType),
        eq(workRelation.targetRecordType, input.target.recordType),
        isNull(workRelation.deletedAt),
        input.kind === "Related"
          ? or(sameDirection, reverseDirection)
          : sameDirection,
      ),
    )
    .limit(1);
  return Boolean(record);
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
  receipt: MutationReceipt<RelationMutationValue>,
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
  createdAt: string,
): RelationMutationPayload {
  return {
    operation: "create",
    relation: {
      createdAt,
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

export function createDatabaseRelations(database: Database): RelationsAccess {
  const previews = new Map<
    string,
    { accountId: string; createdAt: string; input: RelationCreatePreviewInput }
  >();

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
      if (await hasDuplicateRelation(database, input)) {
        throw new RelationDuplicateError();
      }

      const previewId = crypto.randomUUID();
      previews.set(previewId, {
        accountId,
        createdAt: new Date().toISOString(),
        input,
      });
      return {
        baseRevision: 0,
        id: previewId,
        inverseLabel: relationDefinition(input.kind).inverseLabel,
        kind: input.kind,
        label: relationLabel(input.kind, "outgoing"),
        previewId,
        source: {
          broken: null,
          key: source.record.key,
          label: source.record.key,
          projectId: source.record.projectId,
          recordId: source.record.id,
          recordType: input.source.recordType,
          title: source.record.title,
        },
        target: {
          broken: null,
          key: target.record.key,
          label: target.record.key,
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
      const preview = previews.get(input.previewId);
      if (
        !preview ||
        preview.accountId !== accountId ||
        !relationPreviewMatches(preview.input, input)
      ) {
        throw new RelationPreviewRequiredError();
      }
      const stablePayload = relationCreatePayload(
        input,
        source,
        target,
        preview.createdAt,
      );
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

      if (await hasDuplicateRelation(database, input)) {
        throw new RelationDuplicateError();
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

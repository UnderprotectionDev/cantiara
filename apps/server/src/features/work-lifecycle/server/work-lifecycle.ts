import {
  canonicalizeMutationPayload,
  fingerprintMutationPayload,
  type MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import {
  closeWorkInputSchema,
  createWorkMutationInputSchema,
  detachFeatureHealthHistoryInputSchema,
  detachIncludedWorkInputSchema,
  type FeatureExitBlockers,
  type FeatureProgress,
  includeWorkInputSchema,
  recordFeatureHealthInputSchema,
  recreateWorkInputSchema,
  reopenWorkInputSchema,
  updateFeaturePrimarySpecInputSchema,
  updateWorkStatusInputSchema,
  updateWorkTypeInputSchema,
  type WorkClosePreview,
  type WorkClosureContextItem,
  type WorkLifecycleAccess,
  type WorkLifecycleMutationContracts,
  type WorkLifecycleMutationValue,
  type WorkProfile,
  type WorkRecreateFieldPreview,
  type WorkRecreatePreview,
  type WorkType,
  type WorkTypeChangePreview,
  type WorkVisibleUserInitiator,
  workArchiveMutationInputSchema,
  workClosePreviewInputSchema,
  workRecreatePreviewInputSchema,
  workTypeChangePreviewInputSchema,
} from "@cantiara/api/work-lifecycle";
import type { WorkRelations } from "../../relations/server/work-relations";

export interface WorkClosureContext {
  activeBlockers: WorkClosureContextItem[];
  incompleteChecklistItems: WorkClosureContextItem[];
  lastingContextSources: WorkClosureContextItem[];
}

export interface WorkClosureContextProvider {
  get: (accountId: string, workId: string) => Promise<WorkClosureContext>;
}

export interface WorkCreationReservation {
  id: string;
  key: string;
  number: number;
  payloadFingerprint: string;
  projectId: string;
  shortCode: string;
  workId: string;
}

export interface WorkCreationRecord {
  payloadFingerprint: string;
  work: WorkProfile;
}

export interface WorkLifecycleStore {
  find: (accountId: string, workId: string) => Promise<WorkProfile | null>;
  findByClientIdempotencyKey: (
    accountId: string,
    projectId: string,
    clientIdempotencyKey: string,
  ) => Promise<WorkCreationRecord | null>;
  findProject: (
    accountId: string,
    projectId: string,
  ) => Promise<{ id: string; name: string } | null>;
  hasProjectDocument?: (
    accountId: string,
    projectId: string,
    documentId: string,
  ) => Promise<boolean>;
  list: (
    accountId: string,
    projectId: string,
    options?: { archived?: boolean },
  ) => Promise<WorkProfile[]>;
  listIncluded: (
    accountId: string,
    featureId: string,
  ) => Promise<WorkProfile[]>;
  reserveCreate: (
    accountId: string,
    projectId: string,
    clientIdempotencyKey: string,
    payloadFingerprint: string,
  ) => Promise<WorkCreationReservation>;
}

export class WorkProjectNotFoundError extends Error {
  readonly code = "WORK_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "WorkProjectNotFoundError";
  }
}

export class WorkCreationConflictError extends Error {
  readonly code = "WORK_CREATION_CONFLICT" as const;

  constructor(cause?: unknown) {
    super(
      "The Work could not be created because its key was already used.",
      cause === undefined ? undefined : { cause },
    );
    this.name = "WorkCreationConflictError";
  }
}

export class WorkNotFoundError extends Error {
  readonly code = "WORK_NOT_FOUND" as const;

  constructor(workId: string) {
    super(`Work ${workId} was not found.`);
    this.name = "WorkNotFoundError";
  }
}

export class WorkInclusionConflictError extends Error {
  readonly code = "WORK_INCLUSION_CONFLICT" as const;

  constructor(message = "Work already has a primary Feature.") {
    super(message);
    this.name = "WorkInclusionConflictError";
  }
}

export class WorkFeatureRequiredError extends Error {
  readonly code = "WORK_FEATURE_REQUIRED" as const;

  constructor(workId: string) {
    super(`Work ${workId} must be a Feature.`);
    this.name = "WorkFeatureRequiredError";
  }
}

export class WorkPrimarySpecNotFoundError extends Error {
  readonly code = "WORK_PRIMARY_SPEC_NOT_FOUND" as const;

  constructor(primarySpecId: string) {
    super(`Primary spec ${primarySpecId} was not found in this Project.`);
    this.name = "WorkPrimarySpecNotFoundError";
  }
}

export class WorkPrimarySpecUnavailableError extends Error {
  readonly code = "WORK_PRIMARY_SPEC_UNAVAILABLE" as const;

  constructor() {
    super("Primary spec is unavailable until Documents can be resolved.");
    this.name = "WorkPrimarySpecUnavailableError";
  }
}

export class WorkFeatureExitBlockedError extends Error {
  readonly blockers: FeatureExitBlockers;
  readonly code = "WORK_FEATURE_EXIT_BLOCKED" as const;

  constructor(blockers: FeatureExitBlockers) {
    super(
      "Detach included Work, Feature health history, and Primary spec before leaving Feature.",
    );
    this.name = "WorkFeatureExitBlockedError";
    this.blockers = blockers;
  }
}

export class WorkTypeImpactPreviewRequiredError extends Error {
  readonly code = "WORK_TYPE_IMPACT_PREVIEW_REQUIRED" as const;
  readonly previewId: string;

  constructor(previewId: string) {
    super(
      "An impact preview is required before crossing the Feature boundary.",
    );
    this.name = "WorkTypeImpactPreviewRequiredError";
    this.previewId = previewId;
  }
}

export class WorkClosureResultRequiredError extends Error {
  readonly code = "WORK_CLOSURE_RESULT_REQUIRED" as const;

  constructor() {
    super("Closed requires an explicit Completed or Abandoned result.");
    this.name = "WorkClosureResultRequiredError";
  }
}

export class WorkClosureCheckRequiredError extends Error {
  readonly code = "WORK_CLOSURE_CHECK_REQUIRED" as const;

  constructor() {
    super("Review the Closure check or return to work.");
    this.name = "WorkClosureCheckRequiredError";
  }
}

export class WorkReopenConfirmationRequiredError extends Error {
  readonly code = "WORK_REOPEN_CONFIRMATION_REQUIRED" as const;

  constructor() {
    super("Closed Work requires an explicit reopen confirmation.");
    this.name = "WorkReopenConfirmationRequiredError";
  }
}

export class WorkAlreadyClosedError extends Error {
  readonly code = "WORK_ALREADY_CLOSED" as const;

  constructor() {
    super("Work is already Closed.");
    this.name = "WorkAlreadyClosedError";
  }
}

export class WorkNotClosedError extends Error {
  readonly code = "WORK_NOT_CLOSED" as const;

  constructor() {
    super("Only Closed Work can be reopened.");
    this.name = "WorkNotClosedError";
  }
}

export class WorkVisibleUserInitiatorRequiredError extends Error {
  readonly code = "WORK_VISIBLE_USER_INITIATOR_REQUIRED" as const;

  constructor() {
    super("This Work lifecycle change requires a visible user action.");
    this.name = "WorkVisibleUserInitiatorRequiredError";
  }
}

export class WorkRecreatePreviewRequiredError extends Error {
  readonly code = "WORK_RECREATE_PREVIEW_REQUIRED" as const;

  constructor() {
    super("A current recreate preview is required before creating the Work.");
    this.name = "WorkRecreatePreviewRequiredError";
  }
}

export class WorkRelationNotPortableError extends Error {
  readonly code = "WORK_RELATION_NOT_PORTABLE" as const;

  constructor(relationId: string) {
    super(`Relation ${relationId} cannot be recreated in another Project.`);
    this.name = "WorkRelationNotPortableError";
  }
}

export class WorkRecreateFieldRequiredError extends Error {
  readonly code = "WORK_RECREATE_FIELD_REQUIRED" as const;

  constructor(field: "title") {
    super(`${field === "title" ? "Title" : field} must be selected.`);
    this.name = "WorkRecreateFieldRequiredError";
  }
}

const WORK_CREATE_TARGET_PREFIX = "work-create:";
const WORK_TYPE_IMPACT_PREVIEW_PREFIX = "work-type-impact:";
const WORK_RECREATE_PREVIEW_PREFIX = "work-recreate:";

export function requiresWorkTypeImpactPreview(
  currentType: WorkType,
  nextType: WorkType,
) {
  return (
    currentType !== nextType &&
    (currentType === "Feature" || nextType === "Feature")
  );
}

export function workTypeChangePreviewId(
  workId: string,
  revision: number,
  currentType: WorkType,
  nextType: WorkType,
  exitBlockers: FeatureExitBlockers | null = null,
) {
  const blockerToken = exitBlockers
    ? `:${exitBlockers.includedWorkCount}:${exitBlockers.featureHealthUpdateCount}:${exitBlockers.hasPrimarySpec ? 1 : 0}`
    : "";
  return `${WORK_TYPE_IMPACT_PREVIEW_PREFIX}${workId}:${revision}:${currentType}:${nextType}${blockerToken}`;
}

async function featureExitBlockers(
  store: WorkLifecycleStore,
  accountId: string,
  work: WorkProfile,
  nextType: WorkType,
) {
  if (work.type !== "Feature" || nextType === "Feature") {
    return null;
  }
  const includedWork = await store.listIncluded(accountId, work.id);

  return {
    featureHealthUpdateCount: work.featureHealthHistory.length,
    hasPrimarySpec: work.primarySpecId !== null,
    includedWorkCount: includedWork.length,
  } satisfies FeatureExitBlockers;
}

function hasFeatureExitBlockers(blockers: FeatureExitBlockers | null) {
  return Boolean(
    blockers &&
      (blockers.includedWorkCount > 0 ||
        blockers.featureHealthUpdateCount > 0 ||
        blockers.hasPrimarySpec),
  );
}

function workCreateTargetId(
  accountId: string,
  projectId: string,
  clientIdempotencyKey: string,
) {
  return `${WORK_CREATE_TARGET_PREFIX}${accountId}:${projectId}:${clientIdempotencyKey}`;
}

function requireVisibleUserInitiator(initiator: WorkVisibleUserInitiator) {
  if (initiator.kind !== "Visible user") {
    throw new WorkVisibleUserInitiatorRequiredError();
  }
}

interface WorkCreationPayload {
  captureProvenance: WorkProfile["captureProvenance"];
  checklist: WorkProfile["checklist"];
  description: string | null;
  projectId: string;
  recreatedFrom: WorkProfile["recreatedFrom"];
  title: string;
  type: WorkType;
}

function replayExistingWork(
  existing: WorkCreationRecord,
  payloadFingerprint: string,
  payload: WorkCreationPayload,
  cause?: unknown,
) {
  const sameWork =
    existing.work.projectId === payload.projectId &&
    existing.work.title === payload.title &&
    existing.work.type === payload.type &&
    canonicalizeMutationPayload({
      captureProvenance: existing.work.captureProvenance,
      checklist: existing.work.checklist,
      description: existing.work.description,
      recreatedFrom: existing.work.recreatedFrom,
    }) ===
      canonicalizeMutationPayload({
        captureProvenance: payload.captureProvenance,
        checklist: payload.checklist,
        description: payload.description,
        recreatedFrom: payload.recreatedFrom,
      });
  if (existing.payloadFingerprint !== payloadFingerprint || !sameWork) {
    throw new WorkCreationConflictError(cause);
  }
  return existing.work;
}

async function buildRecreatePreview(
  relations: WorkRelations,
  store: WorkLifecycleStore,
  accountId: string,
  sourceWorkId: string,
  targetProjectId: string,
): Promise<WorkRecreatePreview | null> {
  const [sourceWork, targetProject, recreateRelations] = await Promise.all([
    store.find(accountId, sourceWorkId),
    store.findProject(accountId, targetProjectId),
    relations.listRecreateRelations(accountId, sourceWorkId),
  ]);
  if (
    !(sourceWork && targetProject) ||
    sourceWork.projectId === targetProject.id
  ) {
    return null;
  }
  const fields: WorkRecreateFieldPreview[] = [
    {
      key: "title",
      label: "Title",
      selectedByDefault: true,
      value: sourceWork.title,
    },
    {
      key: "type",
      label: "Type",
      selectedByDefault: true,
      value: sourceWork.type,
    },
    {
      key: "description",
      label: "Description",
      selectedByDefault: true,
      value: sourceWork.description,
    },
    {
      key: "checklist",
      label: "Checklist",
      selectedByDefault: true,
      value: sourceWork.checklist,
    },
  ];
  const fingerprint = await fingerprintMutationPayload({
    fields: fields.map((field) => ({
      key: field.key,
      label: field.label,
      selectedByDefault: field.selectedByDefault,
      value: field.value,
    })),
    relations: recreateRelations.map((relation) => ({
      id: relation.id,
      kind: relation.kind,
      label: relation.label,
      nonPortableReason: relation.nonPortableReason ?? null,
      portable: relation.portable,
      targetLabel: relation.targetLabel,
      targetRecordId: relation.targetRecordId,
      targetProjectName: relation.targetProjectName,
    })),
    sourceRevision: sourceWork.revision,
    sourceWorkId,
    targetProjectId,
  });
  return {
    fields,
    previewId: `${WORK_RECREATE_PREVIEW_PREFIX}${fingerprint}`,
    relations: recreateRelations,
    sourceWork: {
      id: sourceWork.id,
      key: sourceWork.key,
      revision: sourceWork.revision,
      title: sourceWork.title,
    },
    targetProject,
  };
}

async function createWork(
  mutationContracts: WorkLifecycleMutationContracts,
  store: WorkLifecycleStore,
  accountId: string,
  rawInput: Parameters<WorkLifecycleAccess["create"]>[1],
  recreate?: {
    selectedRelationIds: string[];
    sourceWork: WorkProfile;
    sourceWorkRevision: number;
  },
) {
  const input = createWorkMutationInputSchema.parse(rawInput);
  const selectedRelationIds = recreate
    ? [...new Set(recreate.selectedRelationIds)].sort()
    : [];
  const recreatedFrom = recreate
    ? { id: recreate.sourceWork.id, key: recreate.sourceWork.key }
    : null;
  const createPayload = {
    captureProvenance: input.captureProvenance ?? null,
    checklist: input.checklist ?? [],
    description: input.description ?? null,
    projectId: input.projectId,
    recreatedFrom,
    ...(recreate
      ? {
          recreate: {
            selectedRelationIds,
            sourceWorkId: recreate.sourceWork.id,
            sourceWorkRevision: recreate.sourceWorkRevision,
          },
        }
      : {}),
    title: input.title,
    type: input.type,
  };
  const payloadFingerprint = await fingerprintMutationPayload(createPayload);
  const existing = await store.findByClientIdempotencyKey(
    accountId,
    input.projectId,
    input.clientIdempotencyKey,
  );
  if (existing) {
    return replayExistingWork(existing, payloadFingerprint, createPayload);
  }

  const reservation = await store.reserveCreate(
    accountId,
    input.projectId,
    input.clientIdempotencyKey,
    payloadFingerprint,
  );
  const timestamp = new Date().toISOString();
  const mutation = mutationContracts.create(accountId);

  try {
    const receipt = await mutation.mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: input.baseRevision,
        clientIdempotencyKey: input.clientIdempotencyKey,
        kind: "human",
        payload: createPayload,
        targetId: workCreateTargetId(
          accountId,
          input.projectId,
          input.clientIdempotencyKey,
        ),
      },
      ({ currentRevision, payload: mutationPayload }) => {
        if (mutationPayload.projectId !== input.projectId) {
          throw new WorkCreationConflictError();
        }
        const work: WorkProfile = {
          archivedAt: null,
          captureProvenance: mutationPayload.captureProvenance,
          checklist: mutationPayload.checklist,
          closureReason: null,
          closureResult: null,
          createdAt: timestamp,
          description: mutationPayload.description,
          featureHealthHistory: [],
          id: reservation.workId,
          key: reservation.key,
          number: reservation.number,
          primaryFeatureId: null,
          primarySpecId: null,
          projectId: reservation.projectId,
          recreatedFrom: mutationPayload.recreatedFrom,
          revision: currentRevision + 1,
          status: "Not Started",
          title: mutationPayload.title,
          type: mutationPayload.type,
          updatedAt: timestamp,
        };
        return {
          ...(mutationPayload.recreate
            ? { recreate: mutationPayload.recreate }
            : {}),
          work,
        } satisfies WorkLifecycleMutationValue;
      },
    );
    if (!receipt.nextValue.work) {
      throw new WorkCreationConflictError();
    }
    return receipt.nextValue.work;
  } catch (error) {
    const committed = await store.findByClientIdempotencyKey(
      accountId,
      input.projectId,
      input.clientIdempotencyKey,
    );
    if (committed) {
      return replayExistingWork(
        committed,
        payloadFingerprint,
        createPayload,
        error,
      );
    }
    throw error;
  }
}

export function createWorkLifecycle({
  closureContext,
  mutationContracts,
  relations,
  store,
}: {
  closureContext?: WorkClosureContextProvider;
  mutationContracts: WorkLifecycleMutationContracts;
  relations: WorkRelations;
  store: WorkLifecycleStore;
}): WorkLifecycleAccess {
  function getClosureContext(accountId: string, workId: string) {
    return closureContext
      ? closureContext.get(accountId, workId)
      : {
          activeBlockers: [],
          incompleteChecklistItems: [],
          lastingContextSources: [],
        };
  }

  async function setArchived(
    accountId: string,
    rawInput: Parameters<WorkLifecycleAccess["archive"]>[1],
    archived: boolean,
  ) {
    const input = workArchiveMutationInputSchema.parse(rawInput);
    const currentWork = await store.find(accountId, input.workId);
    if (!currentWork) {
      throw new WorkNotFoundError(input.workId);
    }

    const timestamp = new Date().toISOString();
    const receipt = await mutationContracts.update(accountId).mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: input.baseRevision,
        clientIdempotencyKey: input.clientIdempotencyKey,
        kind: "human",
        payload: { archived, workId: input.workId },
        targetId: input.workId,
      },
      ({ currentRevision, currentValue, payload }) => {
        if (!currentValue.work || currentValue.work.id !== input.workId) {
          throw new WorkNotFoundError(input.workId);
        }
        return {
          work: {
            ...currentValue.work,
            archivedAt: payload.archived ? timestamp : null,
            revision: currentRevision + 1,
            updatedAt: timestamp,
          },
        } satisfies WorkLifecycleMutationValue;
      },
    );
    if (!receipt.nextValue.work) {
      throw new WorkNotFoundError(input.workId);
    }
    return receipt.nextValue.work;
  }

  async function mutateWork<TPayload extends MutationPayload>(
    accountId: string,
    command: {
      baseRevision: number;
      clientIdempotencyKey: string;
      payload: TPayload;
      targetId: string;
    },
    transform: (
      currentWork: WorkProfile,
      payload: TPayload,
      timestamp: string,
    ) => WorkProfile,
    validate?: (
      currentWork: WorkProfile,
      payload: TPayload,
    ) => void | Promise<void>,
  ) {
    const receipt = await mutationContracts.update(accountId).mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: command.baseRevision,
        clientIdempotencyKey: command.clientIdempotencyKey,
        kind: "human",
        payload: command.payload,
        targetId: command.targetId,
      },
      async ({ currentRevision, currentValue, payload }) => {
        if (!currentValue.work || currentValue.work.id !== command.targetId) {
          throw new WorkNotFoundError(command.targetId);
        }
        await validate?.(currentValue.work, payload);
        const timestamp = new Date().toISOString();
        return {
          work: {
            ...transform(currentValue.work, payload, timestamp),
            revision: currentRevision + 1,
            updatedAt: timestamp,
          },
        } satisfies WorkLifecycleMutationValue;
      },
    );
    if (!receipt.nextValue.work) {
      throw new WorkNotFoundError(command.targetId);
    }
    return receipt.nextValue.work;
  }

  return {
    archive(accountId, input) {
      return setArchived(accountId, input, true);
    },

    async close(accountId, rawInput, initiator) {
      requireVisibleUserInitiator(initiator);
      const input = closeWorkInputSchema.parse(rawInput);
      const mutation = mutationContracts.update(accountId);
      const command = {
        actor: { actorId: accountId, type: "User" as const },
        baseRevision: input.baseRevision,
        clientIdempotencyKey: input.clientIdempotencyKey,
        kind: "human" as const,
        payload: {
          closureReason: input.reason ?? null,
          closureResult: input.closureResult,
          status: "Closed" as const,
          workId: input.workId,
        },
        targetId: input.workId,
      };
      const replay = await mutation.replay(command);
      if (replay) {
        if (!replay.nextValue.work) {
          throw new WorkNotFoundError(input.workId);
        }
        return replay.nextValue.work;
      }

      const currentWork = await store.find(accountId, input.workId);
      if (!currentWork) {
        throw new WorkNotFoundError(input.workId);
      }
      if (currentWork.status === "Closed") {
        throw new WorkAlreadyClosedError();
      }

      const context = await getClosureContext(accountId, input.workId);
      const hasClosureCheck =
        context.activeBlockers.length > 0 ||
        context.incompleteChecklistItems.length > 0;
      if (hasClosureCheck && input.closureCheck !== "Close anyway") {
        throw new WorkClosureCheckRequiredError();
      }

      const timestamp = new Date().toISOString();
      const receipt = await mutation.mutate(
        command,
        ({ currentRevision, currentValue, payload }) => {
          if (!currentValue.work || currentValue.work.id !== input.workId) {
            throw new WorkNotFoundError(input.workId);
          }
          return {
            work: {
              ...currentValue.work,
              closureReason: payload.closureReason,
              closureResult: payload.closureResult,
              revision: currentRevision + 1,
              status: "Closed",
              updatedAt: timestamp,
            },
          } satisfies WorkLifecycleMutationValue;
        },
      );
      if (!receipt.nextValue.work) {
        throw new WorkNotFoundError(input.workId);
      }
      return receipt.nextValue.work;
    },

    create(accountId, rawInput) {
      return createWork(mutationContracts, store, accountId, rawInput);
    },

    find(accountId, workId) {
      return store.find(accountId, workId);
    },

    async featureProgress(accountId, featureId) {
      const feature = await store.find(accountId, featureId);
      if (feature?.type !== "Feature") {
        throw new WorkNotFoundError(featureId);
      }
      const includedWork = await store.listIncluded(accountId, featureId);
      const statusCounts: FeatureProgress["statusCounts"] = {
        Blocked: 0,
        Closed: 0,
        "In Progress": 0,
        "Not Started": 0,
      };
      for (const item of includedWork) {
        statusCounts[item.status] += 1;
      }
      return {
        includedWorkCount: includedWork.length,
        statusCounts,
      };
    },

    detachIncludedWork(accountId, rawInput) {
      const input = detachIncludedWorkInputSchema.parse(rawInput);
      return mutateWork(
        accountId,
        {
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          payload: { featureId: input.featureId, workId: input.workId },
          targetId: input.workId,
        },
        (work, payload) => {
          if (work.primaryFeatureId !== payload.featureId) {
            throw new WorkInclusionConflictError(
              "Work is not included in this Feature.",
            );
          }
          return { ...work, primaryFeatureId: null };
        },
      );
    },

    detachFeatureHealthHistory(accountId, rawInput) {
      const input = detachFeatureHealthHistoryInputSchema.parse(rawInput);
      return mutateWork(
        accountId,
        {
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          payload: { featureId: input.featureId },
          targetId: input.featureId,
        },
        (work, payload) => {
          if (work.type !== "Feature") {
            throw new WorkFeatureRequiredError(payload.featureId);
          }
          return { ...work, featureHealthHistory: [] };
        },
      );
    },

    includeWork(accountId, rawInput) {
      const input = includeWorkInputSchema.parse(rawInput);

      return mutateWork(
        accountId,
        {
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          payload: { featureId: input.featureId, workId: input.workId },
          targetId: input.workId,
        },
        (work, payload) => {
          if (
            work.primaryFeatureId &&
            work.primaryFeatureId !== payload.featureId
          ) {
            throw new WorkInclusionConflictError();
          }
          return { ...work, primaryFeatureId: payload.featureId };
        },
        async (work, payload) => {
          const feature = await store.find(accountId, payload.featureId);
          if (!feature) {
            throw new WorkNotFoundError(payload.featureId);
          }
          if (feature.type !== "Feature") {
            throw new WorkInclusionConflictError(
              "Only a Feature can include Work.",
            );
          }
          if (feature.projectId !== work.projectId) {
            throw new WorkInclusionConflictError(
              "A Feature can include Work only from the same Project.",
            );
          }
          if (work.type === "Feature") {
            throw new WorkInclusionConflictError(
              "A Feature cannot be included by another Feature.",
            );
          }
          if (work.primaryFeatureId && work.primaryFeatureId !== feature.id) {
            throw new WorkInclusionConflictError();
          }
        },
      );
    },

    list(accountId, projectId, options) {
      return store.list(accountId, projectId, options);
    },

    previewRecreate(accountId, rawInput) {
      const input = workRecreatePreviewInputSchema.parse(rawInput);
      return buildRecreatePreview(
        relations,
        store,
        accountId,
        input.sourceWorkId,
        input.targetProjectId,
      );
    },

    async recreate(accountId, rawInput) {
      const input = recreateWorkInputSchema.parse(rawInput);
      const preview = await buildRecreatePreview(
        relations,
        store,
        accountId,
        input.sourceWorkId,
        input.targetProjectId,
      );
      if (!preview || preview.previewId !== input.previewId) {
        throw new WorkRecreatePreviewRequiredError();
      }
      if (!input.selectedFields.includes("title")) {
        throw new WorkRecreateFieldRequiredError("title");
      }
      const relationsById = new Map(
        preview.relations.map((relation) => [relation.id, relation]),
      );
      for (const relationId of new Set(input.selectedRelationIds)) {
        const relation = relationsById.get(relationId);
        if (!relation?.portable) {
          throw new WorkRelationNotPortableError(relationId);
        }
      }

      const sourceWork = await store.find(accountId, input.sourceWorkId);
      if (!sourceWork) {
        throw new WorkNotFoundError(input.sourceWorkId);
      }
      if (sourceWork.revision !== preview.sourceWork.revision) {
        throw new WorkRecreatePreviewRequiredError();
      }
      const selectedFields = new Set(input.selectedFields);
      return createWork(
        mutationContracts,
        store,
        accountId,
        {
          baseRevision: input.baseRevision,
          checklist: selectedFields.has("checklist")
            ? sourceWork.checklist
            : [],
          clientIdempotencyKey: input.clientIdempotencyKey,
          description: selectedFields.has("description")
            ? sourceWork.description
            : null,
          projectId: input.targetProjectId,
          title: sourceWork.title,
          type: selectedFields.has("type") ? sourceWork.type : "Task",
        },
        {
          selectedRelationIds: [...new Set(input.selectedRelationIds)],
          sourceWork,
          sourceWorkRevision: preview.sourceWork.revision,
        },
      );
    },

    async previewClose(accountId, rawInput) {
      const input = workClosePreviewInputSchema.parse(rawInput);
      const currentWork = await store.find(accountId, input.workId);
      if (!currentWork) {
        return null;
      }
      const context = await getClosureContext(accountId, input.workId);
      return {
        closureCheck: {
          activeBlockers: context.activeBlockers,
          incompleteChecklistItems: context.incompleteChecklistItems,
        },
        lastingContext:
          context.lastingContextSources.length > 0
            ? {
                commands: [
                  { generatedText: null, target: "Decision" },
                  { generatedText: null, target: "Personal Wiki" },
                ],
                sources: context.lastingContextSources,
              }
            : null,
        workId: currentWork.id,
      } satisfies WorkClosePreview;
    },

    recordFeatureHealth(accountId, rawInput) {
      const input = recordFeatureHealthInputSchema.parse(rawInput);

      return mutateWork(
        accountId,
        {
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          payload: {
            featureId: input.featureId,
            health: input.health,
            reason: input.reason,
          },
          targetId: input.featureId,
        },
        (work, payload, timestamp) => {
          if (work.type !== "Feature") {
            throw new WorkFeatureRequiredError(input.featureId);
          }
          return {
            ...work,
            featureHealthHistory: [
              ...work.featureHealthHistory,
              {
                health: payload.health,
                id: crypto.randomUUID(),
                reason: payload.reason,
                recordedAt: timestamp,
                recordedByAccountId: accountId,
              },
            ],
          };
        },
      );
    },

    async previewTypeChange(accountId, rawInput) {
      const input = workTypeChangePreviewInputSchema.parse(rawInput);
      const work = await store.find(accountId, input.workId);
      if (!work) {
        return null;
      }

      const blockers = await featureExitBlockers(
        store,
        accountId,
        work,
        input.type,
      );

      return {
        currentType: work.type,
        featureExitBlockers: blockers,
        nextType: input.type,
        previewId: workTypeChangePreviewId(
          work.id,
          work.revision,
          work.type,
          input.type,
          blockers,
        ),
        requiresImpactPreview: requiresWorkTypeImpactPreview(
          work.type,
          input.type,
        ),
        workId: work.id,
      } satisfies WorkTypeChangePreview;
    },

    async updateType(accountId, rawInput) {
      const input = updateWorkTypeInputSchema.parse(rawInput);
      const currentWork = await store.find(accountId, input.workId);
      if (!currentWork) {
        throw new WorkNotFoundError(input.workId);
      }

      if (currentWork.type === input.type) {
        return currentWork;
      }

      if (requiresWorkTypeImpactPreview(currentWork.type, input.type)) {
        const blockers = await featureExitBlockers(
          store,
          accountId,
          currentWork,
          input.type,
        );
        const previewId = workTypeChangePreviewId(
          currentWork.id,
          currentWork.revision,
          currentWork.type,
          input.type,
          blockers,
        );
        if (input.impactPreviewId !== previewId) {
          throw new WorkTypeImpactPreviewRequiredError(previewId);
        }
        if (blockers && hasFeatureExitBlockers(blockers)) {
          throw new WorkFeatureExitBlockedError(blockers);
        }
      }
      if (input.type === "Feature" && currentWork.primaryFeatureId) {
        throw new WorkInclusionConflictError(
          "Detach Work from its primary Feature before changing it to Feature.",
        );
      }

      return mutateWork(
        accountId,
        {
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          payload: {
            primaryFeatureId: currentWork.primaryFeatureId,
            type: input.type,
            workId: input.workId,
          },
          targetId: input.workId,
        },
        (work, payload) => ({ ...work, type: payload.type }),
      );
    },

    updateFeaturePrimarySpec(accountId, rawInput) {
      const input = updateFeaturePrimarySpecInputSchema.parse(rawInput);
      return mutateWork(
        accountId,
        {
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          payload: {
            featureId: input.featureId,
            primarySpecId: input.primarySpecId,
          },
          targetId: input.featureId,
        },
        (work, payload) => {
          if (work.type !== "Feature") {
            throw new WorkFeatureRequiredError(payload.featureId);
          }
          return { ...work, primarySpecId: payload.primarySpecId };
        },
        async (work, payload) => {
          if (payload.primarySpecId === null) {
            return;
          }
          if (!store.hasProjectDocument) {
            throw new WorkPrimarySpecUnavailableError();
          }
          const isAvailable = await store.hasProjectDocument(
            accountId,
            work.projectId,
            payload.primarySpecId,
          );
          if (!isAvailable) {
            throw new WorkPrimarySpecNotFoundError(payload.primarySpecId);
          }
        },
      );
    },

    async reopen(accountId, rawInput, initiator) {
      requireVisibleUserInitiator(initiator);
      const input = reopenWorkInputSchema.parse(rawInput);
      const mutation = mutationContracts.update(accountId);
      const command = {
        actor: { actorId: accountId, type: "User" as const },
        baseRevision: input.baseRevision,
        clientIdempotencyKey: input.clientIdempotencyKey,
        kind: "human" as const,
        payload: {
          closureReason: null,
          closureResult: null,
          status: input.status,
          workId: input.workId,
        },
        targetId: input.workId,
      };
      const replay = await mutation.replay(command);
      if (replay) {
        if (!replay.nextValue.work) {
          throw new WorkNotFoundError(input.workId);
        }
        return replay.nextValue.work;
      }

      const currentWork = await store.find(accountId, input.workId);
      if (!currentWork) {
        throw new WorkNotFoundError(input.workId);
      }
      if (currentWork.status !== "Closed") {
        throw new WorkNotClosedError();
      }

      const timestamp = new Date().toISOString();
      const receipt = await mutation.mutate(
        command,
        ({ currentRevision, currentValue, payload }) => {
          if (!currentValue.work || currentValue.work.id !== input.workId) {
            throw new WorkNotFoundError(input.workId);
          }
          return {
            work: {
              ...currentValue.work,
              closureReason: null,
              closureResult: null,
              revision: currentRevision + 1,
              status: payload.status,
              updatedAt: timestamp,
            },
          } satisfies WorkLifecycleMutationValue;
        },
      );
      if (!receipt.nextValue.work) {
        throw new WorkNotFoundError(input.workId);
      }
      return receipt.nextValue.work;
    },

    async updateStatus(accountId, rawInput, initiator) {
      requireVisibleUserInitiator(initiator);
      const input = updateWorkStatusInputSchema.parse(rawInput);
      if (input.status === "Closed") {
        throw new WorkClosureResultRequiredError();
      }
      const currentWork = await store.find(accountId, input.workId);
      if (!currentWork) {
        throw new WorkNotFoundError(input.workId);
      }
      if (currentWork.status === "Closed") {
        throw new WorkReopenConfirmationRequiredError();
      }
      if (currentWork.status === input.status) {
        return currentWork;
      }

      const timestamp = new Date().toISOString();
      const receipt = await mutationContracts.update(accountId).mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          kind: "human",
          payload: {
            closureReason: null,
            closureResult: null,
            status: input.status,
            workId: input.workId,
          },
          targetId: input.workId,
        },
        ({ currentRevision, currentValue, payload }) => {
          if (!currentValue.work || currentValue.work.id !== input.workId) {
            throw new WorkNotFoundError(input.workId);
          }
          return {
            work: {
              ...currentValue.work,
              closureReason: null,
              closureResult: null,
              revision: currentRevision + 1,
              status: payload.status,
              updatedAt: timestamp,
            },
          } satisfies WorkLifecycleMutationValue;
        },
      );
      if (!receipt.nextValue.work) {
        throw new WorkNotFoundError(input.workId);
      }
      return receipt.nextValue.work;
    },

    unarchive(accountId, input) {
      return setArchived(accountId, input, false);
    },
  };
}

export { WORK_CREATE_TARGET_PREFIX, workCreateTargetId };

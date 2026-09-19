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
  mergeWorkInputSchema,
  recordFeatureHealthInputSchema,
  recreateWorkInputSchema,
  reopenWorkInputSchema,
  type ScopeTree,
  type ScopeTreeNode,
  type ScopeTreeReference,
  type ScopeTreeWork,
  undoWorkMergeInputSchema,
  updateFeaturePrimarySpecInputSchema,
  updateWorkStatusInputSchema,
  updateWorkTypeInputSchema,
  type WorkClosePreview,
  type WorkClosureContextItem,
  type WorkIdentityInput,
  type WorkIdentityResolution,
  type WorkLifecycleAccess,
  type WorkLifecycleMutationContracts,
  type WorkLifecycleMutationValue,
  type WorkMergeField,
  type WorkMergeInclusionSnapshot,
  type WorkMergePreview,
  type WorkMergeRelationPreview,
  type WorkMergeRelationSnapshot,
  type WorkMergeResult,
  type WorkProfile,
  type WorkRecreateFieldPreview,
  type WorkRecreatePreview,
  type WorkRetiredIdentity,
  type WorkType,
  type WorkTypeChangePreview,
  type WorkVisibleUserInitiator,
  workArchiveMutationInputSchema,
  workClosePreviewInputSchema,
  workIdentityInputSchema,
  workMergePreviewInputSchema,
  workRecreatePreviewInputSchema,
  workTypeChangePreviewInputSchema,
} from "@cantiara/api/work-lifecycle";
import type {
  ScopeTreeRelation,
  WorkRelations,
} from "../../relations/server/work-relations";

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
  findByKey?: (
    accountId: string,
    projectId: string,
    key: string,
  ) => Promise<WorkProfile | null>;
  findProject: (
    accountId: string,
    projectId: string,
  ) => Promise<{ id: string; name: string } | null>;
  findRetiredIdentity?: (
    accountId: string,
    input: WorkIdentityInput,
  ) => Promise<WorkRetiredIdentity | null>;
  hasProjectDocument?: (
    accountId: string,
    projectId: string,
    documentId: string,
  ) => Promise<boolean>;
  list: (
    accountId: string,
    projectId: string,
    options?: { archived?: boolean | "all" },
  ) => Promise<WorkProfile[]>;
  listIncluded: (
    accountId: string,
    featureId: string,
  ) => Promise<WorkProfile[]>;
  listRetiredIdentityIdsBySurvivor?: (
    accountId: string,
    survivingWorkId: string,
  ) => Promise<string[]>;
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

export class WorkMergePreviewRequiredError extends Error {
  readonly code = "WORK_MERGE_PREVIEW_REQUIRED" as const;

  constructor() {
    super("A current Merge Preview is required before confirming.");
    this.name = "WorkMergePreviewRequiredError";
  }
}

export class WorkMergeConflictError extends Error {
  readonly code = "WORK_MERGE_CONFLICT" as const;

  constructor(message = "The selected Work merge is no longer available.") {
    super(message);
    this.name = "WorkMergeConflictError";
  }
}

function workMergeResultFromReceipt(receipt: {
  committedAt: string;
  id: string;
  nextValue: WorkLifecycleMutationValue;
}): WorkMergeResult {
  const { merge, work: mergedWork } = receipt.nextValue;
  if (!(mergedWork && merge && merge.operation === "merge")) {
    throw new WorkMergeConflictError();
  }
  const { duplicateWork } = merge;
  return {
    mergeId: receipt.id,
    receiptId: receipt.id,
    retiredIdentity: {
      id: duplicateWork.id,
      key: duplicateWork.key,
      kind: "Retired identity",
      origin: { id: duplicateWork.id, key: duplicateWork.key },
      projectId: duplicateWork.projectId,
      retiredAt: receipt.committedAt,
      survivingWork: {
        id: mergedWork.id,
        key: mergedWork.key,
        title: mergedWork.title,
      },
    },
    work: mergedWork,
  };
}

export class WorkMergeResolutionRequiredError extends Error {
  readonly code = "WORK_MERGE_RESOLUTION_REQUIRED" as const;
  readonly fields: WorkMergeField[];

  constructor(fields: WorkMergeField[]) {
    super("Resolve every Field conflict before confirming the merge.");
    this.name = "WorkMergeResolutionRequiredError";
    this.fields = fields;
  }
}

export class WorkMergeUnsupportedError extends Error {
  readonly code = "WORK_MERGE_UNSUPPORTED" as const;

  constructor(message: string) {
    super(message);
    this.name = "WorkMergeUnsupportedError";
  }
}

export class WorkMergeUndoUnavailableError extends Error {
  readonly code = "WORK_MERGE_UNDO_UNAVAILABLE" as const;

  constructor() {
    super("This Work merge is no longer available for Undo.");
    this.name = "WorkMergeUndoUnavailableError";
  }
}

const WORK_CREATE_TARGET_PREFIX = "work-create:";
const WORK_MERGE_TARGET_PREFIX = "work-merge:";
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

const WORK_MERGE_FIELD_LABELS: Record<
  WorkMergeField,
  WorkMergePreview["fields"][number]["label"]
> = {
  archivedAt: "Archive",
  captureProvenance: "Capture provenance",
  checklist: "Checklist",
  closureReason: "Closure reason",
  closureResult: "Closure result",
  description: "Description",
  featureHealthHistory: "Feature health",
  primaryFeatureId: "Included in",
  primarySpecId: "Primary spec",
  status: "Status",
  title: "Title",
  type: "Type",
};

function workMergeFieldValue(work: WorkProfile, field: WorkMergeField) {
  return work[field];
}

function mergeValuesEqual(left: unknown, right: unknown) {
  return (
    canonicalizeMutationPayload(left as MutationPayload) ===
    canonicalizeMutationPayload(right as MutationPayload)
  );
}

function workMergeFieldPreviews(
  survivingWork: WorkProfile,
  duplicateWork: WorkProfile,
) {
  return (Object.keys(WORK_MERGE_FIELD_LABELS) as WorkMergeField[]).map(
    (key) => {
      const survivingValue = workMergeFieldValue(survivingWork, key);
      const duplicateValue = workMergeFieldValue(duplicateWork, key);
      return {
        conflict: !mergeValuesEqual(survivingValue, duplicateValue),
        duplicateValue,
        key,
        label: WORK_MERGE_FIELD_LABELS[key],
        survivingValue,
      };
    },
  );
}

function workMergeRelationPreviews(
  duplicateWorkId: string,
  relations: WorkMergeRelationSnapshot[],
) {
  return relations
    .filter(
      (relation) =>
        relation.sourceWorkId === duplicateWorkId ||
        relation.targetRecordId === duplicateWorkId,
    )
    .map((relation) => {
      const rewritesSource = relation.sourceWorkId === duplicateWorkId;
      const rewritesTarget = relation.targetRecordId === duplicateWorkId;
      let action: WorkMergeRelationPreview["action"];
      if (rewritesSource && rewritesTarget) {
        action = "Remove self relation";
      } else if (rewritesSource) {
        action = "Rewrite source";
      } else {
        action = "Rewrite target";
      }
      return {
        ...relation,
        action,
      } satisfies WorkMergeRelationPreview;
    });
}

function workMergeInclusionPreviews(inclusions: WorkMergeInclusionSnapshot[]) {
  return inclusions.map((inclusion) => ({
    ...inclusion,
    action: "Rewrite Included in" as const,
  }));
}

function workMergeRelationSnapshots(
  survivingWorkId: string,
  duplicateWorkId: string,
  relations: WorkMergeRelationSnapshot[],
) {
  return relations
    .filter(
      (relation) =>
        relation.sourceWorkId === duplicateWorkId ||
        relation.targetRecordId === duplicateWorkId,
    )
    .map((relation) => {
      const mergedSourceWorkId =
        relation.sourceWorkId === duplicateWorkId
          ? survivingWorkId
          : relation.sourceWorkId;
      const mergedTargetRecordId =
        relation.targetRecordId === duplicateWorkId
          ? survivingWorkId
          : relation.targetRecordId;
      return {
        ...relation,
        ...(mergedSourceWorkId === survivingWorkId &&
        mergedTargetRecordId === survivingWorkId
          ? { removedByMerge: true }
          : {}),
      };
    });
}

async function buildMergePreview(
  relations: WorkRelations,
  store: WorkLifecycleStore,
  accountId: string,
  survivingWorkId: string,
  duplicateWorkId: string,
): Promise<WorkMergePreview | null> {
  if (survivingWorkId === duplicateWorkId) {
    return null;
  }
  const [survivingWork, duplicateWork] = await Promise.all([
    store.find(accountId, survivingWorkId),
    store.find(accountId, duplicateWorkId),
  ]);
  if (
    !(survivingWork && duplicateWork) ||
    survivingWork.projectId !== duplicateWork.projectId
  ) {
    return null;
  }

  const [mergeRelations, inclusions] = await Promise.all([
    relations.listMergeRelations
      ? relations.listMergeRelations(
          accountId,
          survivingWork.id,
          duplicateWork.id,
        )
      : [],
    relations.listMergeInclusions
      ? relations.listMergeInclusions(
          accountId,
          survivingWork.id,
          duplicateWork.id,
        )
      : [],
  ]);
  const fields = workMergeFieldPreviews(survivingWork, duplicateWork);
  const previewId = `${WORK_MERGE_TARGET_PREFIX}${await fingerprintMutationPayload(
    {
      duplicateWork,
      fields,
      inclusions,
      relations: mergeRelations,
      survivingWork,
    } as unknown as MutationPayload,
  )}`;
  return {
    duplicateWork: {
      id: duplicateWork.id,
      key: duplicateWork.key,
      revision: duplicateWork.revision,
      title: duplicateWork.title,
    },
    fields,
    inclusions: workMergeInclusionPreviews(inclusions),
    previewId,
    relations: workMergeRelationPreviews(duplicateWork.id, mergeRelations),
    survivingWork: {
      id: survivingWork.id,
      key: survivingWork.key,
      revision: survivingWork.revision,
      title: survivingWork.title,
    },
  };
}

function buildMergedWork(
  survivingWork: WorkProfile,
  duplicateWork: WorkProfile,
  inclusions: WorkMergeInclusionSnapshot[],
  fieldResolutions: Partial<Record<WorkMergeField, "surviving" | "duplicate">>,
) {
  const fields = workMergeFieldPreviews(survivingWork, duplicateWork);
  const missingFields = fields
    .filter((field) => field.conflict && !fieldResolutions[field.key])
    .map((field) => field.key);
  if (missingFields.length > 0) {
    throw new WorkMergeResolutionRequiredError(missingFields);
  }

  const mergedWork = { ...survivingWork };
  const attributedValueKeys: WorkMergeField[] = [];
  for (const field of fields) {
    const resolution = fieldResolutions[field.key] ?? "surviving";
    const nextValue =
      resolution === "duplicate" ? field.duplicateValue : field.survivingValue;
    if (!mergeValuesEqual(field.survivingValue, nextValue)) {
      (mergedWork as Record<string, unknown>)[field.key] = nextValue;
      attributedValueKeys.push(field.key);
    }
  }

  if (mergedWork.status === "Closed" && mergedWork.closureResult === null) {
    throw new WorkMergeUnsupportedError(
      "Closed requires an explicit Completed or Abandoned result.",
    );
  }
  if (
    mergedWork.status !== "Closed" &&
    (mergedWork.closureResult !== null || mergedWork.closureReason !== null)
  ) {
    throw new WorkMergeUnsupportedError(
      "Open Work cannot retain a closure result or reason.",
    );
  }
  if (mergedWork.type === "Feature" && mergedWork.primaryFeatureId !== null) {
    throw new WorkMergeUnsupportedError(
      "Feature Work cannot be included in another Feature.",
    );
  }
  if (
    mergedWork.type !== "Feature" &&
    (mergedWork.featureHealthHistory.length > 0 ||
      mergedWork.primarySpecId !== null ||
      inclusions.length > 0)
  ) {
    throw new WorkMergeUnsupportedError(
      "Detach Feature health, Primary spec, and included Work before merging out of Feature.",
    );
  }

  return { attributedValueKeys, mergedWork };
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

function featureProgressFromIncludedWork(
  includedWork: readonly WorkProfile[],
): FeatureProgress {
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
}

function scopeTreeWork(work: WorkProfile): ScopeTreeWork {
  return {
    id: work.id,
    key: work.key,
    status: work.status,
    title: work.title,
    type: work.type,
  };
}

function uniqueScopeTreeReferences(references: readonly ScopeTreeReference[]) {
  const seen = new Set<string>();
  return references.filter((reference) => {
    if (seen.has(reference.id)) {
      return false;
    }
    seen.add(reference.id);
    return true;
  });
}

function scopeTreeNode(
  work: WorkProfile,
  relations: readonly ScopeTreeRelation[],
): ScopeTreeNode {
  const blockers = uniqueScopeTreeReferences(
    relations
      .filter(
        (relation) =>
          relation.kind === "Blocks" && relation.targetRecordId === work.id,
      )
      .map((relation) => ({
        id: relation.sourceWork.id,
        key: relation.sourceWork.key,
        label: relation.sourceWork.title,
        projectId: relation.sourceProjectId,
      })),
  );
  const milestones = uniqueScopeTreeReferences(
    relations
      .filter(
        (relation) =>
          relation.kind === "Contributes to Milestone" &&
          relation.sourceWork.id === work.id,
      )
      .map((relation) => ({
        id: relation.targetRecordId,
        key: null,
        label: relation.targetLabel,
      })),
  );
  return {
    blockers,
    milestones,
    work: scopeTreeWork(work),
  };
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
      return featureProgressFromIncludedWork(includedWork);
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

    async scopeTree(accountId, projectId): Promise<ScopeTree> {
      const [project, works, scopeTreeRelations] = await Promise.all([
        store.findProject(accountId, projectId),
        store.list(accountId, projectId, { archived: "all" }),
        relations.listScopeTreeRelations(accountId, projectId),
      ]);
      if (!project) {
        throw new WorkProjectNotFoundError(projectId);
      }

      const features = works.filter((work) => work.type === "Feature");
      return {
        features: features.map((feature) => {
          const includedWork = works.filter(
            (work) =>
              work.primaryFeatureId === feature.id && work.type !== "Feature",
          );
          return {
            ...scopeTreeNode(feature, scopeTreeRelations),
            includedWork: includedWork.map((work) =>
              scopeTreeNode(work, scopeTreeRelations),
            ),
            progress: featureProgressFromIncludedWork(includedWork),
          };
        }),
        project,
      };
    },

    async merge(accountId, rawInput) {
      const input = mergeWorkInputSchema.parse(rawInput);
      const mutation = mutationContracts.update(accountId);
      const mergeMutationId = `work-merge-id:${(
        await fingerprintMutationPayload({
          duplicateWorkId: input.duplicateWorkId,
          fieldResolutions: input.fieldResolutions,
          previewId: input.previewId,
          survivingWorkId: input.survivingWorkId,
        })
      ).slice(0, 48)}`;
      const payload = {
        duplicateWorkId: input.duplicateWorkId,
        duplicateWorkRevision: input.duplicateRevision,
        fieldResolutions: input.fieldResolutions,
        mergeId: mergeMutationId,
        previewId: input.previewId,
        survivingWorkId: input.survivingWorkId,
      };
      const command = {
        actor: { actorId: accountId, type: "User" as const },
        baseRevision: input.baseRevision,
        clientIdempotencyKey: input.clientIdempotencyKey,
        kind: "human" as const,
        payload,
        targetId: input.survivingWorkId,
      };
      const replay = await mutation.replay(command);
      if (replay) {
        return workMergeResultFromReceipt(replay);
      }

      const preview = await buildMergePreview(
        relations,
        store,
        accountId,
        input.survivingWorkId,
        input.duplicateWorkId,
      );
      if (
        !preview ||
        preview.previewId !== input.previewId ||
        preview.survivingWork.revision !== input.baseRevision ||
        preview.duplicateWork.revision !== input.duplicateRevision
      ) {
        throw new WorkMergePreviewRequiredError();
      }

      const [survivingWork, duplicateWork] = await Promise.all([
        store.find(accountId, input.survivingWorkId),
        store.find(accountId, input.duplicateWorkId),
      ]);
      if (!(survivingWork && duplicateWork)) {
        throw new WorkNotFoundError(
          survivingWork ? input.duplicateWorkId : input.survivingWorkId,
        );
      }
      const [mergeRelations, inclusions, retiredRedirectIds] =
        await Promise.all([
          relations.listMergeRelations
            ? relations.listMergeRelations(
                accountId,
                survivingWork.id,
                duplicateWork.id,
              )
            : [],
          relations.listMergeInclusions
            ? relations.listMergeInclusions(
                accountId,
                survivingWork.id,
                duplicateWork.id,
              )
            : [],
          // Earlier merges may already redirect retired identities to the
          // Work being retired now; they are re-pointed to the new survivor
          // so the redirect stays permanent across chained merges.
          store.listRetiredIdentityIdsBySurvivor
            ? store
                .listRetiredIdentityIdsBySurvivor(accountId, duplicateWork.id)
                .then((ids) => [...ids].sort())
            : [],
        ]);
      const relationSnapshots = workMergeRelationSnapshots(
        survivingWork.id,
        duplicateWork.id,
        mergeRelations,
      );
      const { attributedValueKeys, mergedWork } = buildMergedWork(
        survivingWork,
        duplicateWork,
        inclusions,
        input.fieldResolutions,
      );
      const receipt = await mutation.mutate(
        command,
        ({ currentRevision, currentValue }) => {
          if (!currentValue.work || currentValue.work.id !== survivingWork.id) {
            throw new WorkNotFoundError(survivingWork.id);
          }
          const timestamp = new Date().toISOString();
          return {
            merge: {
              attributedRelationIds: relationSnapshots.map(
                (relation) => relation.id,
              ),
              attributedValueKeys,
              duplicateWork,
              duplicateWorkId: duplicateWork.id,
              duplicateWorkRevision: duplicateWork.revision,
              inclusions,
              mergeId: mergeMutationId,
              operation: "merge",
              relations: relationSnapshots,
              retiredRedirectIds,
            },
            work: {
              ...mergedWork,
              revision: currentRevision + 1,
              updatedAt: timestamp,
            },
          } satisfies WorkLifecycleMutationValue;
        },
        {
          undo: {
            kind: "merge",
            merge: {
              attributedRelationIds: relationSnapshots.map(
                (relation) => relation.id,
              ),
              attributedValueKeys: attributedValueKeys.map(
                (field) => `work.${field}`,
              ),
              mergeId: mergeMutationId,
              retiredTargetId: duplicateWork.id,
            },
            scope: "$",
          },
        },
      );
      return workMergeResultFromReceipt(receipt);
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

    previewMerge(accountId, rawInput) {
      const input = workMergePreviewInputSchema.parse(rawInput);
      return buildMergePreview(
        relations,
        store,
        accountId,
        input.survivingWorkId,
        input.duplicateWorkId,
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

    async resolve(accountId, rawInput) {
      const input = workIdentityInputSchema.parse(rawInput);
      let activeWork: WorkProfile | null = null;
      if ("workId" in input) {
        activeWork = await store.find(accountId, input.workId);
      } else if (store.findByKey) {
        activeWork = await store.findByKey(
          accountId,
          input.projectId,
          input.key,
        );
      }
      if (activeWork) {
        return {
          kind: "Active",
          work: activeWork,
        } satisfies WorkIdentityResolution;
      }
      const retiredIdentity = store.findRetiredIdentity
        ? await store.findRetiredIdentity(accountId, input)
        : null;
      return retiredIdentity
        ? { identity: retiredIdentity, kind: "Retired" }
        : null;
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

    async undoMerge(accountId, rawInput) {
      const input = undoWorkMergeInputSchema.parse(rawInput);
      const mutation = mutationContracts.update(accountId);
      if (!(mutation.findReceiptById && mutation.undo)) {
        throw new WorkMergeUndoUnavailableError();
      }
      const sourceReceipt = await mutation.findReceiptById(input.mergeId);
      if (
        !sourceReceipt ||
        sourceReceipt.targetId !== input.survivingWorkId ||
        sourceReceipt.undo?.kind !== "merge" ||
        !sourceReceipt.undo.merge ||
        !sourceReceipt.nextValue.merge ||
        sourceReceipt.nextValue.merge.operation !== "merge"
      ) {
        throw new WorkMergeUndoUnavailableError();
      }
      const mergeMetadata = sourceReceipt.undo.merge;
      const mergeMutation = sourceReceipt.nextValue.merge;
      if (mergeMetadata.retiredTargetId !== mergeMutation.duplicateWorkId) {
        throw new WorkMergeUndoUnavailableError();
      }

      const receipt = await mutation.undo(
        sourceReceipt,
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          kind: "human",
          payload: {
            mergeId: input.mergeId,
            retiredTargetId: mergeMetadata.retiredTargetId,
          },
          targetId: input.survivingWorkId,
        },
        ({ currentRevision, currentValue, previousValue }) => {
          if (!(currentValue.work && previousValue.work)) {
            throw new WorkMergeUndoUnavailableError();
          }
          const restoredWork = { ...currentValue.work };
          for (const attributedKey of mergeMetadata.attributedValueKeys) {
            const field = attributedKey.startsWith("work.")
              ? attributedKey.slice("work.".length)
              : attributedKey;
            (restoredWork as Record<string, unknown>)[field] = (
              previousValue.work as unknown as Record<string, unknown>
            )[field];
          }
          return {
            merge: { ...mergeMutation, operation: "undo" },
            work: {
              ...restoredWork,
              revision: currentRevision + 1,
              updatedAt: new Date().toISOString(),
            },
          } satisfies WorkLifecycleMutationValue;
        },
      );
      if (!receipt.nextValue.work) {
        throw new WorkMergeUndoUnavailableError();
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

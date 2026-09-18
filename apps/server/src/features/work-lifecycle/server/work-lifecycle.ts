import {
  canonicalizeMutationPayload,
  fingerprintMutationPayload,
} from "@cantiara/api/mutation-and-undo";
import {
  createWorkMutationInputSchema,
  detachFeatureHealthHistoryInputSchema,
  detachIncludedWorkInputSchema,
  type FeatureExitBlockers,
  type FeatureProgress,
  includeWorkInputSchema,
  recordFeatureHealthInputSchema,
  updateFeaturePrimarySpecInputSchema,
  updateWorkTypeInputSchema,
  type WorkLifecycleAccess,
  type WorkLifecycleMutationContracts,
  type WorkLifecycleMutationValue,
  type WorkProfile,
  type WorkType,
  type WorkTypeChangePreview,
  workTypeChangePreviewInputSchema,
} from "@cantiara/api/work-lifecycle";

export interface WorkCreationReservation {
  id: string;
  key: string;
  number: number;
  payloadFingerprint: string;
  projectId: string;
  shortCode: string;
  workId: string;
}

export interface WorkLifecycleStore {
  find: (accountId: string, workId: string) => Promise<WorkProfile | null>;
  findByClientIdempotencyKey: (
    accountId: string,
    projectId: string,
    clientIdempotencyKey: string,
  ) => Promise<WorkProfile | null>;
  list: (accountId: string, projectId: string) => Promise<WorkProfile[]>;
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

const WORK_CREATE_TARGET_PREFIX = "work-create:";
const WORK_TYPE_IMPACT_PREVIEW_PREFIX = "work-type-impact:";

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

function sameWorkCreationPayload(
  left: Pick<WorkProfile, "captureProvenance" | "projectId" | "title" | "type">,
  right: {
    captureProvenance?: WorkProfile["captureProvenance"] | null;
    projectId: string;
    title: string;
    type: WorkType;
  },
) {
  return (
    left.projectId === right.projectId &&
    left.title === right.title &&
    left.type === right.type &&
    canonicalizeMutationPayload({
      captureProvenance: left.captureProvenance,
    }) ===
      canonicalizeMutationPayload({
        captureProvenance: right.captureProvenance ?? null,
      })
  );
}

export function createWorkLifecycle({
  mutationContracts,
  store,
}: {
  mutationContracts: WorkLifecycleMutationContracts;
  store: WorkLifecycleStore;
}): WorkLifecycleAccess {
  return {
    async create(accountId, rawInput) {
      const input = createWorkMutationInputSchema.parse(rawInput);
      const existing = await store.findByClientIdempotencyKey(
        accountId,
        input.projectId,
        input.clientIdempotencyKey,
      );
      if (existing) {
        if (!sameWorkCreationPayload(existing, input)) {
          throw new WorkCreationConflictError();
        }
        return existing;
      }

      const createPayload = {
        captureProvenance: input.captureProvenance ?? null,
        projectId: input.projectId,
        title: input.title,
        type: input.type,
      };
      const payloadFingerprint =
        await fingerprintMutationPayload(createPayload);
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
              captureProvenance: mutationPayload.captureProvenance,
              closureResult: null,
              createdAt: timestamp,
              featureHealthHistory: [],
              id: reservation.workId,
              key: reservation.key,
              number: reservation.number,
              primaryFeatureId: null,
              primarySpecId: null,
              projectId: reservation.projectId,
              revision: currentRevision + 1,
              status: "Not Started",
              title: mutationPayload.title,
              type: mutationPayload.type,
              updatedAt: timestamp,
            };
            return {
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
          if (!sameWorkCreationPayload(committed, input)) {
            const conflict = new WorkCreationConflictError(error);
            throw conflict;
          }
          return committed;
        }
        throw error;
      }
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

    async detachIncludedWork(accountId, rawInput) {
      const input = detachIncludedWorkInputSchema.parse(rawInput);
      const includedWork = await store.find(accountId, input.workId);
      if (!includedWork) {
        throw new WorkNotFoundError(input.workId);
      }
      if (
        includedWork.primaryFeatureId &&
        includedWork.primaryFeatureId !== input.featureId
      ) {
        throw new WorkInclusionConflictError(
          "Work is included in a different primary Feature.",
        );
      }

      const timestamp = new Date().toISOString();
      const receipt = await mutationContracts.update(accountId).mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          kind: "human",
          payload: { featureId: input.featureId, workId: input.workId },
          targetId: input.workId,
        },
        ({ currentRevision, currentValue, payload }) => {
          if (!currentValue.work || currentValue.work.id !== payload.workId) {
            throw new WorkNotFoundError(payload.workId);
          }
          if (currentValue.work.primaryFeatureId !== payload.featureId) {
            throw new WorkInclusionConflictError(
              "Work is not included in this Feature.",
            );
          }
          return {
            work: {
              ...currentValue.work,
              primaryFeatureId: null,
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
    },

    async detachFeatureHealthHistory(accountId, rawInput) {
      const input = detachFeatureHealthHistoryInputSchema.parse(rawInput);
      const feature = await store.find(accountId, input.featureId);
      if (!feature) {
        throw new WorkNotFoundError(input.featureId);
      }
      if (feature.type !== "Feature") {
        throw new WorkFeatureRequiredError(input.featureId);
      }
      const timestamp = new Date().toISOString();
      const receipt = await mutationContracts.update(accountId).mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          kind: "human",
          payload: { featureId: input.featureId },
          targetId: input.featureId,
        },
        ({ currentRevision, currentValue, payload }) => {
          if (
            !currentValue.work ||
            currentValue.work.id !== payload.featureId
          ) {
            throw new WorkNotFoundError(payload.featureId);
          }
          if (currentValue.work.type !== "Feature") {
            throw new WorkFeatureRequiredError(payload.featureId);
          }
          return {
            work: {
              ...currentValue.work,
              featureHealthHistory: [],
              revision: currentRevision + 1,
              updatedAt: timestamp,
            },
          } satisfies WorkLifecycleMutationValue;
        },
      );
      if (!receipt.nextValue.work) {
        throw new WorkNotFoundError(input.featureId);
      }
      return receipt.nextValue.work;
    },

    async includeWork(accountId, rawInput) {
      const input = includeWorkInputSchema.parse(rawInput);
      const [feature, includedWork] = await Promise.all([
        store.find(accountId, input.featureId),
        store.find(accountId, input.workId),
      ]);
      if (!feature) {
        throw new WorkNotFoundError(input.featureId);
      }
      if (!includedWork) {
        throw new WorkNotFoundError(input.workId);
      }
      if (feature.type !== "Feature") {
        throw new WorkInclusionConflictError(
          "Only a Feature can include Work.",
        );
      }
      if (feature.projectId !== includedWork.projectId) {
        throw new WorkInclusionConflictError(
          "A Feature can include Work only from the same Project.",
        );
      }
      if (includedWork.type === "Feature") {
        throw new WorkInclusionConflictError(
          "A Feature cannot be included by another Feature.",
        );
      }
      if (
        includedWork.primaryFeatureId &&
        includedWork.primaryFeatureId !== feature.id
      ) {
        throw new WorkInclusionConflictError();
      }

      const timestamp = new Date().toISOString();
      const receipt = await mutationContracts.update(accountId).mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          kind: "human",
          payload: { featureId: feature.id, workId: includedWork.id },
          targetId: includedWork.id,
        },
        ({ currentRevision, currentValue, payload }) => {
          if (!currentValue.work || currentValue.work.id !== input.workId) {
            throw new WorkNotFoundError(input.workId);
          }
          if (
            currentValue.work.primaryFeatureId &&
            currentValue.work.primaryFeatureId !== payload.featureId
          ) {
            throw new WorkInclusionConflictError();
          }
          return {
            work: {
              ...currentValue.work,
              primaryFeatureId: payload.featureId,
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
    },

    list(accountId, projectId) {
      return store.list(accountId, projectId);
    },

    async recordFeatureHealth(accountId, rawInput) {
      const input = recordFeatureHealthInputSchema.parse(rawInput);
      const feature = await store.find(accountId, input.featureId);
      if (!feature) {
        throw new WorkNotFoundError(input.featureId);
      }
      if (feature.type !== "Feature") {
        throw new WorkFeatureRequiredError(input.featureId);
      }

      const timestamp = new Date().toISOString();
      const receipt = await mutationContracts.update(accountId).mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          kind: "human",
          payload: {
            featureId: feature.id,
            health: input.health,
            reason: input.reason,
          },
          targetId: feature.id,
        },
        ({ currentRevision, currentValue, payload }) => {
          if (!currentValue.work || currentValue.work.id !== input.featureId) {
            throw new WorkNotFoundError(input.featureId);
          }
          if (currentValue.work.type !== "Feature") {
            throw new WorkFeatureRequiredError(input.featureId);
          }
          return {
            work: {
              ...currentValue.work,
              featureHealthHistory: [
                ...currentValue.work.featureHealthHistory,
                {
                  health: payload.health,
                  id: crypto.randomUUID(),
                  reason: payload.reason,
                  recordedAt: timestamp,
                  recordedByAccountId: accountId,
                },
              ],
              revision: currentRevision + 1,
              updatedAt: timestamp,
            },
          } satisfies WorkLifecycleMutationValue;
        },
      );
      if (!receipt.nextValue.work) {
        throw new WorkNotFoundError(input.featureId);
      }
      return receipt.nextValue.work;
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

      const timestamp = new Date().toISOString();
      const receipt = await mutationContracts.update(accountId).mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          kind: "human",
          payload: { type: input.type, workId: input.workId },
          targetId: input.workId,
        },
        ({ currentRevision, currentValue, payload }) => {
          if (!currentValue.work || currentValue.work.id !== input.workId) {
            throw new WorkNotFoundError(input.workId);
          }
          return {
            work: {
              ...currentValue.work,
              revision: currentRevision + 1,
              type: payload.type,
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

    async updateFeaturePrimarySpec(accountId, rawInput) {
      const input = updateFeaturePrimarySpecInputSchema.parse(rawInput);
      const feature = await store.find(accountId, input.featureId);
      if (!feature) {
        throw new WorkNotFoundError(input.featureId);
      }
      if (feature.type !== "Feature") {
        throw new WorkFeatureRequiredError(input.featureId);
      }
      const timestamp = new Date().toISOString();
      const receipt = await mutationContracts.update(accountId).mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          kind: "human",
          payload: {
            featureId: input.featureId,
            primarySpecId: input.primarySpecId,
          },
          targetId: input.featureId,
        },
        ({ currentRevision, currentValue, payload }) => {
          if (
            !currentValue.work ||
            currentValue.work.id !== payload.featureId
          ) {
            throw new WorkNotFoundError(payload.featureId);
          }
          if (currentValue.work.type !== "Feature") {
            throw new WorkFeatureRequiredError(payload.featureId);
          }
          return {
            work: {
              ...currentValue.work,
              primarySpecId: payload.primarySpecId,
              revision: currentRevision + 1,
              updatedAt: timestamp,
            },
          } satisfies WorkLifecycleMutationValue;
        },
      );
      if (!receipt.nextValue.work) {
        throw new WorkNotFoundError(input.featureId);
      }
      return receipt.nextValue.work;
    },
  };
}

export { WORK_CREATE_TARGET_PREFIX, workCreateTargetId };

import {
  canonicalizeMutationPayload,
  fingerprintMutationPayload,
  type MutationPayload,
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
  ) {
    const timestamp = new Date().toISOString();
    const receipt = await mutationContracts.update(accountId).mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: command.baseRevision,
        clientIdempotencyKey: command.clientIdempotencyKey,
        kind: "human",
        payload: command.payload,
        targetId: command.targetId,
      },
      ({ currentRevision, currentValue, payload }) => {
        if (!currentValue.work || currentValue.work.id !== command.targetId) {
          throw new WorkNotFoundError(command.targetId);
        }
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

    async detachFeatureHealthHistory(accountId, rawInput) {
      const input = detachFeatureHealthHistoryInputSchema.parse(rawInput);
      const feature = await store.find(accountId, input.featureId);
      if (!feature) {
        throw new WorkNotFoundError(input.featureId);
      }
      if (feature.type !== "Feature") {
        throw new WorkFeatureRequiredError(input.featureId);
      }
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

      return mutateWork(
        accountId,
        {
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          payload: { featureId: feature.id, workId: includedWork.id },
          targetId: includedWork.id,
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
      );
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

      return mutateWork(
        accountId,
        {
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          payload: {
            featureId: feature.id,
            health: input.health,
            reason: input.reason,
          },
          targetId: feature.id,
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
          payload: { type: input.type, workId: input.workId },
          targetId: input.workId,
        },
        (work, payload) => ({ ...work, type: payload.type }),
      );
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
      );
    },
  };
}

export { WORK_CREATE_TARGET_PREFIX, workCreateTargetId };

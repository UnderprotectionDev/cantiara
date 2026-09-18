import {
  canonicalizeMutationPayload,
  fingerprintMutationPayload,
} from "@cantiara/api/mutation-and-undo";
import {
  createWorkMutationInputSchema,
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
) {
  return `${WORK_TYPE_IMPACT_PREVIEW_PREFIX}${workId}:${revision}:${currentType}:${nextType}`;
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
              id: reservation.workId,
              key: reservation.key,
              number: reservation.number,
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

    list(accountId, projectId) {
      return store.list(accountId, projectId);
    },

    async previewTypeChange(accountId, rawInput) {
      const input = workTypeChangePreviewInputSchema.parse(rawInput);
      const work = await store.find(accountId, input.workId);
      if (!work) {
        return null;
      }

      return {
        currentType: work.type,
        nextType: input.type,
        previewId: workTypeChangePreviewId(
          work.id,
          work.revision,
          work.type,
          input.type,
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
        const previewId = workTypeChangePreviewId(
          currentWork.id,
          currentWork.revision,
          currentWork.type,
          input.type,
        );
        if (input.impactPreviewId !== previewId) {
          throw new WorkTypeImpactPreviewRequiredError(previewId);
        }
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
  };
}

export { WORK_CREATE_TARGET_PREFIX, workCreateTargetId };

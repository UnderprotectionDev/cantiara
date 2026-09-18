import {
  canonicalizeMutationPayload,
  fingerprintMutationPayload,
} from "@cantiara/api/mutation-and-undo";
import {
  closeWorkInputSchema,
  createWorkMutationInputSchema,
  reopenWorkInputSchema,
  updateWorkStatusInputSchema,
  updateWorkTypeInputSchema,
  type WorkClosePreview,
  type WorkClosureContextItem,
  type WorkLifecycleAccess,
  type WorkLifecycleMutationContracts,
  type WorkLifecycleMutationValue,
  type WorkProfile,
  type WorkType,
  type WorkTypeChangePreview,
  type WorkVisibleUserInitiator,
  workClosePreviewInputSchema,
  workTypeChangePreviewInputSchema,
} from "@cantiara/api/work-lifecycle";

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

function requireVisibleUserInitiator(initiator: WorkVisibleUserInitiator) {
  if (initiator.kind !== "Visible user") {
    throw new WorkVisibleUserInitiatorRequiredError();
  }
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
  closureContext,
  mutationContracts,
  store,
}: {
  closureContext?: WorkClosureContextProvider;
  mutationContracts: WorkLifecycleMutationContracts;
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

  return {
    async close(accountId, rawInput, initiator) {
      requireVisibleUserInitiator(initiator);
      const input = closeWorkInputSchema.parse(rawInput);
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
      const receipt = await mutationContracts.update(accountId).mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          kind: "human",
          payload: {
            closureReason: input.reason ?? null,
            closureResult: input.closureResult,
            status: "Closed",
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
              closureReason: null,
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

    async reopen(accountId, rawInput, initiator) {
      requireVisibleUserInitiator(initiator);
      const input = reopenWorkInputSchema.parse(rawInput);
      const currentWork = await store.find(accountId, input.workId);
      if (!currentWork) {
        throw new WorkNotFoundError(input.workId);
      }
      if (currentWork.status !== "Closed") {
        throw new WorkNotClosedError();
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
  };
}

export { WORK_CREATE_TARGET_PREFIX, workCreateTargetId };

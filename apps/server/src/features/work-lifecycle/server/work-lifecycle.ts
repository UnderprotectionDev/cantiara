import {
  createWorkMutationInputSchema,
  type WorkLifecycleAccess,
  type WorkLifecycleMutationContracts,
  type WorkLifecycleMutationValue,
  type WorkProfile,
} from "@cantiara/api/work-lifecycle";

export interface WorkCreationReservation {
  id: string;
  key: string;
  number: number;
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

  constructor() {
    super("The Work could not be created because its key was already used.");
    this.name = "WorkCreationConflictError";
  }
}

const WORK_CREATE_TARGET_PREFIX = "work-create:";

function workCreateTargetId(
  accountId: string,
  projectId: string,
  clientIdempotencyKey: string,
) {
  return `${WORK_CREATE_TARGET_PREFIX}${accountId}:${projectId}:${clientIdempotencyKey}`;
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
        if (
          existing.projectId !== input.projectId ||
          existing.title !== input.title ||
          existing.type !== input.type
        ) {
          throw new WorkCreationConflictError();
        }
        return existing;
      }

      const reservation = await store.reserveCreate(
        accountId,
        input.projectId,
        input.clientIdempotencyKey,
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
            payload: {
              projectId: input.projectId,
              title: input.title,
              type: input.type,
            },
            targetId: workCreateTargetId(
              accountId,
              input.projectId,
              input.clientIdempotencyKey,
            ),
          },
          ({ currentRevision, payload }) => {
            if (payload.projectId !== input.projectId) {
              throw new WorkCreationConflictError();
            }
            const work: WorkProfile = {
              closureResult: null,
              createdAt: timestamp,
              id: reservation.workId,
              key: reservation.key,
              number: reservation.number,
              projectId: reservation.projectId,
              revision: currentRevision + 1,
              status: "Not Started",
              title: payload.title,
              type: payload.type,
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
  };
}

export { WORK_CREATE_TARGET_PREFIX, workCreateTargetId };

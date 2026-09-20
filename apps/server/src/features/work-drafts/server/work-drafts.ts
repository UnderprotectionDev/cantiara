import type {
  MutationContract,
  MutationReceipt,
} from "@cantiara/api/mutation-and-undo";
import type { ProjectShellAccess } from "@cantiara/api/project-shell";
import {
  type DeleteWorkDraftInput,
  deleteWorkDraftInputSchema,
  type FinalizeWorkDraftInput,
  finalizeWorkDraftInputSchema,
  type SaveWorkDraftInput,
  saveWorkDraftInputSchema,
  type WorkDraft,
  type WorkDraftMutationValue,
  type WorkDraftsAccess,
  workDraftDeleteMutationPayload,
  workDraftMutationPayload,
  workDraftMutationTarget,
} from "@cantiara/api/work-drafts";
import type {
  WorkLifecycleAccess,
  WorkProfile,
} from "@cantiara/api/work-lifecycle";

export interface WorkDraftRecord extends WorkDraft {
  consumedAt: string | null;
  finalizedWorkId: string | null;
  finalizingClientIdempotencyKey: string | null;
}

export type WorkDraftFinalizationReservation =
  | { status: "not-found" }
  | { draft: WorkDraftRecord; status: "consumed" }
  | { draft: WorkDraftRecord; status: "finalizing" }
  | { draft: WorkDraftRecord; status: "reserved" };

export interface WorkDraftStore {
  find: (accountId: string, draftId: string) => Promise<WorkDraftRecord | null>;
  list: (accountId: string, projectId?: string) => Promise<WorkDraftRecord[]>;
  markConsumed: (
    accountId: string,
    draftId: string,
    workId: string,
    consumedAt: string,
  ) => Promise<WorkDraftRecord | null>;
  releaseFinalization: (
    accountId: string,
    draftId: string,
    clientIdempotencyKey: string,
  ) => Promise<void>;
  reserveFinalization: (
    accountId: string,
    draftId: string,
    clientIdempotencyKey: string,
  ) => Promise<WorkDraftFinalizationReservation>;
}

export class WorkDraftNotFoundError extends Error {
  readonly code = "WORK_DRAFT_NOT_FOUND" as const;

  constructor(draftId: string) {
    super(`Draft ${draftId} was not found.`);
    this.name = "WorkDraftNotFoundError";
  }
}

export class WorkDraftProjectNotFoundError extends Error {
  readonly code = "WORK_DRAFT_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "WorkDraftProjectNotFoundError";
  }
}

export class WorkDraftConsumedError extends Error {
  readonly code = "WORK_DRAFT_CONSUMED" as const;

  constructor(draftId: string) {
    super(`Draft ${draftId} has already been created.`);
    this.name = "WorkDraftConsumedError";
  }
}

export class WorkDraftFinalizingError extends Error {
  readonly code = "WORK_DRAFT_FINALIZING" as const;

  constructor(draftId: string) {
    super(`Draft ${draftId} is already being created.`);
    this.name = "WorkDraftFinalizingError";
  }
}

export class WorkDraftStaleRevisionError extends Error {
  readonly code = "STALE_BASE_REVISION" as const;
  readonly currentRevision: number;
  readonly currentValue: WorkDraft;

  constructor(draft: WorkDraftRecord) {
    super("Draft has changed. Reload and try again.");
    this.name = "WorkDraftStaleRevisionError";
    this.currentRevision = draft.revision;
    this.currentValue = publicDraft(draft);
  }
}

function publicDraft(record: WorkDraftRecord): WorkDraft {
  return {
    checklist: record.checklist,
    createdAt: record.createdAt,
    customFieldValues: record.customFieldValues,
    description: record.description,
    id: record.id,
    projectId: record.projectId,
    revision: record.revision,
    title: record.title,
    type: record.type,
    updatedAt: record.updatedAt,
  };
}

function mutationCommand(accountId: string, input: SaveWorkDraftInput) {
  const payload = workDraftMutationPayload(input);
  return {
    actor: { actorId: accountId, type: "User" as const },
    baseRevision: input.baseRevision,
    clientIdempotencyKey: input.clientIdempotencyKey,
    kind: "human" as const,
    payload,
    targetId: workDraftMutationTarget(accountId, input.draftId),
  };
}

function deleteMutationCommand(accountId: string, input: DeleteWorkDraftInput) {
  return {
    actor: { actorId: accountId, type: "User" as const },
    baseRevision: input.baseRevision,
    clientIdempotencyKey: input.clientIdempotencyKey,
    kind: "human" as const,
    payload: workDraftDeleteMutationPayload(input),
    targetId: workDraftMutationTarget(accountId, input.draftId),
  };
}

function finalizedWorkClientIdempotencyKey(draftId: string) {
  // Derived from the Draft alone: every retry or stale-reservation take-over for
  // the same Draft replays the exact same Work create, so a Draft can never mint
  // two Works even across server restarts or client retry keys.
  return `work-draft:${draftId}`;
}

// Technical crash-recovery lease for a finalization reservation, not a product
// SLA. A live finalization completes in seconds; a reservation older than this
// is treated as dead so a retry can take it over. Safety never depends on the
// duration: the draft-scoped Work create key above replays the same Work.
export const WORK_DRAFT_FINALIZATION_LEASE_MS = 60_000;

export function isFinalizationReservationStale(
  updatedAt: string | Date,
  now: Date,
): boolean {
  return (
    now.getTime() - new Date(updatedAt).getTime() >=
    WORK_DRAFT_FINALIZATION_LEASE_MS
  );
}

async function resolveConsumedFinalization(
  accountId: string,
  draft: WorkDraftRecord,
  workLifecycle: WorkLifecycleAccess,
) {
  const finalized = draft.finalizedWorkId
    ? await workLifecycle.find(accountId, draft.finalizedWorkId)
    : null;
  if (!finalized) {
    throw new WorkDraftConsumedError(draft.id);
  }
  return finalized;
}

async function requireFinalizationReservation(
  store: WorkDraftStore,
  accountId: string,
  input: FinalizeWorkDraftInput,
) {
  const reservation = await store.reserveFinalization(
    accountId,
    input.draftId,
    input.clientIdempotencyKey,
  );
  if (reservation.status === "not-found") {
    throw new WorkDraftNotFoundError(input.draftId);
  }
  if (
    reservation.status === "finalizing" &&
    reservation.draft.finalizingClientIdempotencyKey !==
      input.clientIdempotencyKey
  ) {
    throw new WorkDraftFinalizingError(input.draftId);
  }
  return reservation;
}

// A Draft whose finalization crashed mid-flight stays locked by its reservation.
// A retry takes the stale reservation over (the store compares the reservation
// age against the lease) and releases it, so save/finalize/delete can proceed.
async function healStaleFinalization(
  store: WorkDraftStore,
  accountId: string,
  draftId: string,
  clientIdempotencyKey: string,
): Promise<"available" | "live" | "consumed" | "missing"> {
  const reservation = await store.reserveFinalization(
    accountId,
    draftId,
    clientIdempotencyKey,
  );
  if (reservation.status === "reserved") {
    await store.releaseFinalization(accountId, draftId, clientIdempotencyKey);
    return "available";
  }
  if (reservation.status === "finalizing") {
    return "live";
  }
  if (reservation.status === "consumed") {
    return "consumed";
  }
  return "missing";
}

export function createWorkDrafts({
  mutationContract,
  now = () => new Date(),
  projects,
  store,
  workLifecycle,
}: {
  mutationContract: MutationContract<WorkDraftMutationValue>;
  now?: () => Date;
  projects: Pick<ProjectShellAccess, "find">;
  store: WorkDraftStore;
  workLifecycle: WorkLifecycleAccess;
}): WorkDraftsAccess {
  const finalizations = new Map<string, Promise<WorkProfile>>();

  async function findActive(accountId: string, draftId: string) {
    const record = await store.find(accountId, draftId);
    if (!record || record.consumedAt) {
      return null;
    }
    return publicDraft(record);
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Draft saving coordinates replay, stale-finalization healing, project validation, and mutation persistence.
  async function save(
    accountId: string,
    rawInput: SaveWorkDraftInput,
  ): Promise<WorkDraft> {
    const input = saveWorkDraftInputSchema.parse(rawInput);
    const command = mutationCommand(accountId, input);
    const replay = await mutationContract.replay(command);
    if (replay) {
      if (!replay.nextValue.draft) {
        throw new WorkDraftNotFoundError(input.draftId);
      }
      return replay.nextValue.draft;
    }

    const current = await store.find(accountId, input.draftId);
    if (current?.consumedAt) {
      throw new WorkDraftConsumedError(input.draftId);
    }
    if (current?.finalizingClientIdempotencyKey) {
      const healing = await healStaleFinalization(
        store,
        accountId,
        input.draftId,
        input.clientIdempotencyKey,
      );
      if (healing === "live") {
        throw new WorkDraftFinalizingError(input.draftId);
      }
      if (healing === "consumed") {
        throw new WorkDraftConsumedError(input.draftId);
      }
    }
    if (!current || current.projectId !== input.projectId) {
      const project = await projects.find(accountId, input.projectId);
      if (!project) {
        throw new WorkDraftProjectNotFoundError(input.projectId);
      }
    }

    const receipt = await mutationContract.mutate(
      command,
      ({ currentRevision, currentValue, payload }) => {
        const timestamp = now().toISOString();
        const previous = currentValue.draft;
        return {
          draft: {
            checklist: payload.checklist,
            createdAt: previous?.createdAt ?? timestamp,
            customFieldValues: payload.customFieldValues,
            description: payload.description,
            id: payload.draftId,
            projectId: payload.projectId,
            revision: currentRevision + 1,
            title: payload.title,
            type: payload.type,
            updatedAt: timestamp,
          },
        } satisfies WorkDraftMutationValue;
      },
    );
    return draftFromReceipt(receipt, input.draftId);
  }

  async function finalize(accountId: string, rawInput: FinalizeWorkDraftInput) {
    const input = finalizeWorkDraftInputSchema.parse(rawInput);
    const key = `${accountId}:${input.draftId}:${input.clientIdempotencyKey}`;
    const existingFinalization = finalizations.get(key);
    if (existingFinalization) {
      return existingFinalization;
    }

    const current = await store.find(accountId, input.draftId);
    if (!current) {
      throw new WorkDraftNotFoundError(input.draftId);
    }
    if (current.consumedAt) {
      if (
        current.finalizingClientIdempotencyKey !== input.clientIdempotencyKey
      ) {
        throw new WorkDraftConsumedError(input.draftId);
      }
      return resolveConsumedFinalization(accountId, current, workLifecycle);
    }
    if (current.revision !== input.baseRevision) {
      throw new WorkDraftStaleRevisionError(current);
    }

    const reservation = await requireFinalizationReservation(
      store,
      accountId,
      input,
    );
    if (reservation.status === "consumed") {
      return resolveConsumedFinalization(
        accountId,
        reservation.draft,
        workLifecycle,
      );
    }

    const operation = finalizeReserved(accountId, input, reservation.draft);
    finalizations.set(key, operation);
    return operation;
  }

  async function finalizeReserved(
    accountId: string,
    input: FinalizeWorkDraftInput,
    record: WorkDraftRecord,
  ) {
    let workCreated = false;
    try {
      const work = await workLifecycle.create(accountId, {
        baseRevision: 0,
        checklist: record.checklist,
        clientIdempotencyKey: finalizedWorkClientIdempotencyKey(record.id),
        description: record.description,
        projectId: record.projectId,
        title: record.title,
        type: record.type,
      });
      workCreated = true;
      const consumed = await store.markConsumed(
        accountId,
        record.id,
        work.id,
        now().toISOString(),
      );
      if (!consumed) {
        const current = await store.find(accountId, record.id);
        if (!current?.consumedAt || current.finalizedWorkId !== work.id) {
          throw new Error("Draft could not be consumed after Work creation.");
        }
      }
      return work;
    } catch (error) {
      if (!workCreated) {
        await store.releaseFinalization(
          accountId,
          record.id,
          input.clientIdempotencyKey,
        );
      }
      throw error;
    } finally {
      finalizations.delete(
        `${accountId}:${record.id}:${input.clientIdempotencyKey}`,
      );
    }
  }

  async function remove(
    accountId: string,
    rawInput: DeleteWorkDraftInput,
  ): Promise<{ deleted: boolean }> {
    const input = deleteWorkDraftInputSchema.parse(rawInput);
    const command = deleteMutationCommand(accountId, input);
    const replay = await mutationContract.replay(command);
    if (replay) {
      return { deleted: replay.nextValue.draft === null };
    }

    const record = await store.find(accountId, input.draftId);
    if (!record || record.consumedAt) {
      return { deleted: false };
    }
    if (record.finalizingClientIdempotencyKey) {
      const healing = await healStaleFinalization(
        store,
        accountId,
        input.draftId,
        input.clientIdempotencyKey,
      );
      if (healing === "live") {
        throw new WorkDraftFinalizingError(input.draftId);
      }
      if (healing === "consumed" || healing === "missing") {
        return { deleted: false };
      }
    }
    if (record.revision !== input.baseRevision) {
      throw new WorkDraftStaleRevisionError(record);
    }

    const receipt = await mutationContract.mutate(
      command,
      () => ({ draft: null }) satisfies WorkDraftMutationValue,
    );
    return { deleted: receipt.nextValue.draft === null };
  }

  return {
    delete: remove,
    finalize,
    find: findActive,
    list: async (accountId, projectId) => {
      const records = await store.list(accountId, projectId);
      return records.filter((record) => !record.consumedAt).map(publicDraft);
    },
    save,
  };
}

function draftFromReceipt(
  receipt: MutationReceipt<WorkDraftMutationValue>,
  draftId: string,
) {
  const { draft } = receipt.nextValue;
  if (!draft || draft.id !== draftId) {
    throw new WorkDraftNotFoundError(draftId);
  }
  return draft;
}

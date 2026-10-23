import {
  type AddReleaseChecklistItemInput,
  addReleaseChecklistItemInputSchema,
  type CloseReleaseOpenScopeSignalInput,
  closeReleaseOpenScopeSignalInputSchema,
  deriveReleaseEvidencePack,
  deriveReleaseOpenScopeSignal,
  type ReleaseEvidenceAccess,
  type ReleaseEvidenceChecklistItem,
  type ReleaseEvidenceFacts,
  type ReleaseEvidencePack,
  type ReleaseEvidencePackInput,
  type RemoveReleaseChecklistItemInput,
  releaseEvidencePackInputSchema,
  releaseOpenScopeSignalId,
  removeReleaseChecklistItemInputSchema,
  type SetReleaseChecklistItemInput,
  setReleaseChecklistItemInputSchema,
} from "@cantiara/api/release-evidence";

/**
 * Release Evidence Pack behavior (spec 64). The pack is derived live on every
 * read from the owner records behind the `ReleaseEvidenceSources` read port.
 * This module writes only the founder's own Release checklist lines and the
 * close mark of the open-scope signal: it has no command for Work, test,
 * Pull request, Risk, Karar, Project Release status or publish, and it never
 * produces a score, verdict or gate.
 */

export class ReleaseEvidenceProjectNotFoundError extends Error {
  readonly code = "RELEASE_EVIDENCE_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "ReleaseEvidenceProjectNotFoundError";
  }
}

export class ReleaseEvidenceProjectReadOnlyError extends Error {
  readonly code = "RELEASE_EVIDENCE_PROJECT_READ_ONLY" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} is archived and read-only.`);
    this.name = "ReleaseEvidenceProjectReadOnlyError";
  }
}

export class ReleaseEvidenceReleaseNotFoundError extends Error {
  readonly code = "RELEASE_EVIDENCE_RELEASE_NOT_FOUND" as const;

  constructor(releaseId: string) {
    super(`Project Release ${releaseId} was not found.`);
    this.name = "ReleaseEvidenceReleaseNotFoundError";
  }
}

export class ReleaseEvidenceChecklistItemNotFoundError extends Error {
  readonly code = "RELEASE_EVIDENCE_CHECKLIST_ITEM_NOT_FOUND" as const;

  constructor(itemId: string) {
    super(`Checklist item ${itemId} was not found.`);
    this.name = "ReleaseEvidenceChecklistItemNotFoundError";
  }
}

/** What the store owns: the release row (read) and the founder's checklist. */
export interface ReleaseEvidenceTransaction {
  addChecklistItem: (text: string) => Promise<ReleaseEvidenceChecklistItem>;
  checklist: () => Promise<ReleaseEvidenceChecklistItem[]>;
  closeSignal: (signalId: string) => Promise<void>;
  readOnly: boolean;
  release: () => Promise<ReleaseEvidencePack["release"] | null>;
  removeChecklistItem: (itemId: string) => Promise<boolean>;
  setChecklistItem: (
    itemId: string,
    checked: boolean,
  ) => Promise<ReleaseEvidenceChecklistItem | null>;
  signalClosed: (signalId: string) => Promise<boolean>;
}

export interface ReleaseEvidenceStore {
  /** Resolves to `null` when the account does not own the Project. */
  run: <T>(
    accountId: string,
    projectId: string,
    releaseId: string,
    mode: "read" | "write",
    work: (transaction: ReleaseEvidenceTransaction) => Promise<T>,
  ) => Promise<T | null>;
}

/**
 * Read-only port to the owner records. Each source resolves to its facts or to
 * an explicit unavailable reason; it is never silently empty. Nothing here can
 * write: the port has no mutating member.
 */
export type ReleaseEvidenceSourceFacts = Omit<
  ReleaseEvidenceFacts,
  "checklist" | "readOnly" | "release"
>;

export interface ReleaseEvidenceSources {
  read: (
    accountId: string,
    projectId: string,
    releaseId: string,
  ) => Promise<ReleaseEvidenceSourceFacts>;
}

export function createReleaseEvidence(
  store: ReleaseEvidenceStore,
  sources: ReleaseEvidenceSources,
): ReleaseEvidenceAccess {
  async function facts(
    accountId: string,
    input: ReleaseEvidencePackInput,
  ): Promise<{ closed: boolean; facts: ReleaseEvidenceFacts }> {
    const stored = await store.run(
      accountId,
      input.projectId,
      input.releaseId,
      "read",
      async (tx) => {
        const release = await tx.release();
        return {
          checklist: release ? await tx.checklist() : [],
          closed: release
            ? await tx.signalClosed(releaseOpenScopeSignalId(release.id))
            : false,
          readOnly: tx.readOnly,
          release,
        };
      },
    );
    if (!stored) {
      throw new ReleaseEvidenceProjectNotFoundError(input.projectId);
    }
    if (!stored.release) {
      throw new ReleaseEvidenceReleaseNotFoundError(input.releaseId);
    }
    const read = await sources.read(
      accountId,
      input.projectId,
      input.releaseId,
    );
    return {
      closed: stored.closed,
      facts: {
        ...read,
        checklist: stored.checklist,
        readOnly: stored.readOnly,
        release: stored.release,
      },
    };
  }

  async function write<T>(
    accountId: string,
    projectId: string,
    releaseId: string,
    work: (tx: ReleaseEvidenceTransaction) => Promise<T>,
  ): Promise<T> {
    const result = await store.run(
      accountId,
      projectId,
      releaseId,
      "write",
      async (tx) => {
        if (tx.readOnly) {
          throw new ReleaseEvidenceProjectReadOnlyError(projectId);
        }
        if (!(await tx.release())) {
          throw new ReleaseEvidenceReleaseNotFoundError(releaseId);
        }
        return { value: await work(tx) };
      },
    );
    if (!result) {
      throw new ReleaseEvidenceProjectNotFoundError(projectId);
    }
    return result.value;
  }

  return {
    async addChecklistItem(accountId, rawInput: AddReleaseChecklistItemInput) {
      const input = addReleaseChecklistItemInputSchema.parse(rawInput);
      return await write(accountId, input.projectId, input.releaseId, (tx) =>
        tx.addChecklistItem(input.text),
      );
    },

    async closeOpenScopeSignal(
      accountId,
      rawInput: CloseReleaseOpenScopeSignalInput,
    ) {
      const input = closeReleaseOpenScopeSignalInputSchema.parse(rawInput);
      return await write(accountId, input.projectId, input.releaseId, (tx) =>
        tx.closeSignal(releaseOpenScopeSignalId(input.releaseId)),
      );
    },

    async openScopeSignal(accountId, rawInput) {
      const input = releaseEvidencePackInputSchema.parse(rawInput);
      const read = await facts(accountId, input);
      return deriveReleaseOpenScopeSignal(read.facts, read.closed);
    },

    async pack(accountId, rawInput) {
      const input = releaseEvidencePackInputSchema.parse(rawInput);
      return deriveReleaseEvidencePack((await facts(accountId, input)).facts);
    },

    async removeChecklistItem(
      accountId,
      rawInput: RemoveReleaseChecklistItemInput,
    ) {
      const input = removeReleaseChecklistItemInputSchema.parse(rawInput);
      return await write(
        accountId,
        input.projectId,
        input.releaseId,
        async (tx) => {
          if (!(await tx.removeChecklistItem(input.itemId))) {
            throw new ReleaseEvidenceChecklistItemNotFoundError(input.itemId);
          }
        },
      );
    },

    async setChecklistItem(accountId, rawInput: SetReleaseChecklistItemInput) {
      const input = setReleaseChecklistItemInputSchema.parse(rawInput);
      return await write(
        accountId,
        input.projectId,
        input.releaseId,
        async (tx) => {
          const item = await tx.setChecklistItem(input.itemId, input.checked);
          if (!item) {
            throw new ReleaseEvidenceChecklistItemNotFoundError(input.itemId);
          }
          return item;
        },
      );
    },
  };
}

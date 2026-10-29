import { z } from "zod";

import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import type { TrashRecordKind } from "./trash";

/**
 * Early permanent delete (spec 77): `Permanently Delete` before day 30. The
 * founder sees the effect first, proves GitHub identity through the Account
 * Access `Confirm GitHub Identity` grant (consumed once for the
 * `early-permanent-delete` operation) and types the affected Project name.
 * Those are two distinct steps; there is no second identity card here.
 */

export const PERMANENTLY_DELETE_LABEL = "Permanently Delete";
export const CONFIRM_GITHUB_IDENTITY_LABEL = "Confirm GitHub Identity";

const identifier = z.string().trim().min(1).max(255);

export const trashEarlyDeletePreviewInputSchema = z
  .object({ entryId: identifier, projectId: identifier })
  .strict();
export type TrashEarlyDeletePreviewInput = z.infer<
  typeof trashEarlyDeletePreviewInputSchema
>;

export const permanentlyDeleteFromTrashInputSchema = humanMutationEnvelopeSchema
  .extend({
    entryId: identifier,
    grant: z.string().min(1).max(512),
    projectId: identifier,
    typedName: z.string().min(1).max(200),
  })
  .strict();
export type PermanentlyDeleteFromTrashInput = z.input<
  typeof permanentlyDeleteFromTrashInputSchema
>;

export type TrashDeleteBlockerReason = "active-surface" | "sensitive-content";

export const TRASH_DELETE_BLOCKER_COPY: Record<
  TrashDeleteBlockerReason,
  string
> = {
  "active-surface": "An active External Surface still uses this record.",
  "sensitive-content": "Sensitive content has not been removed yet.",
};

export interface TrashEarlyDeletePreview {
  /** Why the delete cannot run right now; empty when it can. */
  blockers: TrashDeleteBlockerReason[];
  entryId: string;
  groupId: string | null;
  /** `Keep approved surface` is never offered on this path. */
  keepApprovedSurface: { available: false; reason: string };
  /** The records that will be removed; a Project delete group is one unit. */
  members: {
    entryId: string;
    recordId: string;
    recordKind: TrashRecordKind;
    recordLabel: string;
    /** The record's revision in Trash, the base revision of the delete. */
    revision: number;
  }[];
  /** The name the founder must type: the affected Project. */
  typedNameTarget: { kind: "Project"; name: string };
}

export interface PermanentlyDeletedResult {
  deletedAt: string;
  entryId: string;
  groupId: string | null;
  projectId: string;
  records: { recordId: string; recordKind: TrashRecordKind }[];
}

export class TrashDeleteBlockedError extends Error {
  readonly code = "TRASH_DELETE_BLOCKED" as const;
  readonly blockers: TrashDeleteBlockerReason[];

  constructor(blockers: TrashDeleteBlockerReason[]) {
    super(blockers.map((b) => TRASH_DELETE_BLOCKER_COPY[b]).join(" "));
    this.name = "TrashDeleteBlockedError";
    this.blockers = blockers;
  }
}

export class TrashTypedNameMismatchError extends Error {
  readonly code = "TRASH_TYPED_NAME_MISMATCH" as const;

  constructor() {
    super("The typed name does not match.");
    this.name = "TrashTypedNameMismatchError";
  }
}

export class TrashGrantRejectedError extends Error {
  readonly code = "TRASH_GRANT_REJECTED" as const;

  constructor() {
    super(
      `${CONFIRM_GITHUB_IDENTITY_LABEL} is required to delete permanently.`,
    );
    this.name = "TrashGrantRejectedError";
  }
}

/** Consumes the Account Access grant for `early-permanent-delete`; `false` fails closed. */
export type TrashGrantConsumer = (grant: string) => Promise<boolean>;

export interface TrashEarlyDeleteAccess {
  /**
   * Deletes the entry, or its whole Project delete group, permanently. Order
   * is fixed so a refusal never writes: blockers, typed name, then the grant
   * is consumed exactly once, then the erase. `null` when the entry is not in
   * the account's Project.
   */
  permanentlyDelete: (
    accountId: string,
    input: PermanentlyDeleteFromTrashInput,
    consumeGrant: TrashGrantConsumer,
  ) => Promise<PermanentlyDeletedResult | null>;
  preview: (
    accountId: string,
    input: TrashEarlyDeletePreviewInput,
  ) => Promise<TrashEarlyDeletePreview | null>;
}

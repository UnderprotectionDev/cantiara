import { z } from "zod";

import { humanMutationEnvelopeSchema } from "./mutation-and-undo";

/**
 * Trash seam (spec 77): the product-facing recoverable-deletion interface. A
 * supported primary record moves to `Trash`, keeps its internal identity and
 * ownership scope, produces no active rule, Smart Collection or named-view
 * membership, and waits out one 30-day product clock. This first slice owns
 * move and list; restore, External Surface preview, duration-end purge and
 * early permanent delete are later tickets that extend `TrashAccess`.
 */

export const TRASH_LABEL = "Trash";
export const MOVE_TO_TRASH_LABEL = "Move to Trash";
export const TRASH_EMPTY_LABEL = "Nothing in Trash.";

/** The retention is a product clock in fixed 24-hour days, not a calendar month. */
export const TRASH_RETENTION_DAYS = 30;
export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** Primary records this slice can move. Other kinds are later adapters. */
export const TRASH_RECORD_KINDS = [
  "Work",
  "Document",
  "Decision",
  "Risk",
  "Screen",
] as const;
export const trashRecordKindSchema = z.enum(TRASH_RECORD_KINDS);
export type TrashRecordKind = z.infer<typeof trashRecordKindSchema>;

/**
 * Children that travel only with their owner (a Session Test goes with its
 * Test Session as one historical whole), so they are never trashed alone.
 */
export const TRASH_CHILD_ONLY_KINDS = ["Session Test"] as const;
export type TrashChildOnlyKind = (typeof TRASH_CHILD_ONLY_KINDS)[number];

const identifier = z.string().trim().min(1).max(255);

export const trashRequestKindSchema = z.enum([
  ...TRASH_RECORD_KINDS,
  ...TRASH_CHILD_ONLY_KINDS,
]);

export const trashOverviewInputSchema = z
  .object({ projectId: identifier })
  .strict();

/** Move one primary record, committed with its base revision and idempotency key. */
export const moveToTrashInputSchema = humanMutationEnvelopeSchema
  .extend({
    projectId: identifier,
    recordId: identifier,
    recordKind: trashRequestKindSchema,
  })
  .strict();
export type MoveToTrashInput = z.infer<typeof moveToTrashInputSchema>;

export interface TrashRecordRef {
  id: string;
  kind: TrashRecordKind;
}

export function trashRecordKey(ref: TrashRecordRef) {
  return `${ref.kind}:${ref.id}`;
}

export function isTrashRecordKind(value: string): value is TrashRecordKind {
  return (TRASH_RECORD_KINDS as readonly string[]).includes(value);
}

export function isTrashChildOnlyKind(
  value: string,
): value is TrashChildOnlyKind {
  return (TRASH_CHILD_ONLY_KINDS as readonly string[]).includes(value);
}

/** The instant the recoverable window ends: exactly 30 product days after the move. */
export function trashExpiresAt(trashedAt: Date): Date {
  return new Date(trashedAt.valueOf() + TRASH_RETENTION_MS);
}

export interface TrashEntry {
  /** When the recoverable window ends (`trashedAt` plus 30 days). */
  expiresAt: string;
  /** Set when the entry belongs to a Project delete group sharing one clock (later ticket). */
  groupId: string | null;
  id: string;
  projectId: string;
  /** The same internal id the record had before the move. */
  recordId: string;
  recordKind: TrashRecordKind;
  recordLabel: string;
  trashedAt: string;
  workspaceId: string;
}

export interface TrashOverview {
  /** Soonest expiry first. */
  entries: TrashEntry[];
  retentionDays: number;
}

export class TrashChildRecordError extends Error {
  readonly code = "TRASH_CHILD_RECORD" as const;

  constructor(kind: string) {
    super(
      `${kind} moves to Trash only with its owner, never alone as a child record.`,
    );
    this.name = "TrashChildRecordError";
  }
}

export class TrashAlreadyTrashedError extends Error {
  readonly code = "TRASH_ALREADY_TRASHED" as const;

  constructor(ref: TrashRecordRef) {
    super(`${ref.kind} ${ref.id} is already in Trash.`);
    this.name = "TrashAlreadyTrashedError";
  }
}

export interface TrashAccess {
  /**
   * Of the given records, the ones that still count as living: a record in
   * Trash belongs to no active rule, Smart Collection or named view. `null`
   * when the Project is not the account's.
   */
  living: (
    accountId: string,
    projectId: string,
    records: readonly TrashRecordRef[],
  ) => Promise<TrashRecordRef[] | null>;
  /** Moves one record; `null` when the Project or record is not the account's. */
  move: (
    accountId: string,
    input: MoveToTrashInput,
  ) => Promise<TrashEntry | null>;
  /** Every entry in Trash for the Project, or `null` when it is not the account's. */
  overview: (
    accountId: string,
    projectId: string,
  ) => Promise<TrashOverview | null>;
}

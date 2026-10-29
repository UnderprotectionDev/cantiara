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
export const KEEP_APPROVED_SURFACE_LABEL = "Keep approved surface";

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
  // A revoked Dış yüzey follows the same 30 days (it never gets a second clock).
  "External Surface",
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

/**
 * What happens to the Dış yüzeyler attached to the moved source. Revoke is the
 * default; `keep` is the explicit `Keep approved surface` choice.
 */
export const TRASH_SURFACE_DISPOSITIONS = ["revoke", "keep"] as const;
export const trashSurfaceDispositionSchema = z.enum(TRASH_SURFACE_DISPOSITIONS);
export type TrashSurfaceDisposition = z.infer<
  typeof trashSurfaceDispositionSchema
>;

export const trashOverviewInputSchema = z
  .object({ projectId: identifier })
  .strict();

/** Move one primary record, committed with its base revision and idempotency key. */
export const moveToTrashInputSchema = humanMutationEnvelopeSchema
  .extend({
    projectId: identifier,
    recordId: identifier,
    recordKind: trashRequestKindSchema,
    surfaceDisposition: trashSurfaceDispositionSchema.default("revoke"),
  })
  .strict();
export type MoveToTrashInput = z.input<typeof moveToTrashInputSchema>;

/** The Move to Trash preview: which source, so the surfaces can be listed. */
export const moveToTrashPreviewInputSchema = z
  .object({
    projectId: identifier,
    recordId: identifier,
    recordKind: trashRequestKindSchema,
  })
  .strict();
export type MoveToTrashPreviewInput = z.infer<
  typeof moveToTrashPreviewInputSchema
>;

/** Which deletion the move belongs to; only a single-record delete may keep a surface. */
export type TrashDeletionKind =
  | "record"
  | "project"
  | "project-delete-group"
  | "workspace"
  | "account";

/** Where the source lives; only a living container may keep a surface. */
export type TrashSourceContainer =
  | "workspace"
  | "project"
  | "personal-wiki"
  | "gone";

export type KeepApprovedSurfaceVerdict =
  | { eligible: true }
  | { eligible: false; reason: string };

/**
 * `Keep approved surface` is offered only when (a) the source is one record,
 * (b) it lives in a living Workspace, Project or Personal Wiki and (c) the
 * deletion is the recoverable single-record kind, never a Project, Project
 * delete group, Workspace or Account delete. The rule is pure so the preview
 * and the commit decide the same way; a commit that asks for `keep` while this
 * says no is rejected (fail closed).
 */
export function keepApprovedSurfaceEligibility(input: {
  container: TrashSourceContainer;
  deletion: TrashDeletionKind;
  sourceCount: number;
}): KeepApprovedSurfaceVerdict {
  if (input.deletion !== "record") {
    return {
      eligible: false,
      reason: `${KEEP_APPROVED_SURFACE_LABEL} is not offered when deleting a ${input.deletion.replace("-", " ")}.`,
    };
  }
  if (input.sourceCount !== 1) {
    return {
      eligible: false,
      reason: `${KEEP_APPROVED_SURFACE_LABEL} needs exactly one source record.`,
    };
  }
  if (input.container === "gone") {
    return {
      eligible: false,
      reason: `${KEEP_APPROVED_SURFACE_LABEL} needs a living Workspace, Project or Personal Wiki.`,
    };
  }
  return { eligible: true };
}

export const TRASH_SURFACE_STATES = ["Active", "Kept", "Revoked"] as const;
export type TrashSurfaceState = (typeof TRASH_SURFACE_STATES)[number];

export const TRASH_SURFACE_KINDS = [
  "Link-limited share",
  "Published Wiki Document",
] as const;
export type TrashSurfaceKind = (typeof TRASH_SURFACE_KINDS)[number];

/** One Dış yüzey attached to the source; never carries a token, URL or content. */
export interface TrashSurface {
  kind: TrashSurfaceKind;
  state: TrashSurfaceState;
  surfaceId: string;
}

export interface MoveToTrashPreview {
  /** What commit does to an Active surface when the founder does not choose. */
  defaultDisposition: "revoke";
  keepApprovedSurface:
    | { available: true }
    | { available: false; reason: string };
  recordId: string;
  recordKind: TrashRecordKind;
  /** Every attached surface, so the founder sees the access effect first. */
  surfaces: TrashSurface[];
}

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
  /** What happened to the Active surfaces attached to the record (empty when none). */
  surfaces?: { disposition: "kept" | "revoked"; surfaceId: string }[];
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

export class TrashKeepSurfaceNotAllowedError extends Error {
  readonly code = "TRASH_KEEP_SURFACE_NOT_ALLOWED" as const;

  constructor(reason: string) {
    super(reason);
    this.name = "TrashKeepSurfaceNotAllowedError";
  }
}

export class TrashSurfaceNotRevokedError extends Error {
  readonly code = "TRASH_SURFACE_NOT_REVOKED" as const;

  constructor(surfaceId: string) {
    super(`External Surface ${surfaceId} must be revoked before Trash.`);
    this.name = "TrashSurfaceNotRevokedError";
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
  /**
   * Moves one record; `null` when the Project or record is not the account's.
   * `context.deletion` names the deletion the move belongs to (default one
   * record); a Project, Workspace or Account delete never keeps a surface.
   */
  move: (
    accountId: string,
    input: MoveToTrashInput,
    context?: { deletion?: TrashDeletionKind },
  ) => Promise<TrashEntry | null>;
  /** Every entry in Trash for the Project, or `null` when it is not the account's. */
  overview: (
    accountId: string,
    projectId: string,
  ) => Promise<TrashOverview | null>;
  /** Lists every attached Dış yüzey and whether `Keep approved surface` is offered. */
  preview: (
    accountId: string,
    input: MoveToTrashPreviewInput,
    context?: { deletion?: TrashDeletionKind },
  ) => Promise<MoveToTrashPreview | null>;
}

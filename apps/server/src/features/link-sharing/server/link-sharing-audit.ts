/**
 * Link Sharing `Denetim kaydı` entries (spec 73): share create, password
 * rotate, token rotate, expiry change, reopen, reshare, revoke and visitor-gate
 * failures. They live in the 365-day auth audit class (`audit_record`), carry
 * an aliased actor and the surface id only, and never a token, a password or
 * content. The same count powers the share start and revoke rate limit.
 */
export const LINK_SHARING_AUDIT_TYPES = [
  "link-sharing.share-created",
  "link-sharing.share-reshared",
  "link-sharing.share-reopened",
  "link-sharing.expiry-changed",
  "link-sharing.password-rotated",
  "link-sharing.token-rotated",
  "link-sharing.share-revoked",
  "link-sharing.gate-failed",
] as const;
export type LinkSharingAuditType = (typeof LINK_SHARING_AUDIT_TYPES)[number];

export interface LinkSharingAuditRecord {
  /** `account:<digest>` for a founder, `visitor:<rotating digest>` for a gate failure. */
  actorAlias: string;
  id: string;
  occurredAt: Date;
  /** The surface id, or `unknown-surface` when a guessed token matched none. */
  targetAlias: string;
  type: LinkSharingAuditType;
}

/** One rate-limited write slot, reserved atomically before the write. */
export interface LinkSharingAuditReservation {
  actorAlias: string;
  counted: readonly LinkSharingAuditType[];
  /** The reservation is the audit entry itself: a retry replays, never double counts. */
  id: string;
  limit: number;
  occurredAt: Date;
  since: Date;
  targetAlias: string;
  /** The reservation entry type; a member of `counted`. */
  type: LinkSharingAuditType;
}

export interface LinkSharingAudit {
  append: (record: LinkSharingAuditRecord) => Promise<void>;
  /** How many records of these types the actor wrote since the instant. */
  countSince: (
    actorAlias: string,
    types: readonly LinkSharingAuditType[],
    since: Date,
  ) => Promise<number>;
  /**
   * Reserves one slot for a rate-limited write as its audit entry: `false`
   * when the actor is already at the limit for the window, `true` when the
   * slot landed or the reservation id already ran (idempotent retry).
   */
  reserve: (input: LinkSharingAuditReservation) => Promise<boolean>;
}

/** Share starts and revokes per founder per hour; beyond it the write is refused. */
export const SHARE_CHANGE_LIMIT = 20;
export const SHARE_CHANGE_WINDOW_MS = 60 * 60 * 1000;
export const SHARE_START_TYPES = [
  "link-sharing.share-created",
  "link-sharing.share-reshared",
] as const satisfies readonly LinkSharingAuditType[];
export const SHARE_REVOKE_TYPES = [
  "link-sharing.share-revoked",
] as const satisfies readonly LinkSharingAuditType[];

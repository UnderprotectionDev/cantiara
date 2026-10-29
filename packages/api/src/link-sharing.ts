import { z } from "zod";

/**
 * Link Sharing seam (spec 73, #482): the founder previews the exact closed
 * world of a shared main record, then approves it. Approval creates one
 * `External Surface` (Dış yüzey) and one immutable `Approved snapshot
 * revision`; later source writes never reach the surface without a new
 * preview and approval.
 *
 * Nothing is inherited: the preview lists only the chosen root, the members a
 * collection root names, and the parts of those records (fields, versions,
 * attachments, embeds, relations, view metadata). A `Secret`, a share token
 * and a link password are never an item. #483 adds the Share token (minted
 * with a new surface, stored only as a hash), the optional Link password and
 * the visitor Paylaşım erişim oturumu; expiry and revoke are #484.
 */

export const SHARE_LABEL = "Share";
export const PREVIEW_SCOPE_LABEL = "Preview scope";
export const APPROVE_SCOPE_LABEL = "Approve scope";
export const PUBLISH_SHARE_ANYWAY_LABEL = "Publish/share anyway";
export const APPROVED_SNAPSHOT_LABEL = "Approved snapshot";
export const LIVE_LABEL = "Live";
export const SOME_FIELDS_LIVE_LABEL = "Some fields live";
export const LAST_APPROVED_LABEL = "Last scope approval";
export const SHARE_TOKEN_LABEL = "Share token";
export const LINK_PASSWORD_LABEL = "Link password";
export const LIVE_EXTERNAL_SOURCE_LABEL = "Live external source";
export const SET_EXPIRY_LABEL = "Set expiry";
export const REMOVE_EXPIRY_LABEL = "Remove expiry";
export const RESHARE_LABEL = "Reshare with a new link";
export const REOPEN_LABEL = "Reopen the same link";
export const REVOKE_LABEL = "Revoke";
export const EXPIRED_LABEL = "Expired";

/** A Paylaşım erişim oturumu ends 12 hours after creation; activity never extends it. */
export const SHARE_VISITOR_SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
/** Link password bounds: long enough to resist guessing, bounded for hashing cost. */
export const LINK_PASSWORD_MIN_LENGTH = 8;
export const LINK_PASSWORD_MAX_LENGTH = 200;
/** The visitor entry path; the share token is the only path segment. */
export const SHARE_VISITOR_LINK_PATH = "/s";
/** The token-free clean URL path; a Dosya Eki lives under it as `files/<id>/<version>`. */
export const SHARE_SURFACE_PATH = "/shared";

/** Main records a founder can pick as the root of a link share. */
export const LINK_SHARING_ROOT_KINDS = [
  "Document",
  "Roadmap",
  "Screen",
  "Project Wall",
  "Moodboard",
  "Technical Diagram",
  "Smart Collection",
  "Work",
  "Decision",
  "Risk",
  "Feedback",
  "Production Incident",
  "Milestone",
  "Project Release",
] as const;
export const linkSharingRootKindSchema = z.enum(LINK_SHARING_ROOT_KINDS);
export type LinkSharingRootKind = z.infer<typeof linkSharingRootKindSchema>;

/** Roots whose members are chosen by a filter and approved one by one. */
export const LINK_SHARING_COLLECTION_ROOT_KINDS = [
  "Roadmap",
  "Smart Collection",
] as const satisfies readonly LinkSharingRootKind[];

/**
 * Closed classification of a field. Secrets are named so a source adapter can
 * hand them over and the builder can drop them; free text is never scanned.
 */
export const SHARE_FIELD_KINDS = [
  "title",
  "description",
  "markdown",
  "comment",
  "relation-rationale",
  "contact",
  "company",
  "url",
  "custom-field",
  "classification",
  "status",
  "closure-result",
  "priority",
  "planned-start",
  "due-date",
  "reappear-date",
  "roadmap-horizon",
  "milestone-status",
  "release-status",
  "summary",
  "secret",
  "share-token",
  "link-password",
] as const;
export const shareFieldKindSchema = z.enum(SHARE_FIELD_KINDS);
export type ShareFieldKind = z.infer<typeof shareFieldKindSchema>;

/**
 * The closed live allow-list: user-facing status and closure result,
 * priority, planned start/due/reappear dates, Roadmap horizon, Milestone and
 * Project Release status, and openable numeric or date summaries. Title,
 * description, Markdown, comments, relation rationale, Contact/Company, URL,
 * File Attachment, new attachment version, Secret and custom fields are not
 * on it. Adding a kind needs a security review and a PRD change.
 */
export const LIVE_ALLOW_LIST_FIELD_KINDS = [
  "status",
  "closure-result",
  "priority",
  "planned-start",
  "due-date",
  "reappear-date",
  "roadmap-horizon",
  "milestone-status",
  "release-status",
  "summary",
] as const satisfies readonly ShareFieldKind[];

export const SECRET_FIELD_KINDS = [
  "secret",
  "share-token",
  "link-password",
] as const satisfies readonly ShareFieldKind[];

export const SHARE_ITEM_KINDS = [
  "Record",
  "Field",
  "Version",
  "Attachment",
  "Embed",
  "Relation",
  "View metadata",
  "Layout",
  "Card",
  "Live collection block",
] as const;
export const shareItemKindSchema = z.enum(SHARE_ITEM_KINDS);
export type ShareItemKind = z.infer<typeof shareItemKindSchema>;

const identifier = z.string().trim().min(1).max(255);

export const shareRootSchema = z
  .object({ id: identifier, kind: linkSharingRootKindSchema })
  .strict();
export type ShareRoot = z.infer<typeof shareRootSchema>;

/** Where a preview item stands against the surface's current revision. */
export const SHARE_ITEM_STATES = [
  "Never approved",
  "Approved",
  "Changed since approval",
] as const;

export const shareItemSchema = z.object({
  /** A record new to the filter since the last approval: owner diff only. */
  candidate: z.boolean(),
  /** Exactly one item of a group must be approved (a version, a view). */
  group: z.string().nullable(),
  itemId: z.string(),
  kind: shareItemKindSchema,
  label: z.string(),
  /** Marked `Live` in the surface's current revision (owner view only). */
  live: z.boolean(),
  /** An approved member that lost filter membership through live fields. */
  leavesScope: z.boolean(),
  liveEligible: z.boolean(),
  /** The Record item this item belongs to; `null` for a Record. */
  parentId: z.string().nullable(),
  /** `false` for a relation whose target is not itself a Record in scope. */
  selectable: z.boolean(),
  state: z.enum(SHARE_ITEM_STATES).nullable(),
  value: z.string().nullable(),
});
export type ShareItem = z.infer<typeof shareItemSchema>;

export const placeholderFindingSchema = z.object({
  context: z.string(),
  fieldKey: z.string(),
  fieldLabel: z.string(),
  itemId: z.string(),
  placeholder: z.string(),
  recordId: z.string(),
  recordKind: z.string(),
  recordTitle: z.string(),
});
export type PlaceholderFinding = z.infer<typeof placeholderFindingSchema>;

export const shareSurfaceSummarySchema = z.object({
  /** `Approved snapshot` or `Some fields live`; never a blanket `Current`. */
  label: z.enum([APPROVED_SNAPSHOT_LABEL, SOME_FIELDS_LIVE_LABEL, LIVE_LABEL]),
  lastApprovedAt: z.string(),
  /** Whether a Link password gates the surface; never the password itself. */
  passwordProtected: z.boolean(),
  /** The optional Bağlantı süre dolumu as an ISO instant; `null` is no expiry. */
  expiresAt: z.string().nullable(),
  revision: z.number().int().positive(),
  surfaceId: z.string(),
  /** `Expired` stops access without revoking; a revoked surface is never listed. */
  state: z.enum(["Active", "Expired"]),
});
export type ShareSurfaceSummary = z.infer<typeof shareSurfaceSummarySchema>;

/** Owner-only: what changed in the source since the last approval. */
export const shareDiffSchema = z.object({
  added: z.array(z.string()),
  changed: z.array(z.string()),
  removed: z.array(z.string()),
});
export type ShareDiff = z.infer<typeof shareDiffSchema>;

export const shareScopePreviewSchema = z.object({
  /** Reasons no link can be approved yet (for example no exact version). */
  blockers: z.array(z.string()),
  diff: shareDiffSchema.nullable(),
  items: z.array(shareItemSchema),
  placeholders: z.array(placeholderFindingSchema),
  projectId: z.string(),
  root: z.object({
    id: z.string(),
    kind: linkSharingRootKindSchema,
    title: z.string(),
  }),
  surface: shareSurfaceSummarySchema.nullable(),
});
export type ShareScopePreview = z.infer<typeof shareScopePreviewSchema>;

export const previewShareScopeInputSchema = z
  .object({ root: shareRootSchema, surfaceId: identifier.optional() })
  .strict();
export type PreviewShareScopeInput = z.infer<
  typeof previewShareScopeInputSchema
>;

export const approveShareScopeInputSchema = z
  .object({
    /** One approval attempt; a retry replays, a changed payload conflicts. */
    approvalId: identifier,
    approvedItemIds: z.array(identifier).max(2000),
    liveItemIds: z.array(identifier).max(2000),
    /** Separate from scope approval: the `Publish/share anyway` confirmation. */
    publishAnyway: z.boolean(),
    root: shareRootSchema,
    /** The surface that receives the new revision; default: the root's latest, else a new one. */
    surfaceId: identifier.optional(),
  })
  .strict();
export type ApproveShareScopeInput = z.infer<
  typeof approveShareScopeInputSchema
>;

export const shareRootsInputSchema = z
  .object({ projectId: identifier })
  .strict();

export const shareRootSummarySchema = z.object({
  id: z.string(),
  kind: linkSharingRootKindSchema,
  title: z.string(),
});
export type ShareRootSummary = z.infer<typeof shareRootSummarySchema>;

export const approvedShareSchema = z.object({
  /**
   * The Share token, returned once when the approval creates the surface.
   * Only its hash is stored, so a replay returns `null`; rotate to get a new one.
   */
  accessToken: z.string().nullable(),
  label: shareSurfaceSummarySchema.shape.label,
  lastApprovedAt: z.string(),
  passwordProtected: z.boolean(),
  revision: z.number().int().positive(),
  surfaceId: z.string(),
});
export type ApprovedShare = z.infer<typeof approvedShareSchema>;

/** Add, change (a string) or remove (`null`) the optional Link password. */
export const setLinkPasswordInputSchema = z
  .object({
    password: z
      .string()
      .min(LINK_PASSWORD_MIN_LENGTH)
      .max(LINK_PASSWORD_MAX_LENGTH)
      .nullable(),
    surfaceId: identifier,
  })
  .strict();
export type SetLinkPasswordInput = z.infer<typeof setLinkPasswordInputSchema>;

export const rotateShareTokenInputSchema = z
  .object({ surfaceId: identifier })
  .strict();
export type RotateShareTokenInput = z.infer<typeof rotateShareTokenInputSchema>;

export const shareAccessSchema = z.object({
  passwordProtected: z.boolean(),
  surfaceId: z.string(),
  /** Only a rotation returns a token, once. */
  token: z.string().nullable(),
});
export type ShareAccess = z.infer<typeof shareAccessSchema>;

/** Set (an ISO instant) or remove (`null`) the expiry of a surface that has not expired. */
export const setShareExpiryInputSchema = z
  .object({
    expiresAt: z.iso.datetime({ offset: true }).nullable(),
    surfaceId: identifier,
  })
  .strict();
export type SetShareExpiryInput = z.infer<typeof setShareExpiryInputSchema>;

/**
 * `Reshare with a new link`: a new Dış yüzey with the approved snapshot and a
 * new token. `newSurfaceId` is the client's idempotency key, as `approvalId`
 * is for an approval.
 */
export const reshareExpiredLinkInputSchema = z
  .object({
    expiresAt: z.iso.datetime({ offset: true }).nullable(),
    newSurfaceId: identifier,
    surfaceId: identifier,
  })
  .strict();
export type ReshareExpiredLinkInput = z.infer<
  typeof reshareExpiredLinkInputSchema
>;

/**
 * `Reopen the same link`: separate from reshare and refused unless the founder
 * confirms that every old holder of the link regains access.
 */
export const reopenExpiredLinkInputSchema = z
  .object({
    confirmOldHoldersRegainAccess: z.literal(true),
    expiresAt: z.iso.datetime({ offset: true }).nullable(),
    surfaceId: identifier,
  })
  .strict();
export type ReopenExpiredLinkInput = z.infer<
  typeof reopenExpiredLinkInputSchema
>;

/** `Revoke` is terminal for that URL and token. */
export const revokeShareInputSchema = z
  .object({ surfaceId: identifier })
  .strict();
export type RevokeShareInput = z.infer<typeof revokeShareInputSchema>;

export const shareExpirySchema = z.object({
  expiresAt: z.string().nullable(),
  state: z.enum(["Active", "Expired"]),
  surfaceId: z.string(),
});
export type ShareExpiry = z.infer<typeof shareExpirySchema>;

export const revokedShareSchema = z.object({
  revokedAt: z.string(),
  surfaceId: z.string(),
});
export type RevokedShare = z.infer<typeof revokedShareSchema>;

/** The frozen content manifest an Approved snapshot revision stores. */
export const SHARE_MANIFEST_FORMAT = "cantiara.link-share-manifest";
export interface ShareManifestItem {
  itemId: string;
  kind: ShareItemKind;
  label: string;
  /** `true` only for an allow-listed field the founder marked `Live`. */
  live: boolean;
  parentId: string | null;
  value: string | null;
}
export interface ShareManifest {
  approvedAt: string;
  format: typeof SHARE_MANIFEST_FORMAT;
  items: ShareManifestItem[];
  label: ShareSurfaceSummary["label"];
  placeholdersAcknowledged: boolean;
  root: ShareRoot;
  version: 1;
}

export class LinkSharingScopeError extends Error {
  readonly code = "LINK_SHARING_SCOPE_INVALID" as const;

  constructor(message: string) {
    super(message);
    this.name = "LinkSharingScopeError";
  }
}

export class LinkSharingPlaceholdersError extends Error {
  readonly code = "LINK_SHARING_PLACEHOLDERS_UNRESOLVED" as const;

  readonly findings: PlaceholderFinding[];

  constructor(findings: PlaceholderFinding[]) {
    super(
      "Unresolved placeholders need a fix or a separate Publish/share anyway confirmation.",
    );
    this.name = "LinkSharingPlaceholdersError";
    this.findings = findings;
  }
}

/** The action does not fit the surface state (for example extending an expired link). */
export class LinkSharingStateError extends Error {
  readonly code = "LINK_SHARING_STATE_INVALID" as const;

  constructor(message: string) {
    super(message);
    this.name = "LinkSharingStateError";
  }
}

/** Starting or revoking shares too often; try again after `retryAfterSeconds`. */
export class LinkSharingRateLimitError extends Error {
  readonly code = "LINK_SHARING_RATE_LIMITED" as const;

  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Too many share changes. Try again later.");
    this.name = "LinkSharingRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class LinkSharingConflictError extends Error {
  readonly code = "LINK_SHARING_CONFLICT" as const;

  constructor(approvalId: string) {
    super(`Approval ${approvalId} is already saved with different content.`);
    this.name = "LinkSharingConflictError";
  }
}

export interface LinkSharingAccess {
  /** Approves the scope; `null` when the root is not the account's. */
  approve: (
    accountId: string,
    input: ApproveShareScopeInput,
  ) => Promise<ApprovedShare | null>;
  /** The exact closed world, or `null` when the root is not the account's. */
  preview: (
    accountId: string,
    input: PreviewShareScopeInput,
  ) => Promise<ShareScopePreview | null>;
  /** `Reopen the same link`: the expired surface admits its old holders again. */
  reopen: (
    accountId: string,
    input: ReopenExpiredLinkInput,
  ) => Promise<ShareExpiry | null>;
  /** `Reshare with a new link`: a new Dış yüzey with a new token for an expired one. */
  reshare: (
    accountId: string,
    input: ReshareExpiredLinkInput,
  ) => Promise<ApprovedShare | null>;
  /** `Revoke`: terminal; the URL and token never work again. */
  revoke: (
    accountId: string,
    input: RevokeShareInput,
  ) => Promise<RevokedShare | null>;
  /** The Project's shareable main records, or `null` when not the account's. */
  roots: (
    accountId: string,
    projectId: string,
  ) => Promise<ShareRootSummary[] | null>;
  /** New token for the surface; every visitor session ends. `null` when not the account's. */
  rotateToken: (
    accountId: string,
    input: RotateShareTokenInput,
  ) => Promise<ShareAccess | null>;
  /** Sets, extends or removes the expiry before it passes. */
  setExpiry: (
    accountId: string,
    input: SetShareExpiryInput,
  ) => Promise<ShareExpiry | null>;
  /** Adds, changes or removes the Link password; every visitor session ends. */
  setPassword: (
    accountId: string,
    input: SetLinkPasswordInput,
  ) => Promise<ShareAccess | null>;
}

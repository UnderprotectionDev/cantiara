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
 * and a link password are never an item. This slice mints no token, password,
 * visitor session, expiry or revoke (#483, #484).
 */

export const SHARE_LABEL = "Share";
export const PREVIEW_SCOPE_LABEL = "Preview scope";
export const APPROVE_SCOPE_LABEL = "Approve scope";
export const PUBLISH_SHARE_ANYWAY_LABEL = "Publish/share anyway";
export const APPROVED_SNAPSHOT_LABEL = "Approved snapshot";
export const LIVE_LABEL = "Live";
export const SOME_FIELDS_LIVE_LABEL = "Some fields live";
export const LAST_APPROVED_LABEL = "Last scope approval";

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
  revision: z.number().int().positive(),
  surfaceId: z.string(),
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
  label: shareSurfaceSummarySchema.shape.label,
  lastApprovedAt: z.string(),
  revision: z.number().int().positive(),
  surfaceId: z.string(),
});
export type ApprovedShare = z.infer<typeof approvedShareSchema>;

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
  /** The Project's shareable main records, or `null` when not the account's. */
  roots: (
    accountId: string,
    projectId: string,
  ) => Promise<ShareRootSummary[] | null>;
}

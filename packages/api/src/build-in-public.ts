import { z } from "zod";

import { placeholderRanges } from "./document-templates";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";

const identifierSchema = z.string().trim().min(1).max(255);

export const BUILD_IN_PUBLIC_UI_LABELS = {
  buildInPublic: "Build in Public",
  completed: "Completed",
  inProgress: "In Progress",
  planned: "Planned",
  publicStatusLabel: "Public Status Label",
  publicSummary: "Public summary",
  publicTitle: "Public title",
  publishAnyway: "Publish/share anyway",
  released: "Released",
  unpublishedChanges: "Unpublished changes",
} as const;

export const BUILD_IN_PUBLIC_NOTICE =
  "Nothing is public until you approve it. Free text, URLs and file metadata are not scanned for secrets; Secret fields, share tokens and link passwords are never part of a Build in Public preview.";

/* -------------------------------------------------------------------------- */
/* Public Status Label map                                                     */
/* -------------------------------------------------------------------------- */

/** The internal state a Work can be in, as the map sees it. */
export const BUILD_IN_PUBLIC_STATUS_KEYS = [
  "Not Started",
  "In Progress",
  "Blocked",
  "Closed + Completed",
  "Closed + Abandoned",
] as const;
export type BuildInPublicStatusKey =
  (typeof BUILD_IN_PUBLIC_STATUS_KEYS)[number];

/** PRD 14 starting map; `Blocked` and `Closed + Abandoned` have no default. */
export const DEFAULT_PUBLIC_STATUS_MAP: Readonly<
  Record<BuildInPublicStatusKey, string | null>
> = {
  Blocked: null,
  "Closed + Abandoned": null,
  "Closed + Completed": BUILD_IN_PUBLIC_UI_LABELS.completed,
  "In Progress": BUILD_IN_PUBLIC_UI_LABELS.inProgress,
  "Not Started": BUILD_IN_PUBLIC_UI_LABELS.planned,
};

export const RELEASED_LABEL = BUILD_IN_PUBLIC_UI_LABELS.released;

/** Internal status names that must never become a Public Status Label. */
const INTERNAL_ONLY_NAMES = new Set([
  "abandoned",
  "blocked",
  "closed",
  "closedabandoned",
  "closedcompleted",
  "notstarted",
]);

const NAME_NOISE = /[\s+_-]+/gu;

export function isInternalStatusName(label: string) {
  return INTERNAL_ONLY_NAMES.has(label.toLowerCase().replace(NAME_NOISE, ""));
}

/** A visitor-readable label; an internal status name is refused. */
export const publicStatusLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .refine((label) => !isInternalStatusName(label), {
    message: "A Public Status Label cannot reuse an internal status name.",
  });

export function publicStatusKeyOf(
  status: string,
  closureResult: string | null,
): BuildInPublicStatusKey | null {
  switch (status) {
    case "Not Started":
    case "In Progress":
    case "Blocked":
      return status;
    case "Closed":
      if (closureResult === "Completed") {
        return "Closed + Completed";
      }
      return closureResult === "Abandoned" ? "Closed + Abandoned" : null;
    default:
      return null;
  }
}

export type PublicLabelSource =
  | "Chosen for this Work"
  | "Default map"
  | "Project map"
  | "Unmapped";

/**
 * The label a Work would carry. Pure: the Work's internal status is read, never
 * written, and the result is only a proposal until a snapshot approves it.
 */
export function resolvePublicLabel(input: {
  /** The founder's explicit label for this one Work. */
  chosenLabel: string | null;
  /** Project overrides of the default map. */
  projectMap: Readonly<Record<string, string>>;
  statusKey: BuildInPublicStatusKey | null;
}): { label: string | null; source: PublicLabelSource } {
  if (input.chosenLabel) {
    return { label: input.chosenLabel, source: "Chosen for this Work" };
  }
  if (!input.statusKey) {
    return { label: null, source: "Unmapped" };
  }
  const override = input.projectMap[input.statusKey];
  if (override) {
    return { label: override, source: "Project map" };
  }
  const fallback = DEFAULT_PUBLIC_STATUS_MAP[input.statusKey];
  return fallback
    ? { label: fallback, source: "Default map" }
    : { label: null, source: "Unmapped" };
}

export const LABEL_REQUIRED_MESSAGE =
  "Choose a Public Status Label before this Work can be published.";

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

export interface BuildInPublicMapRow {
  defaultLabel: string | null;
  /** Effective label: the Project override, else the default; null when unmapped. */
  label: string | null;
  source: "Default map" | "Project map" | "Unmapped";
  statusKey: BuildInPublicStatusKey;
}

export interface BuildInPublicSettings {
  enabled: boolean;
  projectId: string;
  /** Revision number of the last Onaylı snapshot revizyonu, or null before the first approval. */
  revision: number | null;
  statusMap: BuildInPublicMapRow[];
}

export interface BuildInPublicWorkCopy {
  publicStatusLabel: string | null;
  publicSummary: string | null;
  publicTitle: string | null;
  workId: string;
}

export const buildInPublicProjectInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export const setBuildInPublicEnabledInputSchema = humanMutationEnvelopeSchema
  .extend({ enabled: z.boolean(), projectId: identifierSchema })
  .strict();

export const setBuildInPublicStatusMapInputSchema = humanMutationEnvelopeSchema
  .extend({
    /** Null resets the status to its default. */
    label: publicStatusLabelSchema.nullable(),
    projectId: identifierSchema,
    statusKey: z.enum(BUILD_IN_PUBLIC_STATUS_KEYS),
  })
  .strict();

const optionalTextSchema = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value === "" ? null : value));

export const setBuildInPublicWorkCopyInputSchema = humanMutationEnvelopeSchema
  .extend({
    projectId: identifierSchema,
    publicStatusLabel: publicStatusLabelSchema.nullable(),
    publicSummary: optionalTextSchema(300),
    publicTitle: optionalTextSchema(120),
    workId: identifierSchema,
  })
  .strict();

/* -------------------------------------------------------------------------- */
/* Preview and approval                                                        */
/* -------------------------------------------------------------------------- */

export const BUILD_IN_PUBLIC_ITEM_KINDS = [
  "Roadmap Work",
  "Released label",
  "File Attachment",
  "YouTube video",
  "Metadata",
] as const;
export type BuildInPublicItemKind = (typeof BUILD_IN_PUBLIC_ITEM_KINDS)[number];

export interface BuildInPublicField {
  name: string;
  value: string;
}

export interface BuildInPublicDiffRow {
  /** Value in the last approved snapshot; null when nothing was approved. */
  approved: string | null;
  field: string;
  /** Value that would leave now; null when it would no longer leave. */
  proposed: string | null;
}

/** `Unpublished changes` is the visible marker of a source edit not yet approved. */
export type BuildInPublicChange = "New" | "Unchanged" | "Unpublished changes";

export interface BuildInPublicItem {
  /** Reason the item cannot be approved; null when it can. */
  blocker: string | null;
  change: BuildInPublicChange;
  diff: BuildInPublicDiffRow[];
  fields: BuildInPublicField[];
  files: { attachmentId: string; name: string; version: number }[];
  /** Stable per item; the founder approves each id on its own. */
  id: string;
  /** Roadmap Work only: founder-facing, so the mapping is visible; never in the snapshot. */
  internalStatus: BuildInPublicStatusKey | null;
  kind: BuildInPublicItemKind;
  labelSource: PublicLabelSource | null;
  /** Dependent items (label suggestion, file, embed) hang under their Work item. */
  parentId: string | null;
  /** Roadmap Work: the label that would leave; Released label: `Released`. */
  publicStatusLabel: string | null;
  title: string;
  workId: string | null;
}

export interface BuildInPublicPlaceholderFinding {
  context: string;
  field: string;
  itemId: string;
  name: string;
  sourceRecord: { id: string; title: string; type: string };
}

export interface BuildInPublicMetadata {
  summary: string | null;
  title: string | null;
}

export interface BuildInPublicPreview {
  fingerprint: string;
  items: BuildInPublicItem[];
  metadata: BuildInPublicMetadata;
  notice: string;
  placeholders: BuildInPublicPlaceholderFinding[];
  projectId: string;
  /** The preview writes nothing and creates no surface or revision. */
  written: false;
}

const metadataSchema = z
  .object({
    summary: z.string().trim().max(300).nullable().optional(),
    title: z.string().trim().max(120).nullable().optional(),
  })
  .strict();

export const buildInPublicPreviewInputSchema = z
  .object({ metadata: metadataSchema.optional(), projectId: identifierSchema })
  .strict();
export type BuildInPublicPreviewInput = z.infer<
  typeof buildInPublicPreviewInputSchema
>;

export const approveBuildInPublicInputSchema = humanMutationEnvelopeSchema
  .extend({
    approval: z
      .object({
        approvedItemIds: z.array(identifierSchema).max(1000),
        fingerprint: z.string().trim().min(1).max(200),
        metadata: metadataSchema.optional(),
        /** Separate from scope approval; never implied by it. */
        publishAnyway: z.boolean(),
      })
      .strict(),
    projectId: identifierSchema,
  })
  .strict();
export type ApproveBuildInPublicInput = z.infer<
  typeof approveBuildInPublicInputSchema
>;

/** One approved Roadmap Work as visitors will see it; no internal status or title. */
export interface BuildInPublicSnapshotWork {
  embeds: { kind: "YouTube video"; memberId: string; url: string }[];
  files: { attachmentId: string; name: string; version: number }[];
  /** Roadmap horizon the Work sat in when approved. */
  horizon: string;
  /** Opaque (`work-1`); the only id a visitor surface may use. */
  memberId: string;
  publicStatusLabel: string;
  /** Private diff key; never rendered or exposed on a visitor path. */
  sourceWorkId: string;
  summary: string | null;
  title: string;
}

export interface BuildInPublicSnapshot {
  approvedAt: string;
  kind: "Build in Public";
  metadata: BuildInPublicMetadata;
  projectId: string;
  roadmap: BuildInPublicSnapshotWork[];
}

export interface ApprovedBuildInPublic {
  approvedAt: string;
  projectId: string;
  revision: number;
  surfaceId: string;
}

export const BUILD_IN_PUBLIC_ERROR_CODES = [
  "BUILD_IN_PUBLIC_DISABLED",
  "BUILD_IN_PUBLIC_LABEL_REQUIRED",
  "BUILD_IN_PUBLIC_NOTHING_APPROVED",
  "BUILD_IN_PUBLIC_PLACEHOLDERS_UNRESOLVED",
  "BUILD_IN_PUBLIC_PREVIEW_STALE",
  "BUILD_IN_PUBLIC_WORK_UNAVAILABLE",
] as const;
export type BuildInPublicErrorCode =
  (typeof BUILD_IN_PUBLIC_ERROR_CODES)[number];

export const BUILD_IN_PUBLIC_ERROR_MESSAGES: Record<
  BuildInPublicErrorCode,
  string
> = {
  BUILD_IN_PUBLIC_DISABLED: "Enable Build in Public for this Project first.",
  BUILD_IN_PUBLIC_LABEL_REQUIRED: LABEL_REQUIRED_MESSAGE,
  BUILD_IN_PUBLIC_NOTHING_APPROVED: "Approve at least one item to publish.",
  BUILD_IN_PUBLIC_PLACEHOLDERS_UNRESOLVED:
    "Resolve the placeholders or confirm Publish/share anyway.",
  BUILD_IN_PUBLIC_PREVIEW_STALE:
    "The preview changed. Review it again before publishing.",
  BUILD_IN_PUBLIC_WORK_UNAVAILABLE:
    "This Work is not on the Roadmap of this Project.",
};

export class BuildInPublicError extends Error {
  readonly code: BuildInPublicErrorCode;

  constructor(code: BuildInPublicErrorCode) {
    super(BUILD_IN_PUBLIC_ERROR_MESSAGES[code]);
    this.code = code;
    this.name = "BuildInPublicError";
  }
}

export interface BuildInPublicAccess {
  approve: (
    accountId: string,
    input: Omit<
      ApproveBuildInPublicInput,
      "baseRevision" | "clientIdempotencyKey"
    >,
  ) => Promise<ApprovedBuildInPublic | null>;
  preview: (
    accountId: string,
    input: BuildInPublicPreviewInput,
  ) => Promise<BuildInPublicPreview | null>;
  setEnabled: (
    accountId: string,
    input: { enabled: boolean; projectId: string },
  ) => Promise<BuildInPublicSettings | null>;
  setStatusMap: (
    accountId: string,
    input: {
      label: string | null;
      projectId: string;
      statusKey: BuildInPublicStatusKey;
    },
  ) => Promise<BuildInPublicSettings | null>;
  settings: (
    accountId: string,
    projectId: string,
  ) => Promise<BuildInPublicSettings | null>;
  setWorkCopy: (
    accountId: string,
    input: Omit<BuildInPublicWorkCopy, never> & { projectId: string },
  ) => Promise<BuildInPublicWorkCopy | null>;
}

/* -------------------------------------------------------------------------- */
/* Pure rules                                                                  */
/* -------------------------------------------------------------------------- */

export function workItemId(workId: string) {
  return `work:${workId}`;
}
export function releasedItemId(workId: string) {
  return `released:${workId}`;
}
export function attachmentItemId(workId: string, attachmentId: string) {
  return `attachment:${workId}:${attachmentId}`;
}
export function youtubeItemId(workId: string, occurrenceId: string) {
  return `youtube:${workId}:${occurrenceId}`;
}
export const METADATA_ITEM_ID = "metadata";

const CONTEXT_RADIUS = 40;

/** Unresolved `{{field_name}}` in one text with the surrounding text; code matches are ignored. */
export function unresolvedPlaceholders(text: string) {
  return placeholderRanges(text).map(({ end, name, start }) => ({
    context: text
      .slice(Math.max(0, start - CONTEXT_RADIUS), end + CONTEXT_RADIUS)
      .replace(/\s+/g, " ")
      .trim(),
    name,
  }));
}

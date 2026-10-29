import { z } from "zod";

import type { BuildInPublicPublicationAccess } from "./build-in-public-publication";
import { placeholderRanges } from "./document-templates";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";

const identifierSchema = z.string().trim().min(1).max(255);

export const BUILD_IN_PUBLIC_UI_LABELS = {
  buildInPublic: "Build in Public",
  changelog: "Changelog",
  completed: "Completed",
  developmentFeed: "Development feed",
  disableIndexing: "Disable indexing",
  enableIndexing: "Enable indexing",
  explainTheChange: "Explain the change",
  inProgress: "In Progress",
  liveExternalSource: "Live external source",
  openSourceRecord: "Open source record",
  planned: "Planned",
  project: "Project",
  publicStatusLabel: "Public Status Label",
  publicSummary: "Public summary",
  publicTitle: "Public title",
  publishAnyway: "Publish/share anyway",
  released: "Released",
  roadmap: "Roadmap",
  reviewPublishDiff: "Review publish diff",
  unpublish: "Unpublish",
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

/** How the internal target date is shown; there is no second public date field. */
export const DUE_DATE_PRESENTATIONS = [
  "Full date",
  "Month",
  "Quarter",
  "Hidden",
] as const;
export type DueDatePresentation = (typeof DUE_DATE_PRESENTATIONS)[number];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;

/**
 * The public reading of the internal target date. Derived on every call from
 * the one internal date; a coarser presentation never carries the finer value.
 */
export function presentDueDate(
  date: string | null | undefined,
  presentation: DueDatePresentation,
): string | null {
  const match = date ? ISO_DATE.exec(date) : null;
  const month = match ? Number(match[2]) : 0;
  if (!match || presentation === "Hidden" || month < 1 || month > 12) {
    return null;
  }
  const [, year = "", , day = ""] = match;
  const monthName = MONTH_NAMES[month - 1] ?? "";
  if (presentation === "Full date") {
    return `${Number(day)} ${monthName} ${year}`;
  }
  return presentation === "Month"
    ? `${monthName} ${year}`
    : `Q${Math.ceil(month / 3)} ${year}`;
}

export interface BuildInPublicWorkCopy {
  dueDatePresentation: DueDatePresentation;
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
    dueDatePresentation: z.enum(DUE_DATE_PRESENTATIONS).default("Hidden"),
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
  "Project member",
  "Wall part",
] as const;
export type BuildInPublicItemKind = (typeof BUILD_IN_PUBLIC_ITEM_KINDS)[number];

/** Records the public Proje view can list besides Roadmap Works. */
export const BUILD_IN_PUBLIC_MEMBER_KINDS = [
  "Document",
  "Design",
  "Decision",
  "Project Release",
  "Project Wall",
] as const;
export type BuildInPublicMemberKind =
  (typeof BUILD_IN_PUBLIC_MEMBER_KINDS)[number];

/** Each part of a selected Project Wall is its own approval item. */
export const WALL_PART_KINDS = [
  "Card",
  "File version",
  "Layout",
  "Group",
  "View text",
  "Visual line",
  "Focus order",
  "Color",
  "Crop, rotate and markup",
  "Live collection block",
] as const;
export type WallPartKind = (typeof WALL_PART_KINDS)[number];

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
  /** Project member items only. */
  memberKind: BuildInPublicMemberKind | null;
  /** Dependent items (label suggestion, file, embed, Wall part) hang under their root item. */
  parentId: string | null;
  /** Roadmap Work: the label that would leave; Released label: `Released`. */
  publicStatusLabel: string | null;
  title: string;
  /** Wall part items only. */
  wallPart: WallPartKind | null;
  workId: string | null;
}

export interface BuildInPublicPlaceholderFinding {
  context: string;
  field: string;
  itemId: string;
  name: string;
  sourceRecord: { id: string; title: string; type: string };
}

/** Publication title and summary of one surface; none inherits from another. */
export interface BuildInPublicSurfaceCopy {
  summary: string | null;
  title: string | null;
}

export interface BuildInPublicMetadata extends BuildInPublicSurfaceCopy {
  /** The changelog index page's own title and summary. */
  changelogIndex?: BuildInPublicSurfaceCopy;
  /** The Roadmap index page's own title and summary. */
  roadmapIndex?: BuildInPublicSurfaceCopy;
}

export interface BuildInPublicPreview {
  fingerprint: string;
  items: BuildInPublicItem[];
  metadata: BuildInPublicMetadata;
  notice: string;
  placeholders: BuildInPublicPlaceholderFinding[];
  /**
   * What a visitor would read differently once everything approvable is
   * approved, as exact previous and new public values. Non-empty means the
   * optional `Explain the change` is offered; the product never writes the text.
   */
  planChanges: BuildInPublicPlanChange[];
  projectId: string;
  /** The preview writes nothing and creates no surface or revision. */
  written: false;
}

export const MAX_EXPLANATION_LENGTH = 600;

const surfaceCopySchema = z
  .object({
    summary: z.string().trim().max(300).nullable().optional(),
    title: z.string().trim().max(120).nullable().optional(),
  })
  .strict();

const metadataSchema = surfaceCopySchema
  .extend({
    changelogIndex: surfaceCopySchema.optional(),
    roadmapIndex: surfaceCopySchema.optional(),
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
        approvedItemIds: z.array(identifierSchema).max(5000),
        /**
         * Default off. At most one approved Proje Sürümü or Karar, until the
         * founder-set end time. Omitted keeps the earlier choice, null clears it.
         */
        featured: z
          .object({
            endsAt: z.string().datetime(),
            recordId: identifierSchema,
          })
          .strict()
          .nullable()
          .optional(),
        /**
         * Optional founder-written note bound to this publish event. Empty or
         * omitted means none; accepted only when the publish changes a label,
         * a shown date or Roadmap membership.
         */
        explanation: z
          .string()
          .trim()
          .max(MAX_EXPLANATION_LENGTH)
          .nullable()
          .optional(),
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
  /** Presented from the internal date at approval; the date itself never leaves. */
  dueLabel?: string | null;
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

/** One approved Project Wall as a closed-world snapshot; opaque ids, no source ids. */
export interface BuildInPublicSnapshotWall {
  cards: {
    cardId: string;
    color: string | null;
    column: number;
    groupId: string | null;
    row: number;
    title: string;
  }[];
  /** Exact approved file versions with their crop, rotate and markup text. */
  files: {
    attachmentId: string;
    cardId: string | null;
    markup: string | null;
    name: string;
    version: number;
  }[];
  focusOrder: string[];
  groups: { groupId: string; title: string }[];
  lines: { fromCardId: string; label: string; toCardId: string }[];
  /** Live collection blocks frozen as dated, read-only snapshots. */
  liveBlocks: {
    blockId: string;
    frozenOn: string;
    records: { fields: BuildInPublicField[]; title: string }[];
    sourceLabel: string;
  }[];
  narrative: string | null;
  /** Private diff keys (approval item id to content); never rendered or exposed on a visitor path. */
  partSignatures: Record<string, string>;
}

export interface BuildInPublicSnapshotMember {
  /** Changelog date (YYYY-MM-DD) of a Proje Sürümü or Karar. */
  date: string | null;
  fields: BuildInPublicField[];
  kind: BuildInPublicMemberKind;
  /** Opaque (`member-1`); the only id a visitor surface may use. */
  memberId: string;
  /** Private diff key; never rendered or exposed on a visitor path. */
  sourceRecordId: string;
  title: string;
  wall?: BuildInPublicSnapshotWall;
}

export const PLAN_CHANGE_KINDS = [
  "Entered Roadmap",
  "Left Roadmap",
  "Label changed",
  "Date changed",
] as const;
export type BuildInPublicPlanChangeKind = (typeof PLAN_CHANGE_KINDS)[number];

/** A difference in what a visitor reads of the plan; public values only. */
export interface BuildInPublicPlanChange {
  /** Exact previous public value; null when nothing was shown. */
  from: string | null;
  kind: BuildInPublicPlanChangeKind;
  /** Opaque (`work-1`); never a source id. */
  memberId: string;
  /** The public title, never the internal one. */
  title: string;
  /** Exact new public value; null when nothing is shown any more. */
  to: string | null;
}

/** One entry of the public development feed: an approved change of one publish event. */
export interface BuildInPublicFeedChange {
  /** Record changelog date, when it has one. */
  date?: string | null;
  /** Plan changes carry exact public values; a record carries its kind and date. */
  from: string | null;
  kind: BuildInPublicPlanChangeKind | "Record published";
  memberId: string;
  recordKind?: BuildInPublicMemberKind;
  title: string;
  to: string | null;
}

/**
 * One founder-approved publish event. Stored in the snapshot itself, so the
 * feed is a projection of the same approved revision as Roadmap, changelog and
 * Proje view; the founder's note is bound to this event and is never generated.
 */
export interface BuildInPublicFeedEvent {
  changes: BuildInPublicFeedChange[];
  /** Opaque (`event-1`). */
  eventId: string;
  explanation: string | null;
  publishedAt: string;
}

export interface BuildInPublicSnapshot {
  approvedAt: string;
  /** At most one approved Proje Sürümü or Karar; off unless the founder set it. */
  featured?: { endsAt: string; memberId: string } | null;
  /** Approved publish events, oldest first. Absent in revisions approved before the feed existed. */
  feed?: BuildInPublicFeedEvent[];
  kind: "Build in Public";
  /** Absent in revisions approved before the Proje view existed. */
  members?: BuildInPublicSnapshotMember[];
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
  "BUILD_IN_PUBLIC_EXPLANATION_UNAVAILABLE",
  "BUILD_IN_PUBLIC_FEATURED_INVALID",
  "BUILD_IN_PUBLIC_INDEXING_UNACKNOWLEDGED",
  "BUILD_IN_PUBLIC_LABEL_REQUIRED",
  "BUILD_IN_PUBLIC_NOT_PUBLISHED",
  "BUILD_IN_PUBLIC_NOTHING_APPROVED",
  "BUILD_IN_PUBLIC_PLACEHOLDERS_UNRESOLVED",
  "BUILD_IN_PUBLIC_PREVIEW_STALE",
  "BUILD_IN_PUBLIC_REDIRECT_UNCONFIRMED",
  "BUILD_IN_PUBLIC_SLUG_TAKEN",
  "BUILD_IN_PUBLIC_WORK_UNAVAILABLE",
] as const;
export type BuildInPublicErrorCode =
  (typeof BUILD_IN_PUBLIC_ERROR_CODES)[number];

export const BUILD_IN_PUBLIC_ERROR_MESSAGES: Record<
  BuildInPublicErrorCode,
  string
> = {
  BUILD_IN_PUBLIC_DISABLED: "Enable Build in Public for this Project first.",
  BUILD_IN_PUBLIC_EXPLANATION_UNAVAILABLE:
    "Explain the change is offered only when this publish changes a label, a shown date or Roadmap membership.",
  BUILD_IN_PUBLIC_FEATURED_INVALID:
    "Feature one approved Project Release or Decision, and set an end time in the future.",
  BUILD_IN_PUBLIC_INDEXING_UNACKNOWLEDGED:
    "Acknowledge that third-party copies cannot be fully recalled before enabling indexing.",
  BUILD_IN_PUBLIC_LABEL_REQUIRED: LABEL_REQUIRED_MESSAGE,
  BUILD_IN_PUBLIC_NOT_PUBLISHED:
    "This Project has no published Build in Public.",
  BUILD_IN_PUBLIC_NOTHING_APPROVED: "Approve at least one item to publish.",
  BUILD_IN_PUBLIC_PLACEHOLDERS_UNRESOLVED:
    "Resolve the placeholders or confirm Publish/share anyway.",
  BUILD_IN_PUBLIC_PREVIEW_STALE:
    "The preview changed. Review it again before publishing.",
  BUILD_IN_PUBLIC_REDIRECT_UNCONFIRMED:
    "Changing the slug redirects the old address to the new one. Confirm the redirect first.",
  BUILD_IN_PUBLIC_SLUG_TAKEN:
    "Another published surface already uses this slug.",
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

export interface BuildInPublicAccess extends BuildInPublicPublicationAccess {
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
    input: Omit<BuildInPublicWorkCopy, "dueDatePresentation"> & {
      /** Omitted keeps `Hidden`. */
      dueDatePresentation?: DueDatePresentation;
      projectId: string;
    },
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
export function memberItemId(recordId: string) {
  return `member:${recordId}`;
}
export function wallPartItemId(
  recordId: string,
  part: WallPartKind,
  partId: string,
) {
  return `wall:${recordId}:${part}:${partId}`;
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

/* -------------------------------------------------------------------------- */
/* Development feed                                                            */
/* -------------------------------------------------------------------------- */

/**
 * What changes in the visitor's reading of the plan between two approved
 * Roadmaps. Pure: it compares the public snapshot values of both sides and
 * reads nothing internal.
 */
export function planChangesBetween(
  previous: readonly BuildInPublicSnapshotWork[],
  next: readonly BuildInPublicSnapshotWork[],
): BuildInPublicPlanChange[] {
  const before = new Map(previous.map((work) => [work.sourceWorkId, work]));
  const after = new Set(next.map((work) => work.sourceWorkId));
  const changes: BuildInPublicPlanChange[] = [];
  for (const work of next) {
    const old = before.get(work.sourceWorkId);
    if (!old) {
      changes.push({
        from: null,
        kind: "Entered Roadmap",
        memberId: work.memberId,
        title: work.title,
        to: work.publicStatusLabel,
      });
      continue;
    }
    if (old.publicStatusLabel !== work.publicStatusLabel) {
      changes.push({
        from: old.publicStatusLabel,
        kind: "Label changed",
        memberId: work.memberId,
        title: work.title,
        to: work.publicStatusLabel,
      });
    }
    if ((old.dueLabel ?? null) !== (work.dueLabel ?? null)) {
      changes.push({
        from: old.dueLabel ?? null,
        kind: "Date changed",
        memberId: work.memberId,
        title: work.title,
        to: work.dueLabel ?? null,
      });
    }
  }
  for (const old of previous) {
    if (!after.has(old.sourceWorkId)) {
      changes.push({
        from: old.publicStatusLabel,
        kind: "Left Roadmap",
        memberId: old.memberId,
        title: old.title,
        to: null,
      });
    }
  }
  return changes;
}

/**
 * The publish event of one approval, or null when it changed nothing a visitor
 * can read. Only approved snapshot values enter it: plan changes against the
 * previous approved Roadmap (none on a first publish, so the Roadmap is not
 * dumped) and records that are newly approved. Nothing is read from the
 * Workspace, and no sentence is generated.
 */
export function feedEventOf(input: {
  approvedAt: string;
  eventNumber: number;
  explanation: string | null;
  members: readonly BuildInPublicSnapshotMember[];
  previous: BuildInPublicSnapshot | undefined;
  roadmap: readonly BuildInPublicSnapshotWork[];
}): BuildInPublicFeedEvent | null {
  const known = new Set(
    (input.previous?.members ?? []).map((member) => member.sourceRecordId),
  );
  const changes: BuildInPublicFeedChange[] = [
    ...(input.previous
      ? planChangesBetween(input.previous.roadmap, input.roadmap)
      : []),
    ...input.members
      .filter((member) => !known.has(member.sourceRecordId))
      .map(
        (member): BuildInPublicFeedChange => ({
          date: member.date,
          from: null,
          kind: "Record published",
          memberId: member.memberId,
          recordKind: member.kind,
          title: member.title,
          to: null,
        }),
      ),
  ];
  if (changes.length === 0) {
    return null;
  }
  return {
    changes,
    eventId: `event-${input.eventNumber}`,
    explanation: input.explanation,
    publishedAt: input.approvedAt,
  };
}

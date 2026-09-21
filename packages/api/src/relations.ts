import { z } from "zod";

import {
  humanMutationEnvelopeSchema,
  type MutationContract,
  type MutationPayload,
} from "./mutation-and-undo";
import type { WorkStatus, WorkType } from "./work-lifecycle";

/**
 * Relation kinds are deliberately closed. A persisted relation can only use
 * one of these catalog entries; product areas may add adapters for a kind,
 * but they cannot introduce an ad-hoc user-defined kind.
 */
export const RELATION_KIND_OPTIONS = [
  "Related",
  "Origin",
  "Evidence",
  "Contributes to Goal",
  "Blocks",
  "Includes",
  "Contributes to Milestone",
  "Primary spec",
  "Supersedes",
  "Implements",
  "Belongs to Company",
  "Participant",
  "Required for completion",
] as const;

export type RelationKind = (typeof RELATION_KIND_OPTIONS)[number];

export const relationKindSchema = z.enum(RELATION_KIND_OPTIONS);

/**
 * Evidence Role is optional relation metadata. Evidence owns writing and
 * history for this field; relation consumers may read the closed catalog.
 */
export const RELATION_EVIDENCE_ROLE_OPTIONS = [
  "Supports",
  "Contradicts",
  "Provides context",
  "Inconclusive",
  "Unspecified",
] as const;

export type RelationEvidenceRole =
  (typeof RELATION_EVIDENCE_ROLE_OPTIONS)[number];

/**
 * This is the shared catalog of possible main-record endpoints. Owned
 * components such as checklist items and canvas nodes are intentionally not
 * record types here: their provenance belongs to their owning main record.
 */
export const RELATION_RECORD_TYPE_OPTIONS = [
  "Source",
  "Document",
  "Document version",
  "Capture",
  "Feedback",
  "Technical Diagram",
  "Diagram Version",
  "Work",
  "Test Session",
  "User Research Session",
  "Test Gap",
  "Decision",
  "Risk",
  "Assumption",
  "Question",
  "Open Question",
  "Test",
  "Project Release",
  "Project Goal",
  "Milestone",
  "Feature",
  "Migration Artifact",
  "GitHub external",
  "GitHub PR",
  "Contact",
  "Company",
  "Experiment/Validation",
  "Session Test",
  "File Attachment",
  "Access observation",
  "Result observation",
  "Spec",
] as const;

export type RelationRecordType = (typeof RELATION_RECORD_TYPE_OPTIONS)[number];

export const relationRecordTypeSchema = z.enum(RELATION_RECORD_TYPE_OPTIONS);

export const BROKEN_REFERENCE_REASON_OPTIONS = [
  "Archived",
  "In Trash",
  "Permanently deleted",
  "Redacted for security",
  "No access",
] as const;

export type BrokenReferenceReason =
  (typeof BROKEN_REFERENCE_REASON_OPTIONS)[number];

export const brokenReferenceReasonSchema = z.enum(
  BROKEN_REFERENCE_REASON_OPTIONS,
);

const identifierSchema = z.string().trim().min(1).max(255);

export const relationEndpointSchema = z
  .object({
    recordId: identifierSchema,
    recordType: relationRecordTypeSchema,
  })
  .strict();

export type RelationEndpoint = z.infer<typeof relationEndpointSchema>;

export type RelationEndpointGroup =
  | "any-main-record"
  | "origin-source"
  | "produced-main-record"
  | "evidence-source"
  | "evidence-target"
  | "goal-source"
  | "goal-target"
  | "blocks-source"
  | "blocks-target"
  | "feature-source"
  | "feature-target"
  | "milestone-source"
  | "milestone-target"
  | "primary-spec-source"
  | "document-version"
  | "specialist-same-type"
  | "implements-source"
  | "implements-target"
  | "company-source"
  | "company-target"
  | "participant-source"
  | "participant-target"
  | "github-pr-endpoint";

export type RelationCardinality =
  | "many-to-many"
  | "at-most-one-current"
  | "directed-acyclic";

/**
 * Live-row uniqueness enforced by the store alongside the PRD 02 cardinality
 * rules: `unique-per-source` keeps one current relation per source record,
 * `unique-per-target` one per target record. Soft-deleted rows never count.
 */
export type RelationUniqueness =
  | "many"
  | "unique-per-source"
  | "unique-per-target";

export interface RelationDefinition {
  cardinality: RelationCardinality;
  inverseLabel: string;
  sourceTypes: RelationEndpointGroup;
  targetTypes: RelationEndpointGroup;
  uniqueness: RelationUniqueness;
}

const RELATION_DEFINITIONS: Record<RelationKind, RelationDefinition> = {
  Related: {
    cardinality: "many-to-many",
    inverseLabel: "Related",
    sourceTypes: "any-main-record",
    targetTypes: "any-main-record",
    uniqueness: "many",
  },
  Origin: {
    cardinality: "many-to-many",
    inverseLabel: "Derived",
    sourceTypes: "origin-source",
    targetTypes: "produced-main-record",
    uniqueness: "many",
  },
  Evidence: {
    cardinality: "many-to-many",
    inverseLabel: "Provides evidence",
    sourceTypes: "evidence-source",
    targetTypes: "evidence-target",
    uniqueness: "many",
  },
  "Contributes to Goal": {
    cardinality: "many-to-many",
    inverseLabel: "In Goal",
    sourceTypes: "goal-source",
    targetTypes: "goal-target",
    uniqueness: "many",
  },
  Blocks: {
    cardinality: "many-to-many",
    inverseLabel: "Blocked by",
    sourceTypes: "blocks-source",
    targetTypes: "blocks-target",
    uniqueness: "many",
  },
  Includes: {
    cardinality: "at-most-one-current",
    inverseLabel: "Included in",
    sourceTypes: "feature-source",
    targetTypes: "feature-target",
    uniqueness: "unique-per-target",
  },
  "Contributes to Milestone": {
    cardinality: "many-to-many",
    inverseLabel: "In Milestone",
    sourceTypes: "milestone-source",
    targetTypes: "milestone-target",
    uniqueness: "many",
  },
  "Primary spec": {
    cardinality: "at-most-one-current",
    inverseLabel: "Primary spec",
    sourceTypes: "primary-spec-source",
    targetTypes: "document-version",
    uniqueness: "unique-per-source",
  },
  Supersedes: {
    cardinality: "directed-acyclic",
    inverseLabel: "Superseded by",
    sourceTypes: "specialist-same-type",
    targetTypes: "specialist-same-type",
    uniqueness: "many",
  },
  Implements: {
    cardinality: "many-to-many",
    inverseLabel: "Implemented by",
    sourceTypes: "implements-source",
    targetTypes: "implements-target",
    uniqueness: "many",
  },
  "Belongs to Company": {
    cardinality: "at-most-one-current",
    inverseLabel: "Belongs to Company",
    sourceTypes: "company-source",
    targetTypes: "company-target",
    uniqueness: "unique-per-source",
  },
  Participant: {
    cardinality: "at-most-one-current",
    inverseLabel: "Participant",
    sourceTypes: "participant-source",
    targetTypes: "participant-target",
    uniqueness: "unique-per-source",
  },
  "Required for completion": {
    cardinality: "many-to-many",
    inverseLabel: "Contextual",
    sourceTypes: "github-pr-endpoint",
    targetTypes: "github-pr-endpoint",
    uniqueness: "many",
  },
};

export function relationDefinition(kind: RelationKind): RelationDefinition {
  return RELATION_DEFINITIONS[kind];
}

export function relationUniqueness(kind: RelationKind): RelationUniqueness {
  return RELATION_DEFINITIONS[kind].uniqueness;
}

export function relationLabel(
  kind: RelationKind,
  direction: "outgoing" | "incoming",
): string {
  return direction === "outgoing"
    ? kind
    : relationDefinition(kind).inverseLabel;
}

const ORIGIN_SOURCE_TYPES = new Set<RelationRecordType>([
  "Source",
  "Document",
  "Capture",
  "Feedback",
  "Technical Diagram",
  "Work",
  "Test Session",
  "User Research Session",
  "Test Gap",
]);

const EVIDENCE_SOURCE_TYPES = new Set<RelationRecordType>([
  "Source",
  "Document",
  "Document version",
  "Diagram Version",
  "Feedback",
  "User Research Session",
  "Experiment/Validation",
  "Session Test",
  "File Attachment",
]);

const EVIDENCE_TARGET_TYPES = new Set<RelationRecordType>([
  "Work",
  "Decision",
  "Risk",
  "Assumption",
  "Question",
  "Open Question",
  "Test",
  "Project Release",
  "Access observation",
  "Result observation",
]);

const MAIN_RECORD_TYPES = new Set<RelationRecordType>(
  RELATION_RECORD_TYPE_OPTIONS,
);

function isSameSpecialistType(
  sourceType: RelationRecordType,
  targetType: RelationRecordType,
): boolean {
  return (
    sourceType === targetType &&
    ["Decision", "Experiment/Validation", "Session Test"].includes(sourceType)
  );
}

/**
 * Validates the catalog boundary without resolving records. Record existence,
 * account ownership, and current cardinality remain server responsibilities.
 */
export function isAllowedRelationEndpoints(
  kind: RelationKind,
  sourceType: RelationRecordType,
  targetType: RelationRecordType,
): boolean {
  switch (kind) {
    case "Related":
      return (
        MAIN_RECORD_TYPES.has(sourceType) && MAIN_RECORD_TYPES.has(targetType)
      );
    case "Origin":
      return (
        ORIGIN_SOURCE_TYPES.has(sourceType) && MAIN_RECORD_TYPES.has(targetType)
      );
    case "Evidence":
      return (
        EVIDENCE_SOURCE_TYPES.has(sourceType) &&
        EVIDENCE_TARGET_TYPES.has(targetType)
      );
    case "Contributes to Goal":
      return (
        ["Work", "Milestone", "Project Release"].includes(sourceType) &&
        targetType === "Project Goal"
      );
    case "Blocks":
      return (
        ["Work", "Decision", "Open Question"].includes(sourceType) &&
        targetType === "Work"
      );
    case "Includes":
      return sourceType === "Feature" && targetType === "Work";
    case "Contributes to Milestone":
      return sourceType === "Work" && targetType === "Milestone";
    case "Primary spec":
      return (
        ["Work", "Feature"].includes(sourceType) &&
        targetType === "Document version"
      );
    case "Supersedes":
      return isSameSpecialistType(sourceType, targetType);
    case "Implements":
      return (
        ["Work", "GitHub PR", "Project Release"].includes(sourceType) &&
        ["Decision", "Spec"].includes(targetType)
      );
    case "Belongs to Company":
      return sourceType === "Contact" && targetType === "Company";
    case "Participant":
      return (
        ["User Research Session", "Feedback"].includes(sourceType) &&
        targetType === "Contact"
      );
    case "Required for completion":
      return (
        (sourceType === "Work" && targetType === "GitHub PR") ||
        (sourceType === "GitHub PR" && targetType === "Work")
      );
    default:
      return false;
  }
}

export const relationCreatePreviewInputSchema = z
  .object({
    kind: relationKindSchema,
    source: relationEndpointSchema,
    target: relationEndpointSchema,
  })
  .strict();

export type RelationCreatePreviewInput = z.infer<
  typeof relationCreatePreviewInputSchema
>;

export const relationCreateInputSchema = humanMutationEnvelopeSchema
  .extend({
    kind: relationKindSchema,
    previewId: identifierSchema,
    source: relationEndpointSchema,
    target: relationEndpointSchema,
  })
  .strict();

export type RelationCreateInput = z.infer<typeof relationCreateInputSchema>;

export const relationsInputSchema = z
  .object({
    recordId: identifierSchema,
    recordType: relationRecordTypeSchema,
  })
  .strict();

export const removeRelationInputSchema = humanMutationEnvelopeSchema
  .extend({
    relationId: identifierSchema,
  })
  .strict();

export const undoRelationInputSchema = humanMutationEnvelopeSchema
  .extend({
    receiptId: identifierSchema,
    relationId: identifierSchema,
  })
  .strict();

export type RelationsInput = z.infer<typeof relationsInputSchema>;
export type RemoveRelationInput = z.infer<typeof removeRelationInputSchema>;
export type UndoRelationInput = z.infer<typeof undoRelationInputSchema>;

/**
 * Usage links are the closed set of embed-derived bindings from PRD 02
 * (kullanim baglari). They are not semantic relations, never carry Evidence
 * Role, and never count as relation backlinks. Embed features write them
 * through the Relations store instead of growing a second graph.
 */
export const RELATION_USAGE_KIND_OPTIONS = [
  // Keep this catalog shared by the Relations adapter and the standalone
  // Usage Links store exposed below.
  "Inline reference",
  "Section reference",
  "Live block",
  "Pinned bind",
  "Screen reference",
] as const;

export const USAGE_LINK_KIND_OPTIONS = RELATION_USAGE_KIND_OPTIONS;

export type RelationUsageKind = (typeof RELATION_USAGE_KIND_OPTIONS)[number];

export const relationUsageKindSchema = z.enum(RELATION_USAGE_KIND_OPTIONS);

export const relationUsageSurfaceSchema = z
  .object({
    context: z.string().trim().min(1).max(255).nullish(),
    recordId: identifierSchema,
    recordType: relationRecordTypeSchema,
  })
  .strict();

export const relationUsageCreateInputSchema = z
  .object({
    kind: relationUsageKindSchema,
    source: relationEndpointSchema,
    surface: relationUsageSurfaceSchema,
  })
  .strict();

export const relationUsageRemoveInputSchema = z
  .object({ usageLinkId: identifierSchema })
  .strict();

export type RelationUsageCreateInput = z.infer<
  typeof relationUsageCreateInputSchema
>;
export type RelationUsageRemoveInput = z.infer<
  typeof relationUsageRemoveInputSchema
>;

/**
 * Immutable provenance carried by a main record whose Origin is an owned
 * component (checklist item, Wireframe node, Session Test). The owned
 * component never becomes an independent relation end.
 */
export interface RelationOriginPosition {
  componentId: string;
  ownerRecordId: string;
  sourceVersion: string | null;
}

export interface BrokenReferenceView {
  canOpenSourceRecord: boolean;
  establishedAt: string;
  reason: BrokenReferenceReason;
}

export interface RelationEndpointView extends RelationEndpoint {
  broken: BrokenReferenceView | null;
  key: string | null;
  label: string | null;
  originPosition: RelationOriginPosition | null;
  projectId: string | null;
  status: WorkStatus | null;
  title: string | null;
  url?: string | null;
  workType: WorkType | null;
}

export interface RelationView {
  createdAt: string;
  direction: "incoming" | "outgoing";
  evidenceRole?: RelationEvidenceRole;
  id: string;
  inverseLabel: string;
  kind: RelationKind;
  label: string;
  revision: number;
  source: RelationEndpointView;
  target: RelationEndpointView;
}

export interface RelationPreview {
  baseRevision: number;
  id: string;
  inverseLabel: string;
  kind: RelationKind;
  label: string;
  previewId: string;
  source: RelationEndpointView;
  target: RelationEndpointView;
}

export interface StoredRelationValue extends Record<string, MutationPayload> {
  createdAt: string;
  id: string;
  kind: RelationKind;
  sourceRecordId: string;
  sourceRecordType: RelationRecordType;
  targetLabel: string;
  targetProjectId: string;
  targetRecordId: string;
  targetRecordType: RelationRecordType;
}

/**
 * The relation facts carried inside a mutation payload. Wall-clock fields are
 * excluded so payload fingerprints stay deterministic across retries. The
 * index signature keeps the payload assignable to the mutation JSON envelope.
 */
export interface RelationPayloadRelation
  extends Record<string, MutationPayload> {
  id: string;
  kind: RelationKind;
  sourceRecordId: string;
  sourceRecordType: RelationRecordType;
  targetLabel: string;
  targetProjectId: string;
  targetRecordId: string;
  targetRecordType: RelationRecordType;
}

export interface RelationMutationValue extends Record<string, MutationPayload> {
  relation: StoredRelationValue | null;
}

export interface RelationMutationResult {
  receiptId: string;
  relation: RelationView | null;
  relationId: string;
}

export interface UsedInSummary {
  relationBacklinks: RelationView[];
  usageLinks: RelationUsageView[];
}

export interface RelationsAccess {
  create: (
    accountId: string,
    input: RelationCreateInput,
  ) => Promise<RelationMutationResult>;
  createUsageLink: (
    accountId: string,
    input: RelationUsageCreateInput,
  ) => Promise<RelationUsageView>;
  list: (accountId: string, input: RelationsInput) => Promise<RelationView[]>;
  listUsageLinks: (
    accountId: string,
    input: RelationsInput,
  ) => Promise<RelationUsageView[]>;
  listUsedIn: (
    accountId: string,
    input: RelationsInput,
  ) => Promise<UsedInSummary>;
  previewCreate: (
    accountId: string,
    input: RelationCreatePreviewInput,
  ) => Promise<RelationPreview>;
  remove: (
    accountId: string,
    input: RemoveRelationInput,
  ) => Promise<RelationMutationResult>;
  removeUsageLink: (
    accountId: string,
    input: RelationUsageRemoveInput,
  ) => Promise<void>;
  undo: (
    accountId: string,
    input: UndoRelationInput,
  ) => Promise<RelationMutationResult>;
}

export interface RelationUsageView {
  createdAt: string;
  id: string;
  kind: RelationUsageKind;
  source: RelationEndpoint;
  surface: RelationEndpointView;
}

export type UsageLinkKind = (typeof USAGE_LINK_KIND_OPTIONS)[number];

export const usageLinkKindSchema = z.enum(USAGE_LINK_KIND_OPTIONS);

/**
 * Usage link ends are closed to the record types that exist in the domain
 * today. The change that introduces a new record type or usage surface
 * extends this catalog, mirroring the usage-kind contract above.
 */
export const USAGE_LINK_RECORD_TYPE_OPTIONS = [
  "Assumption",
  "Decision",
  "Document",
  "Feedback",
  "Milestone",
  "Planned Test Scenario",
  "Production Incident",
  "Project Release",
  "Risk",
  "Test Gap",
  "Test Handoff",
  "Test Session",
  "User Research Session",
  "Work",
] as const;

export const usageLinkRecordTypeSchema = z.enum(USAGE_LINK_RECORD_TYPE_OPTIONS);

export const usageLinkEndpointSchema = z
  .object({
    recordId: identifierSchema,
    recordType: usageLinkRecordTypeSchema,
  })
  .strict();

/** Positional metadata only; source content and lifecycle values are not stored. */
export const usageLinkLocationSchema = z.json();

export const usageLinkPayloadSchema = z
  .object({
    kind: usageLinkKindSchema,
    location: usageLinkLocationSchema.optional(),
    source: usageLinkEndpointSchema,
    surface: usageLinkEndpointSchema,
  })
  .strict();

export type UsageLinkPayload = z.output<typeof usageLinkPayloadSchema>;

export const usageLinkSchema = usageLinkPayloadSchema
  .extend({
    createdAt: z.string().datetime({ offset: true }),
    id: identifierSchema,
    revision: z.number().int().positive().safe(),
  })
  .strict();

export type UsageLink = z.output<typeof usageLinkSchema>;

export const createUsageLinkMutationInputSchema =
  humanMutationEnvelopeSchema.extend(usageLinkPayloadSchema.shape);

export type CreateUsageLinkMutationInput = z.input<
  typeof createUsageLinkMutationInputSchema
>;

export const listUsageLinksInputSchema = z
  .object({ source: usageLinkEndpointSchema })
  .strict();

export type ListUsageLinksInput = z.output<typeof listUsageLinksInputSchema>;

export const unlinkUsageLinkInputSchema = humanMutationEnvelopeSchema.extend({
  usageLinkId: identifierSchema,
});

export type UnlinkUsageLinkInput = z.output<typeof unlinkUsageLinkInputSchema>;

export interface UsageLinksAccess {
  create: (accountId: string, input: UsageLinkPayload) => Promise<UsageLink>;
  find: (accountId: string, usageLinkId: string) => Promise<UsageLink | null>;
  listBySource: (
    accountId: string,
    source: UsageLinkPayload["source"],
  ) => Promise<UsageLink[]>;
  unlink: (accountId: string, usageLinkId: string) => Promise<boolean>;
}

export interface UsageLinkMutationValue {
  usageLink: UsageLink | null;
}

export type UsageLinkMutationContract =
  MutationContract<UsageLinkMutationValue>;

export interface UsageLinkMutationContracts {
  create: (accountId: string) => UsageLinkMutationContract;
  unlink: (accountId: string) => UsageLinkMutationContract;
}

import { z } from "zod";

import {
  humanMutationEnvelopeSchema,
  type MutationPayload,
} from "./mutation-and-undo";

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

export interface RelationDefinition {
  cardinality: RelationCardinality;
  inverseLabel: string;
  sourceTypes: RelationEndpointGroup;
  targetTypes: RelationEndpointGroup;
}

const RELATION_DEFINITIONS: Record<RelationKind, RelationDefinition> = {
  Related: {
    cardinality: "many-to-many",
    inverseLabel: "Related",
    sourceTypes: "any-main-record",
    targetTypes: "any-main-record",
  },
  Origin: {
    cardinality: "many-to-many",
    inverseLabel: "Derived",
    sourceTypes: "origin-source",
    targetTypes: "produced-main-record",
  },
  Evidence: {
    cardinality: "many-to-many",
    inverseLabel: "Provides evidence",
    sourceTypes: "evidence-source",
    targetTypes: "evidence-target",
  },
  "Contributes to Goal": {
    cardinality: "many-to-many",
    inverseLabel: "In Goal",
    sourceTypes: "goal-source",
    targetTypes: "goal-target",
  },
  Blocks: {
    cardinality: "many-to-many",
    inverseLabel: "Blocked by",
    sourceTypes: "blocks-source",
    targetTypes: "blocks-target",
  },
  Includes: {
    cardinality: "at-most-one-current",
    inverseLabel: "Included in",
    sourceTypes: "feature-source",
    targetTypes: "feature-target",
  },
  "Contributes to Milestone": {
    cardinality: "many-to-many",
    inverseLabel: "In Milestone",
    sourceTypes: "milestone-source",
    targetTypes: "milestone-target",
  },
  "Primary spec": {
    cardinality: "at-most-one-current",
    inverseLabel: "Primary spec",
    sourceTypes: "primary-spec-source",
    targetTypes: "document-version",
  },
  Supersedes: {
    cardinality: "directed-acyclic",
    inverseLabel: "Superseded by",
    sourceTypes: "specialist-same-type",
    targetTypes: "specialist-same-type",
  },
  Implements: {
    cardinality: "many-to-many",
    inverseLabel: "Implemented by",
    sourceTypes: "implements-source",
    targetTypes: "implements-target",
  },
  "Belongs to Company": {
    cardinality: "at-most-one-current",
    inverseLabel: "Belongs to Company",
    sourceTypes: "company-source",
    targetTypes: "company-target",
  },
  Participant: {
    cardinality: "at-most-one-current",
    inverseLabel: "Participant",
    sourceTypes: "participant-source",
    targetTypes: "participant-target",
  },
  "Required for completion": {
    cardinality: "many-to-many",
    inverseLabel: "Contextual",
    sourceTypes: "github-pr-endpoint",
    targetTypes: "github-pr-endpoint",
  },
};

export function relationDefinition(kind: RelationKind): RelationDefinition {
  return RELATION_DEFINITIONS[kind];
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

export interface BrokenReferenceView {
  canOpenSourceRecord: boolean;
  establishedAt: string;
  reason: BrokenReferenceReason;
}

export interface RelationEndpointView extends RelationEndpoint {
  broken: BrokenReferenceView | null;
  key: string | null;
  label: string | null;
  projectId: string | null;
  title: string | null;
}

export interface RelationView {
  createdAt: string;
  direction: "incoming" | "outgoing";
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

export interface RelationMutationValue extends Record<string, MutationPayload> {
  relation: StoredRelationValue | null;
}

export interface RelationMutationResult {
  receiptId: string;
  relation: RelationView | null;
  relationId: string;
}

export interface RelationsAccess {
  create: (
    accountId: string,
    input: RelationCreateInput,
  ) => Promise<RelationMutationResult>;
  list: (accountId: string, input: RelationsInput) => Promise<RelationView[]>;
  previewCreate: (
    accountId: string,
    input: RelationCreatePreviewInput,
  ) => Promise<RelationPreview>;
  remove: (
    accountId: string,
    input: RemoveRelationInput,
  ) => Promise<RelationMutationResult>;
  undo: (
    accountId: string,
    input: UndoRelationInput,
  ) => Promise<RelationMutationResult>;
}

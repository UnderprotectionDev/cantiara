import { z } from "zod";

import type { FileAttachmentLocation } from "./file-attachments";
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

export const BLOCKING_RELATION_STATUS_OPTIONS = ["Active", "Resolved"] as const;

export type BlockingRelationStatus =
  (typeof BLOCKING_RELATION_STATUS_OPTIONS)[number];

export const blockingRelationStatusSchema = z.enum(
  BLOCKING_RELATION_STATUS_OPTIONS,
);

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
 * rules: `unique-per-pair` prevents duplicate directed endpoint pairs,
 * `unique-per-source` keeps one current relation per source record, and
 * `unique-per-target` one per target record. Soft-deleted rows never count.
 */
export type RelationUniqueness =
  | "many"
  | "unique-per-pair"
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
    uniqueness: "unique-per-pair",
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

export const resolveBlockerInputSchema = humanMutationEnvelopeSchema
  .extend({
    note: z.string().trim().max(1000).optional(),
    relationId: identifierSchema,
  })
  .strict();

export const reactivateBlockerInputSchema = removeRelationInputSchema;

export const undoRelationInputSchema = humanMutationEnvelopeSchema
  .extend({
    receiptId: identifierSchema,
    relationId: identifierSchema,
  })
  .strict();

export type RelationsInput = z.infer<typeof relationsInputSchema>;
export type RemoveRelationInput = z.infer<typeof removeRelationInputSchema>;
export type ResolveBlockerInput = z.infer<typeof resolveBlockerInputSchema>;
export type ReactivateBlockerInput = z.infer<
  typeof reactivateBlockerInputSchema
>;
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
  location?: FileAttachmentLocation;
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
  /** Relative app path supplied by the owning record resolver when it exists. */
  openPath?: string | null;
  originPosition: RelationOriginPosition | null;
  projectId: string | null;
  status: WorkStatus | null;
  title: string | null;
  url?: string | null;
  workType: WorkType | null;
}

export interface RelationView {
  blockingHistory: BlockingRelationHistoryEntry[];
  blockingResolutionNote: string | null;
  blockingResolvedAt: string | null;
  blockingStatus: BlockingRelationStatus | null;
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

export interface WorkDependencyEdge {
  blocked: RelationEndpointView;
  blocker: RelationEndpointView;
  relationId: string;
  status: BlockingRelationStatus;
}

export interface WorkDependencyCycle {
  edges: WorkDependencyEdge[];
  records: RelationEndpointView[];
}

export interface WorkDependenciesProjection {
  cycles: WorkDependencyCycle[];
  edges: WorkDependencyEdge[];
  nodes: RelationEndpointView[];
}

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function relationEndpointKey(endpoint: RelationEndpoint): string {
  return JSON.stringify([endpoint.recordType, endpoint.recordId]);
}

function compareRelationEndpoints(
  left: RelationEndpointView,
  right: RelationEndpointView,
): number {
  return (
    compareText(left.recordType, right.recordType) ||
    compareText(left.recordId, right.recordId)
  );
}

interface WorkDependencyGraph {
  incoming: Map<string, Set<string>>;
  outgoing: Map<string, Set<string>>;
  records: Map<string, RelationEndpointView>;
}

interface DependencyDfsFrame {
  neighbors: string[];
  nextNeighborIndex: number;
  recordKey: string;
}

function setIfMissing<T>(map: Map<string, Set<T>>, key: string): void {
  if (!map.has(key)) {
    map.set(key, new Set());
  }
}

function addDependencyEdgeToGraph(
  graph: WorkDependencyGraph,
  edge: WorkDependencyEdge,
): void {
  const blockerKey = relationEndpointKey(edge.blocker);
  const blockedKey = relationEndpointKey(edge.blocked);
  graph.records.set(blockerKey, edge.blocker);
  graph.records.set(blockedKey, edge.blocked);
  setIfMissing(graph.outgoing, blockerKey);
  setIfMissing(graph.outgoing, blockedKey);
  setIfMissing(graph.incoming, blockerKey);
  setIfMissing(graph.incoming, blockedKey);
  graph.outgoing.get(blockerKey)?.add(blockedKey);
  graph.incoming.get(blockedKey)?.add(blockerKey);
}

function workDependencyGraph(edges: WorkDependencyEdge[]): WorkDependencyGraph {
  const records = new Map<string, RelationEndpointView>();
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();
  const graph = { incoming, outgoing, records };
  for (const edge of edges) {
    addDependencyEdgeToGraph(graph, edge);
  }
  return graph;
}

function depthFirstFinishOrder(outgoing: Map<string, Set<string>>): string[] {
  const visited = new Set<string>();
  const finishOrder: string[] = [];
  for (const root of [...outgoing.keys()].sort(compareText)) {
    if (visited.has(root)) {
      continue;
    }
    visited.add(root);
    const stack: DependencyDfsFrame[] = [dependencyDfsFrame(root, outgoing)];
    while (stack.length > 0) {
      const frame = stack.at(-1);
      if (!frame) {
        break;
      }
      const neighbor = frame.neighbors[frame.nextNeighborIndex];
      if (neighbor === undefined) {
        finishOrder.push(frame.recordKey);
        stack.pop();
        continue;
      }
      frame.nextNeighborIndex += 1;
      if (visited.has(neighbor)) {
        continue;
      }
      visited.add(neighbor);
      stack.push(dependencyDfsFrame(neighbor, outgoing));
    }
  }
  return finishOrder;
}

function dependencyDfsFrame(
  recordKey: string,
  outgoing: Map<string, Set<string>>,
): DependencyDfsFrame {
  return {
    neighbors: [...(outgoing.get(recordKey) ?? [])].sort(compareText),
    nextNeighborIndex: 0,
    recordKey,
  };
}

function stronglyConnectedComponents(
  incoming: Map<string, Set<string>>,
  finishOrder: string[],
): string[][] {
  const assigned = new Set<string>();
  const components: string[][] = [];
  for (let index = finishOrder.length - 1; index >= 0; index -= 1) {
    const root = finishOrder[index];
    if (root === undefined || assigned.has(root)) {
      continue;
    }
    assigned.add(root);
    const component: string[] = [];
    const stack = [root];
    while (stack.length > 0) {
      const recordKey = stack.pop();
      if (recordKey === undefined) {
        continue;
      }
      component.push(recordKey);
      for (const blocker of incoming.get(recordKey) ?? []) {
        if (!assigned.has(blocker)) {
          assigned.add(blocker);
          stack.push(blocker);
        }
      }
    }
    components.push(component);
  }
  return components;
}

function isDependencyCycle(
  component: string[],
  outgoing: Map<string, Set<string>>,
): boolean {
  const [onlyRecord] = component;
  return (
    component.length > 1 ||
    (onlyRecord !== undefined &&
      (outgoing.get(onlyRecord)?.has(onlyRecord) ?? false))
  );
}

function dependencyCycle(
  component: string[],
  records: Map<string, RelationEndpointView>,
): WorkDependencyCycle {
  const componentRecords = component
    .map((key) => records.get(key))
    .filter((record): record is RelationEndpointView => record !== undefined)
    .sort(compareRelationEndpoints);
  return { edges: [], records: componentRecords };
}

function compareDependencyCycles(
  left: WorkDependencyCycle,
  right: WorkDependencyCycle,
): number {
  const [leftFirst] = left.records;
  const [rightFirst] = right.records;
  if (leftFirst && rightFirst) {
    return compareRelationEndpoints(leftFirst, rightFirst);
  }
  return left.records.length - right.records.length;
}

function dependencyCycles(edges: WorkDependencyEdge[]): WorkDependencyCycle[] {
  const graph = workDependencyGraph(edges);
  const finishOrder = depthFirstFinishOrder(graph.outgoing);
  const components = stronglyConnectedComponents(graph.incoming, finishOrder);
  const cycles = components
    .filter((component) => isDependencyCycle(component, graph.outgoing))
    .map((component) => dependencyCycle(component, graph.records));
  const cycleByRecord = new Map<string, WorkDependencyCycle>();
  for (const cycle of cycles) {
    for (const record of cycle.records) {
      cycleByRecord.set(relationEndpointKey(record), cycle);
    }
  }
  for (const edge of edges) {
    const cycle = cycleByRecord.get(relationEndpointKey(edge.blocker));
    if (cycle === cycleByRecord.get(relationEndpointKey(edge.blocked))) {
      cycle?.edges.push(edge);
    }
  }
  return cycles.sort(compareDependencyCycles);
}

/**
 * Projects only existing blocking relations. Edges point from blocker to
 * blocked Work; cycles retain the Active or Resolved status of every edge so
 * consumers can explain the state of each relation in a cycle.
 */
export function projectWorkDependencies(
  relations: readonly RelationView[],
): WorkDependenciesProjection {
  const edgeById = new Map<string, WorkDependencyEdge>();
  for (const relation of relations) {
    if (
      relation.kind === "Blocks" &&
      (relation.blockingStatus === "Active" ||
        relation.blockingStatus === "Resolved") &&
      !edgeById.has(relation.id)
    ) {
      edgeById.set(relation.id, {
        blocked: relation.target,
        blocker: relation.source,
        relationId: relation.id,
        status: relation.blockingStatus,
      });
    }
  }

  const edges = [...edgeById.values()].sort((left, right) =>
    compareText(left.relationId, right.relationId),
  );

  const nodesByKey = new Map<string, RelationEndpointView>();
  for (const edge of edges) {
    nodesByKey.set(relationEndpointKey(edge.blocker), edge.blocker);
    nodesByKey.set(relationEndpointKey(edge.blocked), edge.blocked);
  }

  return {
    cycles: dependencyCycles(edges),
    edges,
    nodes: [...nodesByKey.values()].sort(compareRelationEndpoints),
  };
}

export interface BlockingRelationHistoryEntry {
  id: string;
  isUndo: boolean;
  note: string | null;
  occurredAt: string;
  resolutionAt: string | null;
  status: BlockingRelationStatus;
}

export interface RelationPreview {
  baseRevision: number;
  blockingStatus: BlockingRelationStatus | null;
  id: string;
  inverseLabel: string;
  kind: RelationKind;
  label: string;
  previewId: string;
  source: RelationEndpointView;
  target: RelationEndpointView;
}

export interface StoredRelationValue extends Record<string, MutationPayload> {
  blockingResolutionNote: string | null;
  blockingResolvedAt: string | null;
  blockingStatus: BlockingRelationStatus | null;
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
  blockingResolutionNote: string | null;
  blockingResolvedAt: string | null;
  blockingStatus: BlockingRelationStatus | null;
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
  signals: WorkBlockedSignal[];
}

export interface WorkBlockedSignal {
  blockedWork: { recordId: string; recordType: "Work" };
  eventId: string;
  kind: "work-blocked";
  occurredAt: string;
  relationId: string;
  source: RelationEndpoint;
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
  reactivateBlocker: (
    accountId: string,
    input: ReactivateBlockerInput,
  ) => Promise<RelationMutationResult>;
  remove: (
    accountId: string,
    input: RemoveRelationInput,
  ) => Promise<RelationMutationResult>;
  removeUsageLink: (
    accountId: string,
    input: RelationUsageRemoveInput,
  ) => Promise<void>;
  resolveBlocker: (
    accountId: string,
    input: ResolveBlockerInput,
  ) => Promise<RelationMutationResult>;
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

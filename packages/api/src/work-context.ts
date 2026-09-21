import type {
  RelationEndpointView,
  RelationKind,
  RelationRecordType,
  RelationView,
} from "./relations";
import type { WorkProfile, WorkStatus, WorkType } from "./work-lifecycle";

export const WORK_CONTEXT_INITIAL_FIELDS = [
  "Title",
  "Type",
  "Status",
  "Planning",
] as const;

export type WorkContextInitialField =
  (typeof WORK_CONTEXT_INITIAL_FIELDS)[number];

export type PreparedWorkContextSection =
  | "Affected Releases"
  | "Current Situation"
  | "Decisions"
  | "Dependencies"
  | "Description"
  | "Evidence"
  | "Evidence & Decisions"
  | "Expected Outcome"
  | "GitHub & Tests"
  | "Included Work"
  | "Problem/Opportunity"
  | "Related Work"
  | "Research Question"
  | "Risks & Open Questions"
  | "Sources & Evidence"
  | "Target Release"
  | "Observed/Expected Behavior";

export const PREPARED_WORK_CONTEXT_SECTIONS = {
  Bug: [
    "Observed/Expected Behavior",
    "Affected Releases",
    "Evidence",
    "GitHub & Tests",
  ],
  Feature: [
    "Problem/Opportunity",
    "Expected Outcome",
    "Evidence & Decisions",
    "Risks & Open Questions",
    "Included Work",
    "GitHub & Tests",
    "Target Release",
  ],
  Improvement: [
    "Current Situation",
    "Expected Outcome",
    "Evidence",
    "GitHub & Tests",
  ],
  Research: [
    "Research Question",
    "Sources & Evidence",
    "Decisions",
    "Related Work",
  ],
  Task: ["Description", "Dependencies", "GitHub & Tests", "Target Release"],
} as const satisfies Record<WorkType, readonly PreparedWorkContextSection[]>;

export interface PreparedWorkContextLayout {
  initialFields: typeof WORK_CONTEXT_INITIAL_FIELDS;
  sections: readonly PreparedWorkContextSection[];
}

export function getPreparedWorkContextLayout(
  workType: WorkType,
): PreparedWorkContextLayout {
  return {
    initialFields: WORK_CONTEXT_INITIAL_FIELDS,
    sections: PREPARED_WORK_CONTEXT_SECTIONS[workType],
  };
}

export function nextPreparedWorkContextSection(
  workType: WorkType,
  visibleSections: readonly PreparedWorkContextSection[],
) {
  return (
    getPreparedWorkContextLayout(workType).sections.find(
      (section) => !visibleSections.includes(section),
    ) ?? null
  );
}

export const WORK_CONTEXT_SOURCE_RELATION_KINDS = [
  "Blocks",
  "Contributes to Goal",
  "Evidence",
  "Implements",
  "Includes",
  "Origin",
  "Primary spec",
  "Required for completion",
] as const satisfies readonly RelationKind[];

type WorkContextSourceRelationKind =
  (typeof WORK_CONTEXT_SOURCE_RELATION_KINDS)[number];

const WORK_CONTEXT_SOURCE_RECORD_TYPES = new Set<RelationRecordType>([
  "Assumption",
  "Decision",
  "Document",
  "Document version",
  "Experiment/Validation",
  "Feature",
  "Feedback",
  "GitHub external",
  "GitHub PR",
  "Open Question",
  "Project Goal",
  "Project Release",
  "Question",
  "Risk",
  "Session Test",
  "Source",
  "Spec",
  "Test",
  "Test Gap",
  "Test Session",
  "User Research Session",
  "Work",
]);

const WORK_CONTEXT_EVIDENCE_RECORD_TYPES = new Set<RelationRecordType>([
  "Document",
  "Document version",
  "Experiment/Validation",
  "Feedback",
  "Session Test",
  "Source",
  "Test Session",
  "User Research Session",
]);

export interface WorkContextSource {
  broken: RelationEndpointView["broken"];
  id: string;
  key: string | null;
  label: string;
  projectId: string | null;
  recordId: string;
  recordType: RelationRecordType;
  relationId: string | null;
  relationKind: WorkContextSourceRelationKind | null;
  status: WorkStatus | null;
  title: string | null;
  workType: WorkType | null;
}

export interface WorkContextModel {
  sources: readonly WorkContextSource[];
  whyChain: readonly WorkContextSource[];
}

export interface BuildWorkContextModelInput {
  projectWorks?: readonly WorkProfile[];
  relations: readonly RelationView[];
  work: WorkProfile;
}

/**
 * Derives the card's live sources from the Work and its existing direct
 * relations. This is intentionally a projection: it never creates a record,
 * relation, copied body, score, or completeness judgement.
 */
export function buildWorkContextModel({
  projectWorks = [],
  relations,
  work,
}: BuildWorkContextModelInput): WorkContextModel {
  const sources: WorkContextSource[] = [];

  if (work.primaryFeatureId) {
    const feature = projectWorks.find(
      (candidate) =>
        candidate.id === work.primaryFeatureId && candidate.type === "Feature",
    );
    sources.push(
      feature
        ? sourceFromWork("Primary Feature", feature)
        : unavailableSource(
            "Primary Feature",
            work.primaryFeatureId,
            "Work",
            work.updatedAt,
          ),
    );
  }

  if (work.primarySpecId) {
    sources.push(
      unavailableSource(
        "Primary spec",
        work.primarySpecId,
        "Spec",
        work.updatedAt,
      ),
    );
  }

  for (const relation of relations) {
    const relationKind = relationKindFromRelation(relation.kind);
    if (!(relationKind && hasSupportedRelatedEndpoint(relation, work.id))) {
      continue;
    }

    const endpoint = relatedEndpoint(relation, work.id);
    if (!endpoint) {
      continue;
    }

    sources.push(sourceFromRelation(relation, endpoint));
  }

  const uniqueSources = deduplicateSources(sources);
  return {
    sources: uniqueSources,
    whyChain: uniqueSources
      .filter(isWhyChainSource)
      .sort(compareWhyChainSources),
  };
}

export function sourcesForWorkContextSection(
  section: PreparedWorkContextSection,
  sources: readonly WorkContextSource[],
): readonly WorkContextSource[] {
  return sources.filter((source) => {
    switch (section) {
      case "Affected Releases":
      case "Target Release":
        return source.recordType === "Project Release";
      case "Dependencies":
        return source.relationKind === "Blocks";
      case "Decisions":
      case "Evidence & Decisions":
        return (
          source.recordType === "Decision" ||
          (section === "Evidence & Decisions" && isEvidenceSource(source))
        );
      case "Evidence":
        return isEvidenceSource(source);
      case "GitHub & Tests":
        return (
          source.recordType === "GitHub external" ||
          source.recordType === "GitHub PR" ||
          source.recordType === "Session Test" ||
          source.recordType === "Test" ||
          source.recordType === "Test Gap" ||
          source.recordType === "Test Session"
        );
      case "Included Work":
        return source.relationKind === "Includes";
      case "Related Work":
        return source.recordType === "Work";
      case "Risks & Open Questions":
        return (
          source.recordType === "Assumption" ||
          source.recordType === "Open Question" ||
          source.recordType === "Question" ||
          source.recordType === "Risk"
        );
      case "Sources & Evidence":
        return (
          isEvidenceSource(source) ||
          source.recordType === "Experiment/Validation" ||
          source.recordType === "Feedback" ||
          source.recordType === "Source" ||
          source.recordType === "User Research Session"
        );
      default:
        return false;
    }
  });
}

function isEvidenceSource(source: WorkContextSource) {
  return (
    source.relationKind === "Evidence" &&
    WORK_CONTEXT_EVIDENCE_RECORD_TYPES.has(source.recordType)
  );
}

function relationKindFromRelation(
  kind: RelationKind,
): WorkContextSourceRelationKind | null {
  return (WORK_CONTEXT_SOURCE_RELATION_KINDS as readonly string[]).includes(
    kind,
  )
    ? (kind as WorkContextSourceRelationKind)
    : null;
}

function hasSupportedRelatedEndpoint(relation: RelationView, workId: string) {
  const endpoint = relatedEndpoint(relation, workId);
  return endpoint ? isSupportedSourceRecordType(endpoint.recordType) : false;
}

function isSupportedSourceRecordType(recordType: RelationRecordType) {
  return WORK_CONTEXT_SOURCE_RECORD_TYPES.has(recordType);
}

function relatedEndpoint(
  relation: RelationView,
  workId: string,
): RelationEndpointView | null {
  if (relation.source.recordId === workId) {
    return relation.target;
  }
  if (relation.target.recordId === workId) {
    return relation.source;
  }
  return null;
}

function sourceFromRelation(
  relation: RelationView,
  endpoint: RelationEndpointView,
): WorkContextSource {
  const relationKind = relationKindFromRelation(relation.kind);
  if (!relationKind) {
    throw new Error(`Unsupported Work Context relation: ${relation.kind}`);
  }
  return {
    broken: endpoint.broken,
    id: `relation:${relation.id}`,
    key: endpoint.key,
    label: sourceLabel(relationKind, endpoint),
    projectId: endpoint.projectId,
    recordId: endpoint.recordId,
    recordType: endpoint.recordType,
    relationId: relation.id,
    relationKind,
    status: endpoint.status,
    title: endpoint.title,
    workType: endpoint.workType,
  };
}

function sourceFromWork(label: string, work: WorkProfile): WorkContextSource {
  return {
    broken: null,
    id: `work:${work.id}`,
    key: work.key,
    label,
    projectId: work.projectId,
    recordId: work.id,
    recordType: "Work",
    relationId: null,
    relationKind: null,
    status: work.status,
    title: work.title,
    workType: work.type,
  };
}

function unavailableSource(
  label: string,
  recordId: string,
  recordType: RelationRecordType,
  establishedAt: string,
): WorkContextSource {
  return {
    broken: {
      canOpenSourceRecord: false,
      establishedAt,
      reason: "No access",
    },
    id: `${label}:${recordId}`,
    key: null,
    label,
    projectId: null,
    recordId,
    recordType,
    relationId: null,
    relationKind: null,
    status: null,
    title: null,
    workType: null,
  };
}

function sourceLabel(
  relationKind: WorkContextSourceRelationKind,
  endpoint: RelationEndpointView,
) {
  if (
    relationKind === "Origin" &&
    endpoint.recordType === "Work" &&
    endpoint.workType === "Research"
  ) {
    return "Origin Research";
  }
  if (
    relationKind === "Includes" &&
    (endpoint.recordType === "Feature" || endpoint.workType === "Feature")
  ) {
    return "Primary Feature";
  }
  if (relationKind === "Primary spec") {
    return "Primary spec";
  }
  return endpoint.recordType;
}

function isWhyChainSource(source: WorkContextSource) {
  return (
    source.label === "Project Goal" ||
    source.label === "Origin Research" ||
    source.label === "Primary Feature" ||
    source.label === "Primary spec" ||
    source.recordType === "Decision" ||
    source.recordType === "GitHub PR"
  );
}

function deduplicateSources(sources: readonly WorkContextSource[]) {
  const uniqueSources = new Map<string, WorkContextSource>();
  for (const source of sources) {
    const key = `${source.recordType}:${source.recordId}`;
    const current = uniqueSources.get(key);
    if (!current || (current.broken && !source.broken)) {
      uniqueSources.set(key, source);
    }
  }
  return [...uniqueSources.values()];
}

function compareWhyChainSources(
  left: WorkContextSource,
  right: WorkContextSource,
) {
  return sourcePriority(left) - sourcePriority(right);
}

function sourcePriority(source: WorkContextSource) {
  switch (source.label) {
    case "Project Goal":
      return 0;
    case "Origin Research":
      return 1;
    case "Primary Feature":
      return 2;
    case "Primary spec":
      return 3;
    default:
      return 4;
  }
}

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
  "Belongs to Company",
  "Blocks",
  "Contributes to Goal",
  "Contributes to Milestone",
  "Evidence",
  "Implements",
  "Includes",
  "Origin",
  "Participant",
  "Primary spec",
  "Related",
  "Required for completion",
] as const satisfies readonly RelationKind[];

type WorkContextSourceRelationKind =
  (typeof WORK_CONTEXT_SOURCE_RELATION_KINDS)[number];

// These are the record types that the Work Context Card can present when the
// relation endpoint has a resolved name. The server still fails closed for a
// record type without an owning resolver, so an inaccessible endpoint remains
// a content-free broken source.
const WORK_CONTEXT_RESOLVED_RECORD_TYPES = new Set<RelationRecordType>([
  "Assumption",
  "Company",
  "Contact",
  "Decision",
  "Document",
  "Document version",
  "Experiment/Validation",
  "Feedback",
  "GitHub external",
  "GitHub PR",
  "Milestone",
  "Open Question",
  "Project Goal",
  "Project Release",
  "Risk",
  "Source",
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
  direction: RelationView["direction"] | null;
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
  priorityFoundations: WorkContextPriorityFoundations;
  sources: readonly WorkContextSource[];
  whyChain: readonly WorkContextSource[];
}

export const PRIORITY_FOUNDATION_SOURCE_LABELS = [
  "Project Goal",
  "Blocked by",
  "Risk",
  "Milestone",
  "Feedback",
  "Decision",
  "Source",
] as const;

export type PriorityFoundationSourceLabel =
  (typeof PRIORITY_FOUNDATION_SOURCE_LABELS)[number];

export interface WorkContextPriorityMetricValue {
  id: string;
  name: string;
  value: string | null;
}

export interface WorkContextPriorityValues {
  effort?: string | null;
  priorityMetrics?: readonly WorkContextPriorityMetricValue[];
  targetDate?: string | null;
}

export interface WorkContextPriorityValue {
  id: string;
  label: string;
  source: WorkContextSource;
  value: string;
}

export interface WorkContextPriorityCount {
  count: number;
  id: string;
  label: string;
  sources: readonly WorkContextSource[];
}

export interface WorkContextPriorityFoundations {
  counts: readonly WorkContextPriorityCount[];
  values: readonly WorkContextPriorityValue[];
}

export interface BuildWorkContextModelInput {
  priorityValues?: WorkContextPriorityValues;
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
  priorityValues,
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
    const primarySpecRelation = relations.find((relation) => {
      if (relation.kind !== "Primary spec") {
        return false;
      }
      const endpoint = relatedEndpoint(relation, work.id);
      return (
        endpoint?.recordId === work.primarySpecId &&
        endpoint.recordType === "Document version"
      );
    });
    if (primarySpecRelation) {
      const endpoint = relatedEndpoint(primarySpecRelation, work.id);
      if (endpoint) {
        sources.push(sourceFromRelation(primarySpecRelation, endpoint));
      }
    }
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
    priorityFoundations: buildPriorityFoundations({
      relations,
      sources: uniqueSources,
      values: priorityValues,
      work,
    }),
    sources: uniqueSources,
    whyChain: uniqueSources
      .filter(isWhyChainSource)
      .sort(compareWhyChainSources),
  };
}

export interface BuildPriorityFoundationsInput {
  relations: readonly RelationView[];
  sources: readonly WorkContextSource[];
  values?: WorkContextPriorityValues;
  work: WorkProfile;
}

export function buildPriorityFoundations({
  relations,
  sources,
  values = {},
  work,
}: BuildPriorityFoundationsInput): WorkContextPriorityFoundations {
  const feedbackIds = new Set(
    sources
      .filter(
        (source) =>
          source.recordType === "Feedback" && isVisiblePrioritySource(source),
      )
      .map((source) => source.recordId),
  );
  const participantSources = relations
    .filter(
      (relation) =>
        relation.kind === "Participant" &&
        feedbackIds.has(relation.source.recordId) &&
        relation.source.recordType === "Feedback",
    )
    .map((relation) => sourceFromRelation(relation, relation.target));
  const contactIds = new Set(
    participantSources
      .filter(
        (source) =>
          source.recordType === "Contact" && isVisiblePrioritySource(source),
      )
      .map((source) => source.recordId),
  );
  const companySources = relations
    .filter(
      (relation) =>
        relation.kind === "Belongs to Company" &&
        contactIds.has(relation.source.recordId) &&
        relation.source.recordType === "Contact",
    )
    .map((relation) => sourceFromRelation(relation, relation.target));
  const allSources = deduplicateSources([
    ...sources,
    ...participantSources,
    ...companySources,
  ]);
  const visibleSources = allSources.filter(isVisiblePrioritySource);

  const sourceValues = visibleSources.flatMap((source) => {
    const label = priorityFoundationLabel(source);
    return label
      ? [
          {
            id: `priority-value:${source.id}`,
            label,
            source,
            value: workContextSourceText(source),
          },
        ]
      : [];
  });
  const valuesFromWork = [
    priorityValueFromWork("Target date", values.targetDate, work),
    priorityValueFromWork("Effort", values.effort, work),
  ].filter((value): value is WorkContextPriorityValue => value !== null);
  const metricValues = (values.priorityMetrics ?? []).map((metric) => ({
    id: `priority-metric:${metric.id}`,
    label: metric.name,
    source: sourceFromWork("Priority metrics", work),
    value: metric.value ?? "Unevaluated",
  }));

  const sourceCounts = PRIORITY_FOUNDATION_SOURCE_LABELS.map((label) =>
    priorityCount(
      label,
      visibleSources.filter((source) =>
        sourceMatchesPriorityLabel(source, label),
      ),
    ),
  ).filter((count) => count.count > 0);
  const contactSources = deduplicateSources(
    participantSources.filter(
      (source) =>
        source.recordType === "Contact" && isVisiblePrioritySource(source),
    ),
  );
  const visibleCompanySources = deduplicateSources(
    companySources.filter(
      (source) =>
        source.recordType === "Company" && isVisiblePrioritySource(source),
    ),
  );
  const counts = [
    ...sourceCounts,
    priorityCount("Unique Contact", contactSources),
    priorityCount("Unique Company", visibleCompanySources),
  ].filter((count) => count.count > 0);

  return {
    counts,
    values: [...sourceValues, ...valuesFromWork, ...metricValues],
  };
}

function priorityFoundationLabel(
  source: WorkContextSource,
): PriorityFoundationSourceLabel | "Target Release" | null {
  if (source.label === "Project Goal" || source.recordType === "Project Goal") {
    return "Project Goal";
  }
  if (source.relationKind === "Blocks" && source.direction === "incoming") {
    return "Blocked by";
  }
  if (source.recordType === "Risk") {
    return "Risk";
  }
  if (
    source.recordType === "Milestone" ||
    source.relationKind === "Contributes to Milestone"
  ) {
    return "Milestone";
  }
  if (source.recordType === "Feedback") {
    return "Feedback";
  }
  if (source.recordType === "Decision") {
    return "Decision";
  }
  if (source.recordType === "Source") {
    return "Source";
  }
  return null;
}

function sourceMatchesPriorityLabel(source: WorkContextSource, label: string) {
  return priorityFoundationLabel(source) === label;
}

function priorityCount(
  label: string,
  sources: readonly WorkContextSource[],
): WorkContextPriorityCount {
  const slug = label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
  return {
    count: sources.length,
    id: `priority-count-${slug}`,
    label,
    sources,
  };
}

function priorityValueFromWork(
  label: string,
  value: string | null | undefined,
  work: WorkProfile,
): WorkContextPriorityValue | null {
  return value
    ? {
        id: `priority-value:${label.toLowerCase().replaceAll(" ", "-")}`,
        label,
        source: sourceFromWork(label, work),
        value,
      }
    : null;
}

function isVisiblePrioritySource(source: WorkContextSource) {
  return source.broken === null || source.broken.reason === "Archived";
}

export function workContextSourceText(source: WorkContextSource) {
  if (source.broken) {
    return source.key && source.title
      ? `${source.key} ${source.title} — ${source.broken.reason}`
      : `Broken — ${source.broken.reason}`;
  }
  if (source.key && source.title) {
    return `${source.key} ${source.title}`;
  }
  return source.title ?? source.recordType;
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
        return (
          source.relationKind === "Related" && source.recordType === "Work"
        );
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
  return endpoint
    ? endpoint.broken !== null ||
        isSupportedSourceRecordType(endpoint.recordType)
    : false;
}

function isSupportedSourceRecordType(recordType: RelationRecordType) {
  return WORK_CONTEXT_RESOLVED_RECORD_TYPES.has(recordType);
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
    direction: relation.direction,
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
    broken: work.archivedAt
      ? {
          canOpenSourceRecord: true,
          establishedAt: work.archivedAt,
          reason: "Archived",
        }
      : null,
    direction: null,
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
    direction: null,
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

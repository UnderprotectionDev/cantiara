import { z } from "zod";

import {
  RELATION_EVIDENCE_ROLE_OPTIONS,
  type RelationEndpointView,
  type RelationEvidenceRole,
  type RelationKind,
  type RelationRecordType,
  type RelationView,
} from "./relations";
import {
  WORK_TYPE_OPTIONS,
  type WorkProfile,
  type WorkStatus,
  type WorkType,
  workStatusSchema,
} from "./work-lifecycle";

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

export const WORK_CONTEXT_CUSTOM_RECORD_TYPE_OPTIONS = [
  "Decision",
  "Risk",
  "Assumption",
  "Open Question",
  "Feedback",
  "Source",
  "User Research Session",
  "Experiment/Validation",
  "Test Gap",
  "Session Test",
  "GitHub PR/check",
  "Project Release",
  "Project Goal",
  "Origin Research",
  "Primary Feature",
  "Primary spec",
] as const;

export type WorkContextCustomRecordType =
  (typeof WORK_CONTEXT_CUSTOM_RECORD_TYPE_OPTIONS)[number];

export const WORK_CONTEXT_CUSTOM_RELATION_OPTIONS = [
  "Related",
  "Origin",
  "Derived",
  "Evidence",
  "Provides evidence",
  "Contributes to Goal",
  "Blocks",
  "Blocked by",
  "Includes",
  "Included in",
  "Contributes to Milestone",
  "Primary spec",
  "Supersedes",
  "Implements",
] as const;

export type WorkContextCustomRelation =
  (typeof WORK_CONTEXT_CUSTOM_RELATION_OPTIONS)[number];

export const WORK_CONTEXT_EVIDENCE_ROLE_OPTIONS =
  RELATION_EVIDENCE_ROLE_OPTIONS;

export type WorkContextEvidenceRole = RelationEvidenceRole;

const workContextCustomRecordTypeSchema = z.enum(
  WORK_CONTEXT_CUSTOM_RECORD_TYPE_OPTIONS,
);
const workContextCustomRelationSchema = z.enum(
  WORK_CONTEXT_CUSTOM_RELATION_OPTIONS,
);
const workContextEvidenceRoleSchema = z.enum(
  WORK_CONTEXT_EVIDENCE_ROLE_OPTIONS,
);
const workContextStatusConditionSchema = z.union([z.null(), workStatusSchema]);

const workContextCustomSectionConditionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("record-type"),
      recordType: workContextCustomRecordTypeSchema,
      status: workContextStatusConditionSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("relation"),
      relation: workContextCustomRelationSchema,
      status: workContextStatusConditionSchema,
    })
    .strict(),
  z
    .object({
      evidenceRole: workContextEvidenceRoleSchema,
      kind: z.literal("evidence-role"),
      status: workContextStatusConditionSchema,
    })
    .strict(),
]);

export type WorkContextCustomSectionCondition = z.infer<
  typeof workContextCustomSectionConditionSchema
>;

export const workContextCustomSectionSchema = z
  .object({
    condition: workContextCustomSectionConditionSchema,
    id: z.string().trim().min(1).max(255),
    title: z.string().trim().min(1).max(120),
  })
  .strict();

export type WorkContextCustomSection = z.infer<
  typeof workContextCustomSectionSchema
>;

export const workContextLayoutSchema = z
  .object({
    customSections: z.array(workContextCustomSectionSchema),
    hiddenSections: z.array(z.string().trim().min(1).max(255)),
    sectionOrder: z.array(z.string().trim().min(1).max(255)),
  })
  .strict();

export type WorkContextLayout = z.infer<typeof workContextLayoutSchema>;

export type WorkContextLayouts = Record<WorkType, WorkContextLayout>;

export interface WorkContextLayoutSection {
  custom: WorkContextCustomSection | null;
  key: string;
  label: string;
  prepared: PreparedWorkContextSection | null;
}

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

function cloneWorkContextCustomSection(
  section: WorkContextCustomSection,
): WorkContextCustomSection {
  return {
    condition: { ...section.condition },
    id: section.id,
    title: section.title,
  } as WorkContextCustomSection;
}

export function cloneWorkContextLayout(
  layout: WorkContextLayout,
): WorkContextLayout {
  return {
    customSections: layout.customSections.map(cloneWorkContextCustomSection),
    hiddenSections: [...layout.hiddenSections],
    sectionOrder: [...layout.sectionOrder],
  };
}

export function cloneWorkContextLayouts(
  layouts: WorkContextLayouts,
): WorkContextLayouts {
  return Object.fromEntries(
    WORK_TYPE_OPTIONS.map((workType) => [
      workType,
      cloneWorkContextLayout(layouts[workType]),
    ]),
  ) as unknown as WorkContextLayouts;
}

export function getDefaultWorkContextLayouts(): WorkContextLayouts {
  return Object.fromEntries(
    WORK_TYPE_OPTIONS.map((workType) => [
      workType,
      {
        customSections: [],
        hiddenSections: [],
        sectionOrder: [...PREPARED_WORK_CONTEXT_SECTIONS[workType]],
      },
    ]),
  ) as unknown as WorkContextLayouts;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function readStringKeys(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((key): key is string => typeof key === "string")
    : [];
}

/**
 * Read-path companion to `normalizeWorkContextLayout`. Persisted layouts are
 * repaired instead of rejected so an evolved prepared section set can never
 * invalidate a whole Project configuration: missing prepared sections are
 * appended, unknown or duplicate keys are dropped, and unreadable data falls
 * back to the prepared layout. The write path stays strict.
 */
export function repairWorkContextLayout(
  workType: WorkType,
  value: unknown,
): WorkContextLayout {
  const prepared = PREPARED_WORK_CONTEXT_SECTIONS[workType];
  const expectedKeys = new Set<string>(prepared);
  const customSections: WorkContextCustomSection[] = [];
  if (!isRecord(value)) {
    return getDefaultWorkContextLayouts()[workType];
  }
  const customCandidates = Array.isArray(value.customSections)
    ? value.customSections
    : [];
  for (const candidate of customCandidates) {
    const parsed = workContextCustomSectionSchema.safeParse(candidate);
    if (!parsed.success) {
      continue;
    }
    const section = cloneWorkContextCustomSection(parsed.data);
    if (expectedKeys.has(section.id)) {
      continue;
    }
    expectedKeys.add(section.id);
    customSections.push(section);
  }
  const seenKeys = new Set<string>();
  const sectionOrder: string[] = [];
  for (const key of readStringKeys(value.sectionOrder)) {
    if (!expectedKeys.has(key) || seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    sectionOrder.push(key);
  }
  for (const key of expectedKeys) {
    if (!seenKeys.has(key)) {
      sectionOrder.push(key);
    }
  }
  const hiddenSections: string[] = [];
  const seenHidden = new Set<string>();
  for (const key of readStringKeys(value.hiddenSections)) {
    if (!expectedKeys.has(key) || seenHidden.has(key)) {
      continue;
    }
    seenHidden.add(key);
    hiddenSections.push(key);
  }
  return { customSections, hiddenSections, sectionOrder };
}

export function repairWorkContextLayouts(value: unknown): WorkContextLayouts {
  const source = isRecord(value) ? value : {};
  return Object.fromEntries(
    WORK_TYPE_OPTIONS.map((workType) => [
      workType,
      repairWorkContextLayout(workType, source[workType]),
    ]),
  ) as unknown as WorkContextLayouts;
}

export function normalizeWorkContextLayout(
  workType: WorkType,
  value: unknown,
): WorkContextLayout {
  const parsed = workContextLayoutSchema.parse(value);
  const customIds = parsed.customSections.map((section) => section.id);
  const preparedIds = new Set(PREPARED_WORK_CONTEXT_SECTIONS[workType]);
  const expectedKeys = new Set([
    ...PREPARED_WORK_CONTEXT_SECTIONS[workType],
    ...customIds,
  ]);
  if (
    new Set(customIds).size !== customIds.length ||
    customIds.some((id) => preparedIds.has(id as PreparedWorkContextSection)) ||
    new Set(parsed.sectionOrder).size !== parsed.sectionOrder.length ||
    parsed.sectionOrder.length !== expectedKeys.size ||
    parsed.sectionOrder.some((key) => !expectedKeys.has(key)) ||
    [...expectedKeys].some((key) => !parsed.sectionOrder.includes(key)) ||
    parsed.hiddenSections.some((key) => !expectedKeys.has(key)) ||
    new Set(parsed.hiddenSections).size !== parsed.hiddenSections.length
  ) {
    throw new Error(
      `Work Context Card layout for ${workType} must contain every prepared and custom section exactly once.`,
    );
  }
  return {
    customSections: parsed.customSections.map(cloneWorkContextCustomSection),
    hiddenSections: [...parsed.hiddenSections],
    sectionOrder: [...parsed.sectionOrder],
  };
}

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

export function getWorkContextLayout(
  workType: WorkType,
  layouts?: Partial<WorkContextLayouts> | null,
): WorkContextLayout {
  return repairWorkContextLayout(workType, layouts?.[workType]);
}

export function workContextLayoutSections(
  workType: WorkType,
  layout?: WorkContextLayout | null,
): WorkContextLayoutSection[] {
  const resolved = repairWorkContextLayout(workType, layout);
  const customById = new Map(
    resolved.customSections.map((section) => [section.id, section]),
  );
  const prepared = new Set(PREPARED_WORK_CONTEXT_SECTIONS[workType]);
  return resolved.sectionOrder
    .filter((key) => !resolved.hiddenSections.includes(key))
    .map((key) => {
      const custom = customById.get(key) ?? null;
      const isPrepared = prepared.has(key as PreparedWorkContextSection);
      return {
        custom,
        key,
        label: custom?.title ?? key,
        prepared: isPrepared ? (key as PreparedWorkContextSection) : null,
      };
    });
}

export function nextWorkContextSection(
  workType: WorkType,
  visibleSections: readonly string[],
  layout?: WorkContextLayout | null,
) {
  return (
    workContextLayoutSections(workType, layout).find(
      (section) => !visibleSections.includes(section.key),
    ) ?? null
  );
}

export interface WorkContextLayoutPreview {
  added: string[];
  hidden: string[];
  moved: string[];
  shown: string[];
}

export function previewWorkContextLayout(
  workType: WorkType,
  before: WorkContextLayout,
  after: WorkContextLayout,
): WorkContextLayoutPreview {
  const current = normalizeWorkContextLayout(workType, before);
  const next = normalizeWorkContextLayout(workType, after);
  const currentCustomIds = new Set(
    current.customSections.map((section) => section.id),
  );
  const nextCustomById = new Map(
    next.customSections.map((section) => [section.id, section]),
  );
  const label = (key: string) => nextCustomById.get(key)?.title ?? key;
  const currentVisible = current.sectionOrder.filter(
    (key) => !current.hiddenSections.includes(key),
  );
  const nextVisible = next.sectionOrder.filter(
    (key) => !next.hiddenSections.includes(key),
  );
  const currentCommon = currentVisible.filter((key) =>
    nextVisible.includes(key),
  );
  const nextCommon = nextVisible.filter((key) => currentVisible.includes(key));
  const currentIndexByKey = new Map(
    currentCommon.map((key, index) => [key, index] as const),
  );
  const movedKeys = nextCommon.filter(
    (key, index) => currentIndexByKey.get(key) !== index,
  );

  return {
    added: next.customSections
      .filter((section) => !currentCustomIds.has(section.id))
      .map((section) => section.title),
    hidden: next.hiddenSections
      .filter((key) => !current.hiddenSections.includes(key))
      .map(label),
    moved: movedKeys.map(label),
    shown: current.hiddenSections
      .filter((key) => !next.hiddenSections.includes(key))
      .map(label),
  };
}

export const WORK_CONTEXT_SOURCE_RELATION_KINDS = [
  "Blocks",
  "Contributes to Goal",
  "Contributes to Milestone",
  "Evidence",
  "Implements",
  "Includes",
  "Origin",
  "Primary spec",
  "Related",
  "Required for completion",
  "Supersedes",
] as const satisfies readonly RelationKind[];

type WorkContextSourceRelationKind =
  (typeof WORK_CONTEXT_SOURCE_RELATION_KINDS)[number];

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

const WORK_CONTEXT_RESOLVED_RECORD_TYPES = new Set<RelationRecordType>([
  "Assumption",
  "Decision",
  "Document",
  "Document version",
  "Experiment/Validation",
  "Feature",
  "Feedback",
  "GitHub external",
  "GitHub PR",
  "Milestone",
  "Open Question",
  "Project Goal",
  "Project Release",
  "Question",
  "Risk",
  "Spec",
  "Session Test",
  "Source",
  "Test",
  "Test Gap",
  "Test Session",
  "User Research Session",
  "Work",
]);

export interface WorkContextSource {
  broken: RelationEndpointView["broken"];
  evidenceRole: WorkContextEvidenceRole;
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
  customSources: readonly WorkContextSource[];
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
    customSources: sources,
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

export function sourcesForWorkContextCustomSection(
  section: WorkContextCustomSection,
  sources: readonly WorkContextSource[],
): readonly WorkContextSource[] {
  const { condition } = section;
  return deduplicateSources(
    sources.filter((source) => {
      if (condition.status && source.status !== condition.status) {
        return false;
      }
      switch (condition.kind) {
        case "record-type":
          return matchesCustomRecordType(condition.recordType, source);
        case "relation":
          return matchesCustomRelation(condition.relation, source);
        case "evidence-role":
          return (
            source.relationKind === "Evidence" &&
            source.evidenceRole === condition.evidenceRole
          );
        default:
          return false;
      }
    }),
  );
}

function matchesCustomRecordType(
  recordType: WorkContextCustomRecordType,
  source: WorkContextSource,
) {
  switch (recordType) {
    case "GitHub PR/check":
      return (
        source.recordType === "GitHub PR" ||
        source.recordType === "GitHub external"
      );
    case "Origin Research":
      return (
        source.relationKind === "Origin" &&
        source.recordType === "Work" &&
        source.workType === "Research"
      );
    case "Primary Feature":
      return (
        (source.relationKind === null && source.recordType === "Work") ||
        (source.relationKind === "Includes" &&
          (source.recordType === "Feature" || source.workType === "Feature"))
      );
    case "Primary spec":
      return source.relationKind === "Primary spec";
    default:
      return source.recordType === recordType;
  }
}

const WORK_CONTEXT_CUSTOM_RELATION_KINDS: Record<
  WorkContextCustomRelation,
  WorkContextSourceRelationKind | null
> = {
  Related: "Related",
  Origin: "Origin",
  Derived: "Origin",
  Evidence: "Evidence",
  "Provides evidence": "Evidence",
  "Contributes to Goal": "Contributes to Goal",
  Blocks: "Blocks",
  "Blocked by": "Blocks",
  Includes: "Includes",
  "Included in": "Includes",
  "Contributes to Milestone": "Contributes to Milestone",
  "Primary spec": "Primary spec",
  Supersedes: "Supersedes",
  Implements: "Implements",
};

function matchesCustomRelation(
  relation: WorkContextCustomRelation,
  source: WorkContextSource,
) {
  return source.relationKind === WORK_CONTEXT_CUSTOM_RELATION_KINDS[relation];
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
    evidenceRole: evidenceRoleFromRelation(relation),
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
    evidenceRole: "Unspecified",
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
    evidenceRole: "Unspecified",
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

function evidenceRoleFromRelation(
  relation: RelationView,
): WorkContextEvidenceRole {
  const candidate = relation.evidenceRole;
  return (WORK_CONTEXT_EVIDENCE_ROLE_OPTIONS as readonly unknown[]).includes(
    candidate,
  )
    ? (candidate as WorkContextEvidenceRole)
    : "Unspecified";
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

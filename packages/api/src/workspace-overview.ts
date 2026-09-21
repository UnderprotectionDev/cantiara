import { z } from "zod";
import {
  PROJECT_AREA_OPTIONS,
  type ProjectArea,
  type ProjectLifecycleStatus,
  type ProjectStage,
  projectAreaSchema,
  projectLifecycleStatusSchema,
} from "./project-shell";
import type { WorkStatus, WorkType } from "./work-lifecycle";

export const WORKSPACE_OVERVIEW_MODULE_IDS = [
  "active-projects",
  "attention-required",
  "upcoming",
  "recent-work",
] as const;

export type WorkspaceOverviewModuleId =
  (typeof WORKSPACE_OVERVIEW_MODULE_IDS)[number];

export const workspaceOverviewModuleIdSchema = z.enum(
  WORKSPACE_OVERVIEW_MODULE_IDS,
);

export const workspaceOverviewLayoutSchema = z
  .object({
    hidden: z
      .array(workspaceOverviewModuleIdSchema)
      .max(WORKSPACE_OVERVIEW_MODULE_IDS.length),
    order: z
      .array(workspaceOverviewModuleIdSchema)
      .max(WORKSPACE_OVERVIEW_MODULE_IDS.length),
  })
  .strict();

export const WORKSPACE_OVERVIEW_MODULE_NAMES = [
  "Active Projects",
  "Attention Required",
  "Upcoming",
  "Recent Work",
] as const;

export type WorkspaceOverviewModuleName =
  (typeof WORKSPACE_OVERVIEW_MODULE_NAMES)[number];

export const WORKSPACE_OVERVIEW_LIVE_BLOCK_SOURCE_TYPES = [
  "Document",
  "Smart Collection",
] as const;

export const WORKSPACE_OVERVIEW_CONFIGURATION_VERSION = 1 as const;

export const WORKSPACE_OVERVIEW_SAVED_LIST_MAX = 50;

export const WORKSPACE_OVERVIEW_SAVED_LIST_COLUMN_IDS = [
  "name",
  "status",
  "stage",
  "targetDate",
  "archive",
  "areas",
] as const;

export type WorkspaceOverviewSavedListColumnId =
  (typeof WORKSPACE_OVERVIEW_SAVED_LIST_COLUMN_IDS)[number];

export const WORKSPACE_OVERVIEW_SAVED_LIST_SORT_FIELD_IDS = [
  "name",
  "status",
  "targetDate",
  "createdAt",
  "updatedAt",
] as const;

export type WorkspaceOverviewSavedListSortField =
  (typeof WORKSPACE_OVERVIEW_SAVED_LIST_SORT_FIELD_IDS)[number];

export const WORKSPACE_OVERVIEW_SAVED_LIST_GROUP_FIELD_IDS = [
  "status",
  "stage",
  "archive",
] as const;

export type WorkspaceOverviewSavedListGroupField =
  (typeof WORKSPACE_OVERVIEW_SAVED_LIST_GROUP_FIELD_IDS)[number];

export const WORKSPACE_OVERVIEW_SAVED_LIST_ARCHIVE_OPTIONS = [
  "all",
  "archived",
  "not-archived",
] as const;

export type WorkspaceOverviewSavedListArchive =
  (typeof WORKSPACE_OVERVIEW_SAVED_LIST_ARCHIVE_OPTIONS)[number];

// Recent Work and Attention Required are derived summaries; the module sets are
// bounded so the overview payload and DOM stay proportional as the Workspace
// grows. Counts and drill-down open exactly these bounded source sets.
export const WORKSPACE_OVERVIEW_RECENT_WORK_LIMIT = 30;
export const WORKSPACE_OVERVIEW_BLOCKED_WORK_LIMIT = 50;

export type WorkspaceOverviewLiveBlockSourceType =
  (typeof WORKSPACE_OVERVIEW_LIVE_BLOCK_SOURCE_TYPES)[number];

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

const workspaceOverviewSavedListStageNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(200);

export const workspaceOverviewSavedListConditionsSchema = z
  .object({
    archive: z
      .enum(WORKSPACE_OVERVIEW_SAVED_LIST_ARCHIVE_OPTIONS)
      .default("all"),
    areaMatch: z.enum(["any", "all"]).default("any"),
    lifecycleStatuses: z.array(projectLifecycleStatusSchema).max(4).default([]),
    nameContains: z.string().trim().max(200).default(""),
    projectAreas: z
      .array(projectAreaSchema)
      .max(PROJECT_AREA_OPTIONS.length)
      .default([]),
    stageNames: z
      .array(workspaceOverviewSavedListStageNameSchema)
      .max(50)
      .default([]),
    targetDate: z
      .object({
        from: dateOnlySchema,
        to: dateOnlySchema,
      })
      .strict()
      .optional(),
  })
  .strict();

export type WorkspaceOverviewSavedListConditions = z.infer<
  typeof workspaceOverviewSavedListConditionsSchema
>;

const savedListColumnsSchema = z
  .array(z.enum(WORKSPACE_OVERVIEW_SAVED_LIST_COLUMN_IDS))
  .min(1)
  .max(WORKSPACE_OVERVIEW_SAVED_LIST_COLUMN_IDS.length)
  .refine((columns) => new Set(columns).size === columns.length);

const savedListSortSchema = z
  .object({
    direction: z.enum(["asc", "desc"]),
    field: z.enum(WORKSPACE_OVERVIEW_SAVED_LIST_SORT_FIELD_IDS),
  })
  .strict();

export const workspaceOverviewSavedListDefinitionSchema = z
  .object({
    columns: savedListColumnsSchema,
    conditions: workspaceOverviewSavedListConditionsSchema,
    groupBy: z.enum(WORKSPACE_OVERVIEW_SAVED_LIST_GROUP_FIELD_IDS).nullable(),
    id: z.string().trim().min(1).max(255),
    name: z.string().trim().min(1).max(100),
    sort: savedListSortSchema,
  })
  .strict();

export type WorkspaceOverviewSavedListDefinition = z.infer<
  typeof workspaceOverviewSavedListDefinitionSchema
>;

const liveBlockRecordIdSchema = z.string().trim().min(1);
const liveBlockViewIdSchema = z.string().trim().min(1);

export const workspaceOverviewLiveBlockSourceSchema = z.discriminatedUnion(
  "recordType",
  [
    z
      .object({
        recordId: liveBlockRecordIdSchema,
        recordType: z.literal("Document"),
        viewId: liveBlockViewIdSchema.optional(),
      })
      .strict(),
    z
      .object({
        recordId: liveBlockRecordIdSchema,
        recordType: z.literal("Smart Collection"),
        viewId: liveBlockViewIdSchema,
      })
      .strict(),
  ],
);

export const workspaceOverviewPresentationSchema = z
  .object({
    layout: workspaceOverviewLayoutSchema,
    liveBlockSources: z.array(workspaceOverviewLiveBlockSourceSchema).max(4),
    savedLists: z
      .array(workspaceOverviewSavedListDefinitionSchema)
      .max(WORKSPACE_OVERVIEW_SAVED_LIST_MAX)
      .optional()
      .default([]),
    version: z.literal(WORKSPACE_OVERVIEW_CONFIGURATION_VERSION),
  })
  .strict();

export type WorkspaceOverviewLiveBlockSource = z.infer<
  typeof workspaceOverviewLiveBlockSourceSchema
>;

export interface WorkspaceOverviewPresentation {
  layout: WorkspaceOverviewLayout;
  liveBlockSources: readonly WorkspaceOverviewLiveBlockSource[];
  savedLists?: readonly WorkspaceOverviewSavedListDefinition[];
  version: typeof WORKSPACE_OVERVIEW_CONFIGURATION_VERSION;
}

export type WorkspaceOverviewProjectStage = ProjectStage;

export interface WorkspaceOverviewProject {
  archivedAt: string | null;
  areas?: readonly ProjectArea[];
  createdAt: string;
  id: string;
  name: string;
  stages?: readonly WorkspaceOverviewProjectStage[];
  status: ProjectLifecycleStatus;
  targetDate: string | null;
  updatedAt: string;
}

export interface WorkspaceOverviewWork {
  archivedAt: string | null;
  id: string;
  key: string;
  projectId: string;
  status: WorkStatus;
  title: string;
  type: WorkType;
  updatedAt: string;
}

export interface WorkspaceOverviewSourceRecord {
  category?: string | null;
  href: string;
  id: string;
  projectId?: string | null;
  projectName?: string | null;
  status?: string | null;
  targetDate?: string | null;
  title: string;
  type: string;
  updatedAt?: string | null;
}

export interface WorkspaceOverviewLiveBlock {
  href: string;
  id: string;
  source: WorkspaceOverviewLiveBlockSource;
  title: string;
  type: WorkspaceOverviewLiveBlockSourceType;
}

export interface WorkspaceOverviewSources {
  asOf?: string;
  attention?: readonly WorkspaceOverviewSourceRecord[];
  availableLiveBlocks?: readonly WorkspaceOverviewLiveBlock[];
  layout?: Partial<WorkspaceOverviewLayout> | null;
  liveBlockSources?: readonly WorkspaceOverviewLiveBlockSource[];
  liveBlocks?: readonly WorkspaceOverviewLiveBlock[];
  projects: readonly WorkspaceOverviewProject[];
  savedLists?: readonly WorkspaceOverviewSavedListDefinition[];
  upcoming?: readonly WorkspaceOverviewSourceRecord[];
  works?: readonly WorkspaceOverviewWork[];
}

export interface WorkspaceOverviewModule {
  id: WorkspaceOverviewModuleId;
  name: WorkspaceOverviewModuleName;
  records: readonly WorkspaceOverviewSourceRecord[];
  sourceHref: string;
}

export interface WorkspaceOverviewModel {
  availableLiveBlocks: readonly WorkspaceOverviewLiveBlock[];
  layout: WorkspaceOverviewLayout;
  liveBlockSources: readonly WorkspaceOverviewLiveBlockSource[];
  liveBlocks: readonly WorkspaceOverviewLiveBlock[];
  modules: readonly WorkspaceOverviewModule[];
  savedLists: readonly WorkspaceOverviewSavedList[];
}

export interface WorkspaceOverviewSavedList
  extends WorkspaceOverviewSavedListDefinition {
  href: string;
  projects: readonly WorkspaceOverviewProject[];
}

export interface WorkspaceOverviewAccess {
  get: (accountId: string) => Promise<WorkspaceOverviewModel>;
  savePresentation?: (
    accountId: string,
    presentation: WorkspaceOverviewPresentation,
  ) => Promise<WorkspaceOverviewModel>;
}

export interface WorkspaceOverviewLayout {
  hidden: readonly WorkspaceOverviewModuleId[];
  order: readonly WorkspaceOverviewModuleId[];
}

export const DEFAULT_WORKSPACE_OVERVIEW_LAYOUT: WorkspaceOverviewLayout = {
  hidden: [],
  order: WORKSPACE_OVERVIEW_MODULE_IDS,
};

export function workspaceOverviewProjectHref(projectId: string) {
  return `/projects/${encodeURIComponent(projectId)}`;
}

export function workspaceOverviewWorkHref(projectId: string, workId: string) {
  return `${workspaceOverviewProjectHref(projectId)}#work-${encodeURIComponent(workId)}`;
}

function sourceRecord(record: WorkspaceOverviewSourceRecord) {
  return { ...record };
}

function projectRecord(project: WorkspaceOverviewProject) {
  return {
    href: workspaceOverviewProjectHref(project.id),
    id: project.id,
    projectId: project.id,
    projectName: project.name,
    status: project.status,
    targetDate: project.targetDate,
    title: project.name,
    type: "Project",
    updatedAt: project.updatedAt,
  } satisfies WorkspaceOverviewSourceRecord;
}

function workRecord(
  work: WorkspaceOverviewWork,
  projectNames: ReadonlyMap<string, string>,
) {
  return {
    href: workspaceOverviewWorkHref(work.projectId, work.id),
    id: work.id,
    projectId: work.projectId,
    projectName: projectNames.get(work.projectId) ?? null,
    status: work.status,
    title: work.title,
    type: work.type,
    updatedAt: work.updatedAt,
  } satisfies WorkspaceOverviewSourceRecord;
}

function deduplicateRecords(records: readonly WorkspaceOverviewSourceRecord[]) {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (seen.has(record.id)) {
      return false;
    }
    seen.add(record.id);
    return true;
  });
}

function sortByTargetDate(records: readonly WorkspaceOverviewSourceRecord[]) {
  return [...records].sort((left, right) => {
    const leftDate = left.targetDate ?? "9999-12-31";
    const rightDate = right.targetDate ?? "9999-12-31";
    return (
      leftDate.localeCompare(rightDate) || left.title.localeCompare(right.title)
    );
  });
}

function sortByUpdatedAt(records: readonly WorkspaceOverviewSourceRecord[]) {
  return [...records].sort((left, right) => {
    const leftDate = left.updatedAt ?? "";
    const rightDate = right.updatedAt ?? "";
    return (
      rightDate.localeCompare(leftDate) || left.title.localeCompare(right.title)
    );
  });
}

function isUpcomingTargetDate(
  targetDate: string | null | undefined,
  asOf?: string,
) {
  if (!(targetDate && asOf)) {
    return true;
  }
  return targetDate.slice(0, 10) >= asOf.slice(0, 10);
}

function liveBlockSource(block: WorkspaceOverviewLiveBlock) {
  return { ...block.source };
}

function liveBlockMatchesSource(
  block: WorkspaceOverviewLiveBlock,
  source: WorkspaceOverviewLiveBlockSource,
) {
  return (
    block.source.recordId === source.recordId &&
    block.source.recordType === source.recordType &&
    block.source.viewId === source.viewId
  );
}

export function workspaceOverviewModuleHref(
  moduleId: WorkspaceOverviewModuleId,
) {
  return `/projects?overviewModule=${moduleId}`;
}

export function workspaceOverviewSavedListHref(savedListId: string) {
  return `/projects?savedListId=${encodeURIComponent(savedListId)}`;
}

export function cloneWorkspaceOverviewSavedListDefinition(
  definition: WorkspaceOverviewSavedListDefinition,
) {
  return {
    ...definition,
    columns: [...definition.columns],
    conditions: {
      ...definition.conditions,
      lifecycleStatuses: [...definition.conditions.lifecycleStatuses],
      projectAreas: [...definition.conditions.projectAreas],
      stageNames: [...definition.conditions.stageNames],
      targetDate: definition.conditions.targetDate
        ? { ...definition.conditions.targetDate }
        : undefined,
    },
    sort: { ...definition.sort },
  } satisfies WorkspaceOverviewSavedListDefinition;
}

function cloneProject(project: WorkspaceOverviewProject) {
  return {
    ...project,
    areas: project.areas ? [...project.areas] : undefined,
    stages: project.stages?.map((stage) => ({ ...stage })),
  } satisfies WorkspaceOverviewProject;
}

function normalizedSavedListDefinition(
  definition: WorkspaceOverviewSavedListDefinition,
) {
  return workspaceOverviewSavedListDefinitionSchema.parse(
    cloneWorkspaceOverviewSavedListDefinition(definition),
  );
}

function matchesSavedListLifecycle(
  project: WorkspaceOverviewProject,
  conditions: WorkspaceOverviewSavedListConditions,
) {
  return (
    conditions.lifecycleStatuses.length === 0 ||
    conditions.lifecycleStatuses.includes(project.status)
  );
}

function matchesSavedListName(
  project: WorkspaceOverviewProject,
  conditions: WorkspaceOverviewSavedListConditions,
) {
  const query = conditions.nameContains.toLocaleLowerCase("en-US");
  return !query || project.name.toLocaleLowerCase("en-US").includes(query);
}

function matchesSavedListStages(
  project: WorkspaceOverviewProject,
  conditions: WorkspaceOverviewSavedListConditions,
) {
  if (conditions.stageNames.length === 0) {
    return true;
  }
  const stageNames = new Set((project.stages ?? []).map((stage) => stage.name));
  return conditions.stageNames.some((stageName) => stageNames.has(stageName));
}

function matchesSavedListArchive(
  project: WorkspaceOverviewProject,
  conditions: WorkspaceOverviewSavedListConditions,
) {
  const archived = project.archivedAt !== null;
  return (
    conditions.archive === "all" ||
    (conditions.archive === "archived" && archived) ||
    (conditions.archive === "not-archived" && !archived)
  );
}

function matchesSavedListAreas(
  project: WorkspaceOverviewProject,
  conditions: WorkspaceOverviewSavedListConditions,
) {
  if (conditions.projectAreas.length === 0) {
    return true;
  }
  const areas = new Set(project.areas ?? []);
  return conditions.areaMatch === "all"
    ? conditions.projectAreas.every((area) => areas.has(area))
    : conditions.projectAreas.some((area) => areas.has(area));
}

function matchesSavedListTargetDate(
  project: WorkspaceOverviewProject,
  conditions: WorkspaceOverviewSavedListConditions,
) {
  if (!conditions.targetDate) {
    return true;
  }
  const targetDate = project.targetDate?.slice(0, 10);
  const from = conditions.targetDate.from?.slice(0, 10);
  const to = conditions.targetDate.to?.slice(0, 10);
  return (
    (!(from || to) || targetDate !== undefined) &&
    (!from || (targetDate !== undefined && targetDate >= from)) &&
    (!to || (targetDate !== undefined && targetDate <= to))
  );
}

export function workspaceOverviewSavedListMatchesProject(
  project: WorkspaceOverviewProject,
  conditions: WorkspaceOverviewSavedListConditions,
) {
  return [
    matchesSavedListLifecycle,
    matchesSavedListName,
    matchesSavedListStages,
    matchesSavedListArchive,
    matchesSavedListAreas,
    matchesSavedListTargetDate,
  ].every((matches) => matches(project, conditions));
}

function savedListSortValue(
  project: WorkspaceOverviewProject,
  field: WorkspaceOverviewSavedListSortField,
) {
  switch (field) {
    case "name":
      return project.name;
    case "status":
      return project.status;
    case "targetDate":
      return project.targetDate ?? "9999-12-31";
    case "createdAt":
      return project.createdAt;
    case "updatedAt":
      return project.updatedAt;
    default:
      return "";
  }
}

function sortSavedListProjects(
  projects: readonly WorkspaceOverviewProject[],
  sort: WorkspaceOverviewSavedListDefinition["sort"],
) {
  return [...projects].sort((left, right) => {
    if (sort.field === "targetDate") {
      const leftMissing = left.targetDate === null;
      const rightMissing = right.targetDate === null;
      if (leftMissing !== rightMissing) {
        return leftMissing ? 1 : -1;
      }
    }
    const leftValue = savedListSortValue(left, sort.field);
    const rightValue = savedListSortValue(right, sort.field);
    const comparison = leftValue.localeCompare(rightValue);
    const direction = sort.direction === "asc" ? 1 : -1;
    return (
      comparison * direction ||
      left.name.localeCompare(right.name) ||
      left.id.localeCompare(right.id)
    );
  });
}

function buildSavedLists(
  projects: readonly WorkspaceOverviewProject[],
  definitions: readonly WorkspaceOverviewSavedListDefinition[],
) {
  const seenIds = new Set<string>();
  return definitions
    .slice(0, WORKSPACE_OVERVIEW_SAVED_LIST_MAX)
    .map((definition) => normalizedSavedListDefinition(definition))
    .filter((definition) => {
      if (seenIds.has(definition.id)) {
        return false;
      }
      seenIds.add(definition.id);
      return true;
    })
    .map((definition) => {
      const members = projects
        .filter((project) =>
          workspaceOverviewSavedListMatchesProject(
            project,
            definition.conditions,
          ),
        )
        .map(cloneProject);
      return {
        ...definition,
        columns: [...definition.columns],
        href: workspaceOverviewSavedListHref(definition.id),
        projects: sortSavedListProjects(members, definition.sort),
      } satisfies WorkspaceOverviewSavedList;
    });
}

export function buildWorkspaceOverview(
  sources: WorkspaceOverviewSources,
): WorkspaceOverviewModel {
  const sourceProjects = sources.projects.map(cloneProject);
  const projects = sourceProjects.map(projectRecord);
  const projectNames = new Map(
    sources.projects.map((project) => [project.id, project.name]),
  );
  const works = (sources.works ?? []).filter(
    (work) => work.archivedAt === null,
  );
  const workRecords = works.map((work) => workRecord(work, projectNames));
  const blockedWorkRecords = workRecords
    .filter((record) => record.status === "Blocked")
    .map((record) => ({ ...record, category: "Blocker" }));
  const attention = deduplicateRecords([
    ...(sources.attention ?? []).map(sourceRecord),
    ...blockedWorkRecords,
  ]);
  const targetDateRecords = projects.filter(
    (record) =>
      record.targetDate !== null &&
      isUpcomingTargetDate(record.targetDate, sources.asOf),
  );
  const upcoming = sortByTargetDate(
    deduplicateRecords([
      ...(sources.upcoming ?? [])
        .filter((record) =>
          isUpcomingTargetDate(record.targetDate, sources.asOf),
        )
        .map(sourceRecord),
      ...targetDateRecords,
    ]),
  );
  const recentWork = sortByUpdatedAt(workRecords).slice(
    0,
    WORKSPACE_OVERVIEW_RECENT_WORK_LIMIT,
  );
  const activeProjects = projects.filter(
    (record) => record.status === "Active",
  );
  const moduleRecords: Record<
    WorkspaceOverviewModuleId,
    readonly WorkspaceOverviewSourceRecord[]
  > = {
    "active-projects": activeProjects,
    "attention-required": attention,
    "recent-work": recentWork,
    upcoming,
  };
  const moduleNames: Record<
    WorkspaceOverviewModuleId,
    WorkspaceOverviewModuleName
  > = {
    "active-projects": "Active Projects",
    "attention-required": "Attention Required",
    "recent-work": "Recent Work",
    upcoming: "Upcoming",
  };

  const availableLiveBlocks = (sources.availableLiveBlocks ?? []).map(
    (block) => ({
      ...block,
      source: { ...block.source },
    }),
  );
  const liveBlockSources = sources.liveBlockSources
    ? sources.liveBlockSources.map((source) => ({ ...source }))
    : (sources.liveBlocks ?? []).map(liveBlockSource);
  const liveBlocks = sources.liveBlocks
    ? sources.liveBlocks.map((block) => ({
        ...block,
        source: { ...block.source },
      }))
    : liveBlockSources
        .map((source) =>
          availableLiveBlocks.find((block) =>
            liveBlockMatchesSource(block, source),
          ),
        )
        .filter((block): block is WorkspaceOverviewLiveBlock => Boolean(block))
        .map((block) => ({ ...block, source: { ...block.source } }));

  return {
    availableLiveBlocks,
    layout: normalizeWorkspaceOverviewLayout(sources.layout),
    liveBlocks,
    liveBlockSources,
    modules: WORKSPACE_OVERVIEW_MODULE_IDS.map((id) => ({
      id,
      name: moduleNames[id],
      records: moduleRecords[id].map(sourceRecord),
      sourceHref: workspaceOverviewModuleHref(id),
    })),
    savedLists: buildSavedLists(sourceProjects, sources.savedLists ?? []),
  };
}

function isWorkspaceOverviewModuleId(
  value: string,
): value is WorkspaceOverviewModuleId {
  return (WORKSPACE_OVERVIEW_MODULE_IDS as readonly string[]).includes(value);
}

export function normalizeWorkspaceOverviewLayout(
  layout?: Partial<WorkspaceOverviewLayout> | null,
): WorkspaceOverviewLayout {
  const requestedOrder = layout?.order ?? [];
  const requestedIds = new Set<WorkspaceOverviewModuleId>();
  const validRequestedOrder = requestedOrder.filter((id) => {
    if (!isWorkspaceOverviewModuleId(id) || requestedIds.has(id)) {
      return false;
    }
    requestedIds.add(id);
    return true;
  });
  const order = [
    ...validRequestedOrder,
    ...WORKSPACE_OVERVIEW_MODULE_IDS.filter((id) => !requestedIds.has(id)),
  ];
  const hidden = [
    ...new Set((layout?.hidden ?? []).filter(isWorkspaceOverviewModuleId)),
  ];
  return { hidden, order };
}

export function moveWorkspaceOverviewModule(
  layout: WorkspaceOverviewLayout,
  moduleId: WorkspaceOverviewModuleId,
  direction: "down" | "up",
): WorkspaceOverviewLayout {
  const normalized = normalizeWorkspaceOverviewLayout(layout);
  const index = normalized.order.indexOf(moduleId);
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || nextIndex < 0 || nextIndex >= normalized.order.length) {
    return normalized;
  }

  const order = [...normalized.order];
  const [moved] = order.splice(index, 1);
  if (!moved) {
    return normalized;
  }
  order.splice(nextIndex, 0, moved);
  return { hidden: [...normalized.hidden], order };
}

export function setWorkspaceOverviewModuleVisibility(
  layout: WorkspaceOverviewLayout,
  moduleId: WorkspaceOverviewModuleId,
  visible: boolean,
): WorkspaceOverviewLayout {
  const normalized = normalizeWorkspaceOverviewLayout(layout);
  const hidden = visible
    ? normalized.hidden.filter((id) => id !== moduleId)
    : [...new Set([...normalized.hidden, moduleId])];
  return { hidden, order: [...normalized.order] };
}

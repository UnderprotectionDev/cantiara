import { z } from "zod";
import type { ProjectLifecycleStatus } from "./project-shell";
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

export type WorkspaceOverviewLiveBlockSourceType =
  (typeof WORKSPACE_OVERVIEW_LIVE_BLOCK_SOURCE_TYPES)[number];

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
    version: z.literal(WORKSPACE_OVERVIEW_CONFIGURATION_VERSION),
  })
  .strict();

export type WorkspaceOverviewLiveBlockSource = z.infer<
  typeof workspaceOverviewLiveBlockSourceSchema
>;

export interface WorkspaceOverviewPresentation {
  layout: WorkspaceOverviewLayout;
  liveBlockSources: readonly WorkspaceOverviewLiveBlockSource[];
  version: typeof WORKSPACE_OVERVIEW_CONFIGURATION_VERSION;
}

export interface WorkspaceOverviewProject {
  createdAt: string;
  id: string;
  name: string;
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

function projectHref(projectId: string) {
  return `/projects/${encodeURIComponent(projectId)}`;
}

function workHref(projectId: string, workId: string) {
  return `${projectHref(projectId)}#work-${encodeURIComponent(workId)}`;
}

function sourceRecord(record: WorkspaceOverviewSourceRecord) {
  return { ...record };
}

function projectRecord(project: WorkspaceOverviewProject) {
  return {
    href: projectHref(project.id),
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
    href: workHref(work.projectId, work.id),
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

export function buildWorkspaceOverview(
  sources: WorkspaceOverviewSources,
): WorkspaceOverviewModel {
  const projects = sources.projects.map(projectRecord);
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
  const recentWork = sortByUpdatedAt(workRecords);
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

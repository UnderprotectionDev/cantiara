import type {
  ProjectArea,
  ProjectLifecycleStatus,
  ProjectProfile,
  ProjectStage,
} from "./project-shell";

export const PROJECT_OVERVIEW_MODULE_NAMES = [
  "Goals",
  "Stages",
  "Milestones",
  "Work",
  "Documents",
  "Decisions",
  "Risks",
  "Tests",
  "Production",
  "Blockers",
  "Dates",
  "Recent changes",
] as const;

export type ProjectOverviewModuleName =
  (typeof PROJECT_OVERVIEW_MODULE_NAMES)[number];

export interface ProjectOverviewSourceRecord {
  description?: string | null;
  href?: string | null;
  id: string;
  status?: string | null;
  targetDate?: string | null;
  title: string;
  type?: string | null;
  updatedAt?: string | null;
}

export interface ProjectOverviewGoalRecord extends ProjectOverviewSourceRecord {
  href: string;
}

export interface ProjectOverviewSources {
  activeTestHandoffs?: readonly ProjectOverviewSourceRecord[];
  blockers?: readonly ProjectOverviewSourceRecord[];
  dates?: readonly ProjectOverviewSourceRecord[];
  decisions?: readonly ProjectOverviewSourceRecord[];
  documents?: readonly ProjectOverviewSourceRecord[];
  goals?: readonly ProjectOverviewGoalRecord[];
  importantProductionIncidents?: readonly ProjectOverviewSourceRecord[];
  milestones?: readonly ProjectOverviewSourceRecord[];
  openTestGaps?: readonly ProjectOverviewSourceRecord[];
  recentChanges?: readonly ProjectOverviewSourceRecord[];
  recentTestSessions?: readonly ProjectOverviewSourceRecord[];
  risks?: readonly ProjectOverviewSourceRecord[];
  work?: readonly ProjectOverviewSourceRecord[];
}

export interface ProjectOverviewModule {
  name: ProjectOverviewModuleName;
  records: readonly ProjectOverviewSourceRecord[];
}

export interface ProjectOverviewModel {
  activeStages: readonly ProjectStage[];
  enabledAreas: readonly ProjectArea[];
  lifecycle: ProjectLifecycleStatus;
  modules: readonly ProjectOverviewModule[];
  purpose: string | null;
  targetDate: string | null;
}

function records(
  sourceRecords: readonly ProjectOverviewSourceRecord[] | undefined,
) {
  return sourceRecords ? [...sourceRecords] : [];
}

export function buildProjectOverview(
  project: ProjectProfile,
  sources: ProjectOverviewSources = {},
): ProjectOverviewModel {
  const activeStages = project.configuration.preparedStages.filter(
    (stage) => stage.status === "Active",
  );
  const modules: readonly ProjectOverviewModule[] = [
    { name: "Goals", records: records(sources.goals) },
    {
      name: "Stages",
      records: activeStages.map((stage) => ({
        id: stage.id,
        status: stage.status,
        title: stage.name,
      })),
    },
    { name: "Milestones", records: records(sources.milestones) },
    { name: "Work", records: records(sources.work) },
    { name: "Documents", records: records(sources.documents) },
    { name: "Decisions", records: records(sources.decisions) },
    { name: "Risks", records: records(sources.risks) },
    {
      name: "Tests",
      records: [
        ...records(sources.activeTestHandoffs),
        ...records(sources.recentTestSessions),
        ...records(sources.openTestGaps),
      ],
    },
    {
      name: "Production",
      records: records(sources.importantProductionIncidents),
    },
    { name: "Blockers", records: records(sources.blockers) },
    { name: "Dates", records: records(sources.dates) },
    { name: "Recent changes", records: records(sources.recentChanges) },
  ];

  return {
    activeStages: activeStages.map((stage) => ({ ...stage })),
    enabledAreas: project.configuration.enabledAreas.filter(
      (area) => !project.configuration.hiddenAreas.includes(area),
    ),
    lifecycle: project.status,
    modules,
    purpose: project.purpose,
    targetDate: project.targetDate,
  };
}

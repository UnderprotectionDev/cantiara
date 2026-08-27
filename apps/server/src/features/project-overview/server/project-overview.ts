import {
	type ProjectAreaName,
	STAGE_STATE,
} from "../../project-shell/server/project-shell-model";

export const OVERVIEW_COPY = {
	blockers: "Blockers",
	dates: "Dates",
	decisions: "Decisions",
	documents: "Documents",
	goals: "Goals",
	lifecycle: "Lifecycle",
	milestones: "Milestones",
	openSourceRecord: "Open source record",
	overview: "Overview",
	production: "Production",
	projectAreas: "Project areas",
	purpose: "Purpose",
	recentChanges: "Recent changes",
	risks: "Risks",
	stages: "Stages",
	tests: "Tests",
	work: "Work",
} as const;

export const OVERVIEW_MODULE_HEADINGS = [
	OVERVIEW_COPY.purpose,
	OVERVIEW_COPY.lifecycle,
	OVERVIEW_COPY.goals,
	OVERVIEW_COPY.stages,
	OVERVIEW_COPY.milestones,
	OVERVIEW_COPY.work,
	OVERVIEW_COPY.documents,
	OVERVIEW_COPY.decisions,
	OVERVIEW_COPY.risks,
	OVERVIEW_COPY.tests,
	OVERVIEW_COPY.production,
	OVERVIEW_COPY.blockers,
	OVERVIEW_COPY.dates,
	OVERVIEW_COPY.recentChanges,
] as const;

export type OverviewModuleHeading = (typeof OVERVIEW_MODULE_HEADINGS)[number];

export const TEST_SOURCE_DETAIL = {
	gap: "Test Gap",
	handoff: "Test Handoff",
	session: "Test Session",
} as const;

export interface OverviewRecordSeed {
	accessible?: boolean;
	detail?: string;
	id: string;
	title: string;
}

export interface OverviewProjectSource {
	enabledAreas?: readonly ProjectAreaName[];
	id: string;
	lifecycleStatus: string;
	name: string;
	purpose: string | null;
	stages: ReadonlyArray<{
		id: string;
		name: string;
		state: string;
	}>;
	targetDate: string | null;
}

export interface OverviewSources {
	blockers: readonly OverviewRecordSeed[];
	dates: readonly OverviewRecordSeed[];
	decisions: readonly OverviewRecordSeed[];
	documents: readonly OverviewRecordSeed[];
	enabledAreas: readonly ProjectAreaName[];
	goals: readonly OverviewRecordSeed[];
	milestones: readonly OverviewRecordSeed[];
	productionIncidents: readonly OverviewRecordSeed[];
	project: OverviewProjectSource;
	recentChanges: readonly OverviewRecordSeed[];
	risks: readonly OverviewRecordSeed[];
	testGaps: readonly OverviewRecordSeed[];
	testHandoffs: readonly OverviewRecordSeed[];
	testSessions: readonly OverviewRecordSeed[];
	work: readonly OverviewRecordSeed[];
}

export interface OverviewRecord {
	detail: string | null;
	id: string;
	title: string;
}

export interface OverviewModule {
	count: number;
	heading: OverviewModuleHeading;
	records: OverviewRecord[];
}

export interface OverviewAreaEntry {
	entry: ProjectAreaName;
	name: ProjectAreaName;
}

export interface OverviewSourceSet {
	action: typeof OVERVIEW_COPY.openSourceRecord;
	heading: OverviewModuleHeading;
	records: OverviewRecord[];
}

export interface ProjectOverview {
	enabledAreas: OverviewAreaEntry[];
	enabledAreasLabel: typeof OVERVIEW_COPY.projectAreas;
	modules: OverviewModule[];
	openSourceRecord: typeof OVERVIEW_COPY.openSourceRecord;
}

const EMPTY_RECORD_LISTS = {
	blockers: [] as const,
	decisions: [] as const,
	documents: [] as const,
	goals: [] as const,
	milestones: [] as const,
	productionIncidents: [] as const,
	recentChanges: [] as const,
	risks: [] as const,
	testGaps: [] as const,
	testHandoffs: [] as const,
	testSessions: [] as const,
	work: [] as const,
};

function asRecords(
	records: readonly OverviewRecordSeed[],
	detail?: string
): OverviewRecord[] {
	return records
		.filter((record) => record.accessible !== false)
		.map((record) => ({
			detail: detail ?? record.detail ?? null,
			id: record.id,
			title: record.title,
		}));
}

function asModule(
	heading: OverviewModuleHeading,
	records: OverviewRecord[]
): OverviewModule {
	return {
		count: records.length,
		heading,
		records,
	};
}

function areaEntries(areas: readonly ProjectAreaName[]): OverviewAreaEntry[] {
	return areas.map((name) => ({ entry: name, name }));
}

function datesFromProject(
	project: OverviewProjectSource
): OverviewRecordSeed[] {
	if (!project.targetDate) {
		return [];
	}
	return [
		{
			detail: project.targetDate,
			id: project.id,
			title: project.name,
		},
	];
}

export function overviewSourcesFromProject(
	project: OverviewProjectSource,
	extras: Partial<Omit<OverviewSources, "project">> = {}
): OverviewSources {
	return {
		...EMPTY_RECORD_LISTS,
		dates: datesFromProject(project),
		enabledAreas: project.enabledAreas ?? [],
		...extras,
		project,
	};
}

export function projectOverview(sources: OverviewSources): ProjectOverview {
	const { project } = sources;
	return {
		enabledAreas: areaEntries(sources.enabledAreas),
		enabledAreasLabel: OVERVIEW_COPY.projectAreas,
		modules: [
			asModule(
				OVERVIEW_COPY.purpose,
				project.purpose
					? [{ detail: null, id: project.id, title: project.purpose }]
					: []
			),
			asModule(OVERVIEW_COPY.lifecycle, [
				{
					detail: null,
					id: project.id,
					title: project.lifecycleStatus,
				},
			]),
			asModule(OVERVIEW_COPY.goals, asRecords(sources.goals)),
			asModule(
				OVERVIEW_COPY.stages,
				asRecords(
					project.stages
						.filter((stage) => stage.state === STAGE_STATE.active)
						.map((stage) => ({
							detail: stage.state,
							id: stage.id,
							title: stage.name,
						}))
				)
			),
			asModule(OVERVIEW_COPY.milestones, asRecords(sources.milestones)),
			asModule(OVERVIEW_COPY.work, asRecords(sources.work)),
			asModule(OVERVIEW_COPY.documents, asRecords(sources.documents)),
			asModule(OVERVIEW_COPY.decisions, asRecords(sources.decisions)),
			asModule(OVERVIEW_COPY.risks, asRecords(sources.risks)),
			asModule(OVERVIEW_COPY.tests, [
				...asRecords(sources.testHandoffs, TEST_SOURCE_DETAIL.handoff),
				...asRecords(sources.testSessions, TEST_SOURCE_DETAIL.session),
				...asRecords(sources.testGaps, TEST_SOURCE_DETAIL.gap),
			]),
			asModule(
				OVERVIEW_COPY.production,
				asRecords(sources.productionIncidents)
			),
			asModule(OVERVIEW_COPY.blockers, asRecords(sources.blockers)),
			asModule(OVERVIEW_COPY.dates, asRecords(sources.dates)),
			asModule(OVERVIEW_COPY.recentChanges, asRecords(sources.recentChanges)),
		],
		openSourceRecord: OVERVIEW_COPY.openSourceRecord,
	};
}

export function openOverviewSourceSet(
	overview: ProjectOverview,
	heading: OverviewModuleHeading
): OverviewSourceSet {
	const module = overview.modules.find((item) => item.heading === heading);
	if (!module) {
		throw new Error(`missing ${heading} module`);
	}
	return {
		action: OVERVIEW_COPY.openSourceRecord,
		heading: module.heading,
		records: module.records,
	};
}

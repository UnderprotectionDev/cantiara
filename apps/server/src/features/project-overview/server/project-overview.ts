import { z } from "zod";

export const OVERVIEW_COPY = {
	blockers: "Blockers",
	dates: "Dates",
	decisions: "Decisions",
	documents: "Documents",
	goals: "Goals",
	lifecycle: "Lifecycle",
	milestones: "Milestones",
	overview: "Overview",
	production: "Production",
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
	id: string;
	title: string;
}

export interface OverviewDatedRecordSeed extends OverviewRecordSeed {
	at?: string;
	targetDate?: string;
}

export interface OverviewProjectSource {
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
	dates: readonly OverviewDatedRecordSeed[];
	decisions: readonly OverviewRecordSeed[];
	documents: readonly OverviewRecordSeed[];
	goals: readonly OverviewRecordSeed[];
	milestones: readonly OverviewRecordSeed[];
	productionIncidents: readonly OverviewRecordSeed[];
	project: OverviewProjectSource;
	recentChanges: readonly OverviewDatedRecordSeed[];
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
	heading: OverviewModuleHeading;
	records: OverviewRecord[];
}

export interface ProjectOverview {
	modules: OverviewModule[];
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

export const overviewRecordSchema = z.object({
	detail: z.string().min(1).nullable(),
	id: z.string().min(1),
	title: z.string().min(1),
});

export const projectOverviewSchema = z.object({
	modules: z.array(
		z.object({
			heading: z.enum(OVERVIEW_MODULE_HEADINGS),
			records: z.array(overviewRecordSchema),
		})
	),
});

function titledRecords(
	records: readonly OverviewRecordSeed[]
): OverviewRecord[] {
	return records.map((record) => ({
		detail: null,
		id: record.id,
		title: record.title,
	}));
}

function datedRecords(
	records: readonly OverviewDatedRecordSeed[]
): OverviewRecord[] {
	return records.map((record) => ({
		detail: record.targetDate ?? record.at ?? null,
		id: record.id,
		title: record.title,
	}));
}

function datesFromProject(
	project: OverviewProjectSource
): OverviewDatedRecordSeed[] {
	if (!project.targetDate) {
		return [];
	}
	return [
		{
			id: project.id,
			targetDate: project.targetDate,
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
		...extras,
		project,
	};
}

export function projectOverview(sources: OverviewSources): ProjectOverview {
	const { project } = sources;
	return {
		modules: [
			{
				heading: OVERVIEW_COPY.purpose,
				records: project.purpose
					? [{ detail: null, id: project.id, title: project.purpose }]
					: [],
			},
			{
				heading: OVERVIEW_COPY.lifecycle,
				records: [
					{
						detail: null,
						id: project.id,
						title: project.lifecycleStatus,
					},
				],
			},
			{
				heading: OVERVIEW_COPY.goals,
				records: titledRecords(sources.goals),
			},
			{
				heading: OVERVIEW_COPY.stages,
				records: project.stages.map((stage) => ({
					detail: stage.state,
					id: stage.id,
					title: stage.name,
				})),
			},
			{
				heading: OVERVIEW_COPY.milestones,
				records: titledRecords(sources.milestones),
			},
			{
				heading: OVERVIEW_COPY.work,
				records: titledRecords(sources.work),
			},
			{
				heading: OVERVIEW_COPY.documents,
				records: titledRecords(sources.documents),
			},
			{
				heading: OVERVIEW_COPY.decisions,
				records: titledRecords(sources.decisions),
			},
			{
				heading: OVERVIEW_COPY.risks,
				records: titledRecords(sources.risks),
			},
			{
				heading: OVERVIEW_COPY.tests,
				records: [
					...sources.testHandoffs.map((record) => ({
						detail: TEST_SOURCE_DETAIL.handoff,
						id: record.id,
						title: record.title,
					})),
					...sources.testSessions.map((record) => ({
						detail: TEST_SOURCE_DETAIL.session,
						id: record.id,
						title: record.title,
					})),
					...sources.testGaps.map((record) => ({
						detail: TEST_SOURCE_DETAIL.gap,
						id: record.id,
						title: record.title,
					})),
				],
			},
			{
				heading: OVERVIEW_COPY.production,
				records: titledRecords(sources.productionIncidents),
			},
			{
				heading: OVERVIEW_COPY.blockers,
				records: titledRecords(sources.blockers),
			},
			{
				heading: OVERVIEW_COPY.dates,
				records: datedRecords(sources.dates),
			},
			{
				heading: OVERVIEW_COPY.recentChanges,
				records: datedRecords(sources.recentChanges),
			},
		],
	};
}

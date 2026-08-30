import { PROJECT_LIFECYCLE } from "../../project-shell/server/project-shell-model";

import {
	type CrossProjectListProject,
	type EvaluatedCrossProjectList,
	evaluateCrossProjectLists,
	parseSavedCrossProjectLists,
	type SavedCrossProjectListDefinition,
} from "./cross-project-lists";
import { WORKSPACE_OVERVIEW_COPY } from "./workspace-overview-copy";

export const PREPARED_MODULE_HEADINGS = [
	WORKSPACE_OVERVIEW_COPY.activeProjects,
	WORKSPACE_OVERVIEW_COPY.attentionRequired,
	WORKSPACE_OVERVIEW_COPY.upcoming,
	WORKSPACE_OVERVIEW_COPY.recentWork,
] as const;

export type PreparedModuleHeading = (typeof PREPARED_MODULE_HEADINGS)[number];

export const ACTION_REQUIRED_SIGNAL_IDS = [
	"due-date",
	"reappear-date",
	"personal-reminder",
	"review-later",
	"open-risk",
	"work-blocked",
	"source-version-in-use",
	"external-run-returned",
	"release-observation-missing",
	"github-check-failed",
	"work-pr-status-conflict",
	"unlinked-open-pr",
	"published-release-open-scope",
	"automation-failed",
	"public-roadmap-review-due",
	"unreviewed-test-report",
	"test-result-conflict",
] as const;

export type ActionRequiredSignalId =
	(typeof ACTION_REQUIRED_SIGNAL_IDS)[number];

export const INFORMATION_FLOW_SIGNAL_IDS = [
	"handoff-result-after-cancel",
	"smart-collection-entry",
	"github-activity",
] as const;

export const LIVE_BLOCK_LIMIT = 6;

export const LIVE_BLOCK_KINDS = ["document", "smartCollection"] as const;

export type LiveBlockKind = (typeof LIVE_BLOCK_KINDS)[number];

const UPCOMING_KINDS = ["goalDate", "reminder"] as const;

export interface OverviewRecord {
	detail: string | null;
	id: string;
	projectId?: string;
	title: string;
}

export interface PreparedModule {
	count: number;
	heading: PreparedModuleHeading;
	hidden: boolean;
	records: OverviewRecord[];
}

export interface OverviewSourceSet {
	action: typeof WORKSPACE_OVERVIEW_COPY.openSourceRecord;
	heading: PreparedModuleHeading;
	records: OverviewRecord[];
}

export interface WorkspaceProjectSource {
	archived?: boolean;
	enabledAreas?: readonly string[];
	id: string;
	lastManualProjectUpdate?: {
		date: string;
		mark: string;
	} | null;
	lifecycleStatus: string;
	name: string;
	stageNames?: readonly string[];
	targetDate?: string | null;
}

export interface WorkspaceAttentionSource {
	id: string;
	signalId: string;
	title: string;
}

export interface WorkspaceUpcomingSource {
	date: string;
	id: string;
	kind: string;
	title: string;
}

export interface WorkspaceWorkSource {
	id: string;
	projectId?: string;
	title: string;
	touchedAt: string;
}

export interface WorkspaceNamedSource {
	body?: string;
	id: string;
	membershipRule?: string;
	title: string;
}

export interface WorkspaceOverviewSources {
	attention: readonly WorkspaceAttentionSource[];
	documents: readonly WorkspaceNamedSource[];
	favorites: readonly OverviewRecord[];
	personalWiki: readonly OverviewRecord[];
	projects: readonly WorkspaceProjectSource[];
	recentWork: readonly WorkspaceWorkSource[];
	sessionActiveWorkSet: readonly OverviewRecord[];
	smartCollections: readonly WorkspaceNamedSource[];
	upcoming: readonly WorkspaceUpcomingSource[];
}

export interface LiveBlockRef {
	kind: LiveBlockKind;
	sourceId: string;
}

export interface WorkspaceOverviewLayout {
	hidden: readonly PreparedModuleHeading[];
	liveBlocks: readonly LiveBlockRef[];
	order: readonly PreparedModuleHeading[];
	savedLists: readonly SavedCrossProjectListDefinition[];
}

export interface LiveBlockView {
	kind: LiveBlockKind;
	sourceId: string;
	title: string;
}

export interface WorkspaceOverview {
	availableLiveBlocks: LiveBlockView[];
	catalog: PreparedModule[];
	copy: typeof WORKSPACE_OVERVIEW_COPY;
	layout: WorkspaceOverviewLayout;
	liveBlocks: LiveBlockView[];
	modules: PreparedModule[];
	openSourceRecord: typeof WORKSPACE_OVERVIEW_COPY.openSourceRecord;
	savedLists: EvaluatedCrossProjectList[];
}

export const DEFAULT_WORKSPACE_OVERVIEW_LAYOUT: WorkspaceOverviewLayout = {
	hidden: [],
	liveBlocks: [],
	order: [...PREPARED_MODULE_HEADINGS],
	savedLists: [],
};

const ACTION_REQUIRED = new Set<string>(ACTION_REQUIRED_SIGNAL_IDS);
const LIVE_BLOCK_KIND_SET = new Set<string>(LIVE_BLOCK_KINDS);
const UPCOMING_KIND_SET = new Set<string>(UPCOMING_KINDS);

function isPreparedHeading(value: string): value is PreparedModuleHeading {
	return (PREPARED_MODULE_HEADINGS as readonly string[]).includes(value);
}

function asModule(
	heading: PreparedModuleHeading,
	records: OverviewRecord[],
	hidden: boolean
): PreparedModule {
	return {
		count: records.length,
		heading,
		hidden,
		records,
	};
}

function orderedHeadings(
	layout: WorkspaceOverviewLayout
): PreparedModuleHeading[] {
	const seen = new Set<PreparedModuleHeading>();
	const ordered: PreparedModuleHeading[] = [];
	for (const heading of layout.order) {
		if (isPreparedHeading(heading) && !seen.has(heading)) {
			seen.add(heading);
			ordered.push(heading);
		}
	}
	for (const heading of PREPARED_MODULE_HEADINGS) {
		if (!seen.has(heading)) {
			ordered.push(heading);
		}
	}
	return ordered;
}

function isHidden(
	layout: WorkspaceOverviewLayout,
	heading: PreparedModuleHeading
): boolean {
	return layout.hidden.includes(heading);
}

function liveBlockCatalog(
	sources: WorkspaceOverviewSources
): Map<string, LiveBlockView> {
	const catalog = new Map<string, LiveBlockView>();
	for (const document of sources.documents) {
		catalog.set(document.id, {
			kind: "document",
			sourceId: document.id,
			title: document.title,
		});
	}
	for (const collection of sources.smartCollections) {
		catalog.set(collection.id, {
			kind: "smartCollection",
			sourceId: collection.id,
			title: collection.title,
		});
	}
	return catalog;
}

export function workspaceOverview(
	sources: WorkspaceOverviewSources,
	layout: WorkspaceOverviewLayout = DEFAULT_WORKSPACE_OVERVIEW_LAYOUT
): WorkspaceOverview {
	const hidden = (heading: PreparedModuleHeading) => isHidden(layout, heading);
	const catalog: PreparedModule[] = [
		asModule(
			WORKSPACE_OVERVIEW_COPY.activeProjects,
			sources.projects
				.filter(
					(project) => project.lifecycleStatus === PROJECT_LIFECYCLE.active
				)
				.map((project) => ({
					detail: null,
					id: project.id,
					title: project.name,
				})),
			hidden(WORKSPACE_OVERVIEW_COPY.activeProjects)
		),
		asModule(
			WORKSPACE_OVERVIEW_COPY.attentionRequired,
			sources.attention
				.filter((item) => ACTION_REQUIRED.has(item.signalId))
				.map((item) => ({
					detail: item.signalId,
					id: item.id,
					title: item.title,
				})),
			hidden(WORKSPACE_OVERVIEW_COPY.attentionRequired)
		),
		asModule(
			WORKSPACE_OVERVIEW_COPY.upcoming,
			sources.upcoming
				.filter((item) => UPCOMING_KIND_SET.has(item.kind))
				.map((item) => ({
					detail: item.date,
					id: item.id,
					title: item.title,
				})),
			hidden(WORKSPACE_OVERVIEW_COPY.upcoming)
		),
		asModule(
			WORKSPACE_OVERVIEW_COPY.recentWork,
			[...sources.recentWork]
				.sort((left, right) => right.touchedAt.localeCompare(left.touchedAt))
				.map((item) => ({
					detail: item.touchedAt,
					id: item.id,
					title: item.title,
					...(item.projectId ? { projectId: item.projectId } : {}),
				})),
			hidden(WORKSPACE_OVERVIEW_COPY.recentWork)
		),
	];
	const byHeading = new Map(
		catalog.map((module) => [module.heading, module] as const)
	);
	const modules = orderedHeadings(layout)
		.map((heading) => byHeading.get(heading))
		.filter((module): module is PreparedModule => Boolean(module))
		.filter((module) => !module.hidden);
	const sourceCatalog = liveBlockCatalog(sources);
	const liveBlocks = layout.liveBlocks.flatMap((ref) => {
		if (!LIVE_BLOCK_KIND_SET.has(ref.kind)) {
			return [];
		}
		const current = sourceCatalog.get(ref.sourceId);
		if (!current || current.kind !== ref.kind) {
			return [];
		}
		return [current];
	});
	const placed = new Set(liveBlocks.map((block) => block.sourceId));
	const availableLiveBlocks = [...sourceCatalog.values()].filter(
		(item) => !placed.has(item.sourceId)
	);
	const savedLists = parseSavedCrossProjectLists(layout.savedLists);
	const normalizedLayout: WorkspaceOverviewLayout = {
		hidden: orderedHeadings(layout).filter((heading) =>
			isHidden(layout, heading)
		),
		liveBlocks: liveBlocks.map((block) => ({
			kind: block.kind,
			sourceId: block.sourceId,
		})),
		order: orderedHeadings(layout),
		savedLists,
	};
	return {
		availableLiveBlocks,
		catalog,
		copy: WORKSPACE_OVERVIEW_COPY,
		layout: normalizedLayout,
		liveBlocks,
		modules,
		openSourceRecord: WORKSPACE_OVERVIEW_COPY.openSourceRecord,
		savedLists: evaluateCrossProjectLists(
			sources.projects.map(asListProject),
			savedLists
		),
	};
}

function asListProject(
	project: WorkspaceProjectSource
): CrossProjectListProject {
	return {
		archived: project.archived === true,
		enabledAreas: project.enabledAreas ?? [],
		id: project.id,
		lastManualProjectUpdate: project.lastManualProjectUpdate ?? null,
		lifecycleStatus: project.lifecycleStatus,
		name: project.name,
		stageNames: project.stageNames ?? [],
		targetDate: project.targetDate ?? null,
	};
}

export function openWorkspaceOverviewSourceSet(
	overview: WorkspaceOverview,
	heading: PreparedModuleHeading
): OverviewSourceSet {
	const module = overview.catalog.find((item) => item.heading === heading);
	if (!module) {
		throw new Error(`missing ${heading} module`);
	}
	return {
		action: WORKSPACE_OVERVIEW_COPY.openSourceRecord,
		heading: module.heading,
		records: module.records,
	};
}

export function hidePreparedModule(
	layout: WorkspaceOverviewLayout,
	heading: PreparedModuleHeading
): WorkspaceOverviewLayout {
	if (layout.hidden.includes(heading)) {
		return layout;
	}
	return { ...layout, hidden: [...layout.hidden, heading] };
}

export function showPreparedModule(
	layout: WorkspaceOverviewLayout,
	heading: PreparedModuleHeading
): WorkspaceOverviewLayout {
	return {
		...layout,
		hidden: layout.hidden.filter((item) => item !== heading),
	};
}

export function movePreparedModule(
	layout: WorkspaceOverviewLayout,
	heading: PreparedModuleHeading,
	direction: "down" | "up"
): WorkspaceOverviewLayout {
	const order = orderedHeadings(layout);
	const index = order.indexOf(heading);
	const target = direction === "up" ? index - 1 : index + 1;
	if (index < 0 || target < 0 || target >= order.length) {
		return { ...layout, order };
	}
	const next = [...order];
	const [moved] = next.splice(index, 1);
	if (!moved) {
		return { ...layout, order };
	}
	next.splice(target, 0, moved);
	return { ...layout, order: next };
}

export type AddLiveBlockResult =
	| { layout: WorkspaceOverviewLayout; status: "ok" }
	| {
			reason: "duplicate" | "live-block-limit" | "unknown-source";
			status: "rejected";
	  };

export function addPersonalLiveBlock(
	layout: WorkspaceOverviewLayout,
	sources: WorkspaceOverviewSources,
	ref: { kind: string; sourceId: string }
): AddLiveBlockResult {
	if (!LIVE_BLOCK_KIND_SET.has(ref.kind)) {
		return { reason: "unknown-source", status: "rejected" };
	}
	const catalog = liveBlockCatalog(sources);
	const current = catalog.get(ref.sourceId);
	if (!current || current.kind !== ref.kind) {
		return { reason: "unknown-source", status: "rejected" };
	}
	if (layout.liveBlocks.some((item) => item.sourceId === ref.sourceId)) {
		return { reason: "duplicate", status: "rejected" };
	}
	if (layout.liveBlocks.length >= LIVE_BLOCK_LIMIT) {
		return { reason: "live-block-limit", status: "rejected" };
	}
	return {
		layout: {
			...layout,
			liveBlocks: [
				...layout.liveBlocks,
				{ kind: ref.kind as LiveBlockKind, sourceId: ref.sourceId },
			],
		},
		status: "ok",
	};
}

export function removePersonalLiveBlock(
	layout: WorkspaceOverviewLayout,
	sourceId: string
): WorkspaceOverviewLayout {
	return {
		...layout,
		liveBlocks: layout.liveBlocks.filter((item) => item.sourceId !== sourceId),
	};
}

export function sourcesFromWorkspaceSnapshot(snapshot: {
	projects: ReadonlyArray<{
		areaSettings?: ReadonlyArray<{ enabled: boolean; name: string }>;
		archived?: boolean;
		enabledAreas?: readonly string[];
		id: string;
		lastManualProjectUpdate?: { date: string; mark: string } | null;
		lifecycleStatus: string;
		name: string;
		stageNames?: readonly string[];
		stages?: ReadonlyArray<{ name: string }>;
		targetDate: string | null;
	}>;
	works: ReadonlyArray<{
		archived: boolean;
		id: string;
		projectId?: string;
		title: string;
		updatedAt: Date | string;
	}>;
}): WorkspaceOverviewSources {
	return {
		attention: [],
		documents: [],
		favorites: [],
		personalWiki: [],
		projects: snapshot.projects.map((project) => ({
			archived: project.archived === true,
			enabledAreas:
				project.enabledAreas ??
				(project.areaSettings ?? [])
					.filter((area) => area.enabled)
					.map((area) => area.name),
			id: project.id,
			lastManualProjectUpdate: project.lastManualProjectUpdate ?? null,
			lifecycleStatus: project.lifecycleStatus,
			name: project.name,
			stageNames:
				project.stageNames ?? (project.stages ?? []).map((stage) => stage.name),
			targetDate: project.targetDate,
		})),
		recentWork: snapshot.works
			.filter((work) => !work.archived)
			.map((work) => ({
				id: work.id,
				projectId: work.projectId,
				title: work.title,
				touchedAt:
					typeof work.updatedAt === "string"
						? work.updatedAt
						: work.updatedAt.toISOString(),
			})),
		sessionActiveWorkSet: [],
		smartCollections: [],
		upcoming: snapshot.projects.flatMap((project) => {
			if (
				project.lifecycleStatus !== PROJECT_LIFECYCLE.active ||
				!project.targetDate
			) {
				return [];
			}
			return [
				{
					date: project.targetDate,
					id: project.id,
					kind: "goalDate",
					title: project.name,
				},
			];
		}),
	};
}

export function parseWorkspaceOverviewLayout(
	value: unknown
): WorkspaceOverviewLayout {
	if (!value || typeof value !== "object") {
		return DEFAULT_WORKSPACE_OVERVIEW_LAYOUT;
	}
	const record = value as Record<string, unknown>;
	const hidden = Array.isArray(record.hidden)
		? record.hidden.filter(
				(item): item is PreparedModuleHeading =>
					typeof item === "string" && isPreparedHeading(item)
			)
		: [];
	const order = Array.isArray(record.order)
		? record.order.filter(
				(item): item is PreparedModuleHeading =>
					typeof item === "string" && isPreparedHeading(item)
			)
		: [...PREPARED_MODULE_HEADINGS];
	const liveBlocks = Array.isArray(record.liveBlocks)
		? record.liveBlocks.flatMap((item) => {
				if (!item || typeof item !== "object") {
					return [];
				}
				const ref = item as Record<string, unknown>;
				if (
					typeof ref.kind !== "string" ||
					typeof ref.sourceId !== "string" ||
					!LIVE_BLOCK_KIND_SET.has(ref.kind)
				) {
					return [];
				}
				return [{ kind: ref.kind as LiveBlockKind, sourceId: ref.sourceId }];
			})
		: [];
	return {
		hidden,
		liveBlocks,
		order,
		savedLists: parseSavedCrossProjectLists(record.savedLists),
	};
}

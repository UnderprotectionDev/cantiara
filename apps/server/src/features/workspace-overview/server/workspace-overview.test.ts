/**
 * Workspace Overview seam — four prepared modules from source records,
 * drill-down with Open source record, personal layout, live blocks as
 * references, named cross-Project lists from live conditions, no health
 * score / Mission Control / Wiki-as-Project / widget builder / Portfolio
 * membership. Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (İlk Proje Workspace overview slice).
 */
import { describe, expect, it } from "vitest";

import { PROJECT_LIFECYCLE } from "../../project-shell/server/project-shell-model";
import {
	addCrossProjectListMemberByDrag,
	CROSS_PROJECT_LIST_KIND,
	saveCrossProjectList,
} from "./cross-project-lists";
import {
	ACTION_REQUIRED_SIGNAL_IDS,
	addPersonalLiveBlock,
	hidePreparedModule,
	INFORMATION_FLOW_SIGNAL_IDS,
	LIVE_BLOCK_LIMIT,
	movePreparedModule,
	openWorkspaceOverviewSourceSet,
	PREPARED_MODULE_HEADINGS,
	removePersonalLiveBlock,
	showPreparedModule,
	sourcesFromWorkspaceSnapshot,
	type WorkspaceOverviewLayout,
	type WorkspaceOverviewSources,
	workspaceOverview,
} from "./workspace-overview";
import { WORKSPACE_OVERVIEW_COPY } from "./workspace-overview-copy";

const HEALTH_KEYS = [
	"atRisk",
	"healthScore",
	"missionControl",
	"offTrack",
	"onTrack",
	"portfolio",
	"trafficLight",
] as const;

const PROJECT_OVERVIEW_HEADINGS = [
	"Purpose",
	"Lifecycle",
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

const INVENTED_ROW_PATTERN =
	/Get started|No \w+ yet|placeholder|health failure/i;
const FORBIDDEN_SURFACE_PATTERN =
	/Mission Control|Portfolio|Home board|Lineup|Gantt|widget builder|Daily Focus/;
const WIKI_AS_PROJECT_PATTERN = /Personal Wiki|Wiki as Project/;
const FORBIDDEN_LIST_PATTERN =
	/Portfolio|Program|parent Project|folder|smartCollection/;

const EMPTY_SOURCES: WorkspaceOverviewSources = {
	attention: [],
	documents: [],
	favorites: [],
	personalWiki: [],
	projects: [],
	recentWork: [],
	sessionActiveWorkSet: [],
	smartCollections: [],
	upcoming: [],
};

const DEFAULT_LAYOUT: WorkspaceOverviewLayout = {
	hidden: [],
	liveBlocks: [],
	order: [...PREPARED_MODULE_HEADINGS],
	savedLists: [],
};

function collectKeys(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.flatMap(collectKeys);
	}
	if (value && typeof value === "object") {
		return [
			...Object.keys(value),
			...Object.values(value).flatMap(collectKeys),
		];
	}
	return [];
}

function headingsOf(
	overview: ReturnType<typeof workspaceOverview>
): readonly string[] {
	return overview.modules.map((module) => module.heading);
}

function moduleOf(
	overview: ReturnType<typeof workspaceOverview>,
	heading: (typeof PREPARED_MODULE_HEADINGS)[number]
) {
	const module = overview.catalog.find((item) => item.heading === heading);
	if (!module) {
		throw new Error(`missing ${heading} module`);
	}
	return module;
}

describe("Workspace Overview", () => {
	it("opens with the four prepared English modules and invents no rows", () => {
		const overview = workspaceOverview(EMPTY_SOURCES, DEFAULT_LAYOUT);
		expect(headingsOf(overview)).toEqual([...PREPARED_MODULE_HEADINGS]);
		expect(overview.openSourceRecord).toBe("Open source record");
		expect(moduleOf(overview, "Active Projects")).toEqual({
			count: 0,
			heading: "Active Projects",
			hidden: false,
			records: [],
		});
		expect(moduleOf(overview, "Attention Required").count).toBe(0);
		expect(moduleOf(overview, "Upcoming").count).toBe(0);
		expect(moduleOf(overview, "Recent Work").count).toBe(0);
		expect(JSON.stringify(overview.modules)).not.toMatch(INVENTED_ROW_PATTERN);
	});

	it("lists only Active Projects and opens the exact set with Open source record", () => {
		const overview = workspaceOverview(
			{
				...EMPTY_SOURCES,
				projects: [
					{
						id: "project-atlas",
						lifecycleStatus: PROJECT_LIFECYCLE.active,
						name: "Atlas",
					},
					{
						id: "project-done",
						lifecycleStatus: PROJECT_LIFECYCLE.completed,
						name: "Shipped",
					},
					{
						id: "project-wait",
						lifecycleStatus: PROJECT_LIFECYCLE.pending,
						name: "Queued",
					},
					{
						id: "project-drop",
						lifecycleStatus: PROJECT_LIFECYCLE.abandoned,
						name: "Dropped",
					},
				],
			},
			DEFAULT_LAYOUT
		);
		expect(moduleOf(overview, "Active Projects").records).toEqual([
			{ detail: null, id: "project-atlas", title: "Atlas" },
		]);
		expect(moduleOf(overview, "Active Projects").count).toBe(1);
		expect(openWorkspaceOverviewSourceSet(overview, "Active Projects")).toEqual(
			{
				action: WORKSPACE_OVERVIEW_COPY.openSourceRecord,
				heading: "Active Projects",
				records: moduleOf(overview, "Active Projects").records,
			}
		);
		expect(JSON.stringify(overview)).not.toContain("Shipped");
		expect(JSON.stringify(overview)).not.toContain("Queued");
		expect(JSON.stringify(overview)).not.toContain("Dropped");
	});

	it("gathers only registered Action Required attention and ignores Information Flow ids", () => {
		const overview = workspaceOverview(
			{
				...EMPTY_SOURCES,
				attention: [
					{
						id: "risk-1",
						signalId: "open-risk",
						title: "GitHub outage during login",
					},
					{
						id: "block-1",
						signalId: "work-blocked",
						title: "Waiting on GitHub App",
					},
					{
						id: "due-1",
						signalId: "due-date",
						title: "Ship date is due",
					},
					{
						id: "info-1",
						signalId: "github-activity",
						title: "PR comment",
					},
					{
						id: "invented-1",
						signalId: "unregistered-panic",
						title: "Invented alarm",
					},
				],
			},
			DEFAULT_LAYOUT
		);
		expect(moduleOf(overview, "Attention Required").records).toEqual([
			{
				detail: "open-risk",
				id: "risk-1",
				title: "GitHub outage during login",
			},
			{ detail: "work-blocked", id: "block-1", title: "Waiting on GitHub App" },
			{ detail: "due-date", id: "due-1", title: "Ship date is due" },
		]);
		expect(ACTION_REQUIRED_SIGNAL_IDS).toContain("open-risk");
		expect(ACTION_REQUIRED_SIGNAL_IDS).toContain("work-blocked");
		expect(INFORMATION_FLOW_SIGNAL_IDS).toContain("github-activity");
		expect(JSON.stringify(overview)).not.toContain("PR comment");
		expect(JSON.stringify(overview)).not.toContain("Invented alarm");
		expect(JSON.stringify(overview)).not.toContain("unregistered-panic");
		expect(
			openWorkspaceOverviewSourceSet(overview, "Attention Required").action
		).toBe("Open source record");
	});

	it("shows Upcoming from approaching goal dates and reminders only", () => {
		const overview = workspaceOverview(
			{
				...EMPTY_SOURCES,
				upcoming: [
					{
						date: "2026-09-01",
						id: "goal-1",
						kind: "goalDate",
						projectId: "proj_1",
						title: "Reach İlk Proje",
					},
					{
						date: "2026-09-02",
						id: "reminder-1",
						kind: "reminder",
						title: "Review capture notes",
					},
					{
						date: "2026-09-03",
						id: "other-1",
						kind: "milestone",
						title: "Not a v1 Upcoming source",
					},
				],
			},
			DEFAULT_LAYOUT
		);
		expect(moduleOf(overview, "Upcoming").records).toEqual([
			{
				detail: "2026-09-01",
				id: "goal-1",
				projectId: "proj_1",
				title: "Reach İlk Proje",
			},
			{ detail: "2026-09-02", id: "reminder-1", title: "Review capture notes" },
		]);
		expect(JSON.stringify(overview)).not.toContain("Not a v1 Upcoming source");
		expect(
			openWorkspaceOverviewSourceSet(overview, "Upcoming").records
		).toEqual(moduleOf(overview, "Upcoming").records);
	});

	it("shows Recent Work from source activity and does not write Favorites or the session Active Work Set", () => {
		const overview = workspaceOverview(
			{
				...EMPTY_SOURCES,
				favorites: [{ id: "fav-1", title: "Pinned note" }],
				recentWork: [
					{
						id: "work-2",
						title: "Rename Short code",
						touchedAt: "2026-08-27T12:00:00.000Z",
					},
					{
						id: "work-1",
						title: "Create Project",
						touchedAt: "2026-08-28T12:00:00.000Z",
					},
				],
				sessionActiveWorkSet: [{ id: "set-1", title: "Session card" }],
			},
			DEFAULT_LAYOUT
		);
		expect(moduleOf(overview, "Recent Work").records).toEqual([
			{
				detail: "2026-08-28T12:00:00.000Z",
				id: "work-1",
				title: "Create Project",
			},
			{
				detail: "2026-08-27T12:00:00.000Z",
				id: "work-2",
				title: "Rename Short code",
			},
		]);
		expect(JSON.stringify(overview)).not.toContain("Pinned note");
		expect(JSON.stringify(overview)).not.toContain("Session card");
		expect(collectKeys(overview)).not.toContain("favorites");
		expect(collectKeys(overview)).not.toContain("sessionActiveWorkSet");
	});

	it("does not emit an independent health judgment or Mission Control rollup", () => {
		const overview = workspaceOverview(
			{
				...EMPTY_SOURCES,
				projects: [
					{
						id: "project-atlas",
						lifecycleStatus: PROJECT_LIFECYCLE.active,
						name: "Atlas",
					},
				],
			},
			DEFAULT_LAYOUT
		);
		const keys = collectKeys(overview);
		for (const key of HEALTH_KEYS) {
			expect(keys).not.toContain(key);
		}
		expect(headingsOf(overview)).not.toEqual(
			expect.arrayContaining(["Health", "On Track", "At Risk", "Off Track"])
		);
		expect(JSON.stringify(overview)).not.toMatch(FORBIDDEN_SURFACE_PATTERN);
	});

	it("does not mix Project Overview, personal shell, or Wiki-as-Project into this horizon", () => {
		const overview = workspaceOverview(
			{
				...EMPTY_SOURCES,
				personalWiki: [{ id: "wiki-1", title: "Founder journal" }],
				projects: [
					{
						id: "project-atlas",
						lifecycleStatus: PROJECT_LIFECYCLE.active,
						name: "Atlas",
					},
				],
			},
			DEFAULT_LAYOUT
		);
		const headings = headingsOf(overview);
		for (const heading of PROJECT_OVERVIEW_HEADINGS) {
			expect(headings).not.toContain(heading);
		}
		expect(JSON.stringify(moduleOf(overview, "Active Projects"))).not.toContain(
			"Founder journal"
		);
		expect(JSON.stringify(overview)).not.toMatch(WIKI_AS_PROJECT_PATTERN);
		expect(headings).not.toContain("Daily Focus");
		expect(headings).not.toContain("Favorites");
	});

	it("hides a prepared module without deleting source records and restores it on show", () => {
		const sources: WorkspaceOverviewSources = {
			...EMPTY_SOURCES,
			projects: [
				{
					id: "project-atlas",
					lifecycleStatus: PROJECT_LIFECYCLE.active,
					name: "Atlas",
				},
			],
		};
		const hiddenLayout = hidePreparedModule(DEFAULT_LAYOUT, "Active Projects");
		const hidden = workspaceOverview(sources, hiddenLayout);
		expect(headingsOf(hidden)).toEqual([
			"Attention Required",
			"Upcoming",
			"Recent Work",
		]);
		expect(moduleOf(hidden, "Active Projects").hidden).toBe(true);
		expect(moduleOf(hidden, "Active Projects").records).toEqual([
			{ detail: null, id: "project-atlas", title: "Atlas" },
		]);
		expect(
			openWorkspaceOverviewSourceSet(hidden, "Active Projects").records
		).toEqual([{ detail: null, id: "project-atlas", title: "Atlas" }]);
		const shown = workspaceOverview(
			sources,
			showPreparedModule(hiddenLayout, "Active Projects")
		);
		expect(headingsOf(shown)[0]).toBe("Active Projects");
		expect(moduleOf(shown, "Active Projects").hidden).toBe(false);
		expect(sources.projects).toHaveLength(1);
	});

	it("reorders prepared modules without writing Project lifecycle", () => {
		const sources: WorkspaceOverviewSources = {
			...EMPTY_SOURCES,
			projects: [
				{
					id: "project-atlas",
					lifecycleStatus: PROJECT_LIFECYCLE.active,
					name: "Atlas",
				},
			],
		};
		const moved = movePreparedModule(DEFAULT_LAYOUT, "Recent Work", "up");
		const overview = workspaceOverview(sources, moved);
		expect(headingsOf(overview)).toEqual([
			"Active Projects",
			"Attention Required",
			"Recent Work",
			"Upcoming",
		]);
		expect(sources.projects[0]?.lifecycleStatus).toBe(PROJECT_LIFECYCLE.active);
	});

	it("adds a Document or named Smart Collection as a live reference that does not copy body or membership", () => {
		const sources: WorkspaceOverviewSources = {
			...EMPTY_SOURCES,
			documents: [
				{
					body: "Secret draft body",
					id: "doc-1",
					title: "Founder notes",
				},
			],
			smartCollections: [
				{
					id: "collection-1",
					membershipRule: "status = Blocked",
					title: "Blocked Work",
				},
			],
		};
		const withDoc = addPersonalLiveBlock(DEFAULT_LAYOUT, sources, {
			kind: "document",
			sourceId: "doc-1",
		});
		expect(withDoc.status).toBe("ok");
		if (withDoc.status !== "ok") {
			throw new Error("expected live block");
		}
		const withBoth = addPersonalLiveBlock(withDoc.layout, sources, {
			kind: "smartCollection",
			sourceId: "collection-1",
		});
		expect(withBoth.status).toBe("ok");
		if (withBoth.status !== "ok") {
			throw new Error("expected second live block");
		}
		const overview = workspaceOverview(sources, withBoth.layout);
		expect(overview.liveBlocks).toEqual([
			{
				kind: "document",
				sourceId: "doc-1",
				title: "Founder notes",
			},
			{
				kind: "smartCollection",
				sourceId: "collection-1",
				title: "Blocked Work",
			},
		]);
		expect(JSON.stringify(overview.liveBlocks)).not.toContain(
			"Secret draft body"
		);
		expect(JSON.stringify(overview.liveBlocks)).not.toContain(
			"status = Blocked"
		);
		expect(overview.availableLiveBlocks).toEqual([]);
		const renamed = workspaceOverview(
			{
				...sources,
				documents: [{ id: "doc-1", title: "Founder notes v2" }],
			},
			withBoth.layout
		);
		expect(renamed.liveBlocks[0]?.title).toBe("Founder notes v2");
	});

	it("derives Active Projects, Upcoming goal dates, and Recent Work from Workspace snapshot records", () => {
		const overview = workspaceOverview(
			sourcesFromWorkspaceSnapshot({
				projects: [
					{
						id: "project-atlas",
						lifecycleStatus: PROJECT_LIFECYCLE.active,
						name: "Atlas",
						targetDate: "2026-09-01",
					},
					{
						id: "project-done",
						lifecycleStatus: PROJECT_LIFECYCLE.completed,
						name: "Shipped",
						targetDate: "2026-10-01",
					},
				],
				works: [
					{
						archived: true,
						id: "work-old",
						title: "Archived note",
						updatedAt: "2026-08-29T12:00:00.000Z",
					},
					{
						archived: false,
						id: "work-1",
						title: "Create Project",
						updatedAt: "2026-08-28T12:00:00.000Z",
					},
				],
			}),
			DEFAULT_LAYOUT
		);
		expect(moduleOf(overview, "Active Projects").records).toEqual([
			{ detail: null, id: "project-atlas", title: "Atlas" },
		]);
		expect(moduleOf(overview, "Upcoming").records).toEqual([
			{
				detail: "2026-09-01",
				id: "project-atlas",
				projectId: "project-atlas",
				title: "Atlas",
			},
		]);
		expect(moduleOf(overview, "Recent Work").records).toEqual([
			{
				detail: "2026-08-28T12:00:00.000Z",
				id: "work-1",
				title: "Create Project",
			},
		]);
		expect(JSON.stringify(overview)).not.toContain("Archived note");
		expect(JSON.stringify(overview)).not.toContain("Shipped");
	});

	it("rejects a seventh live block and free-form widgets, and keeps the limit closed", () => {
		let layout = DEFAULT_LAYOUT;
		const documents = Array.from(
			{ length: LIVE_BLOCK_LIMIT + 1 },
			(_, index) => ({
				id: `doc-${index + 1}`,
				title: `Note ${index + 1}`,
			})
		);
		const sources: WorkspaceOverviewSources = {
			...EMPTY_SOURCES,
			documents,
		};
		for (let index = 0; index < LIVE_BLOCK_LIMIT; index += 1) {
			const added = addPersonalLiveBlock(layout, sources, {
				kind: "document",
				sourceId: `doc-${index + 1}`,
			});
			expect(added.status).toBe("ok");
			if (added.status !== "ok") {
				throw new Error("expected live block");
			}
			({ layout } = added);
		}
		const overflow = addPersonalLiveBlock(layout, sources, {
			kind: "document",
			sourceId: `doc-${LIVE_BLOCK_LIMIT + 1}`,
		});
		expect(overflow).toEqual({
			reason: "live-block-limit",
			status: "rejected",
		});
		expect(LIVE_BLOCK_LIMIT).toBe(6);
		const widget = addPersonalLiveBlock(layout, sources, {
			kind: "widget",
			sourceId: "chart-1",
		});
		expect(widget.status).toBe("rejected");
		const removed = removePersonalLiveBlock(layout, "doc-1");
		expect(removed.liveBlocks).toHaveLength(LIVE_BLOCK_LIMIT - 1);
	});

	it("derives named cross-Project list membership from live conditions and changes it when conditions change", () => {
		const sources: WorkspaceOverviewSources = {
			...EMPTY_SOURCES,
			projects: [
				{
					archived: false,
					enabledAreas: ["Work", "Documents", "GitHub"],
					id: "project-atlas",
					lastManualProjectUpdate: {
						date: "2026-08-20",
						mark: "On Track",
					},
					lifecycleStatus: PROJECT_LIFECYCLE.active,
					name: "Atlas",
					stageNames: ["Build"],
					targetDate: "2026-09-01",
				},
				{
					archived: false,
					enabledAreas: ["Work", "Documents"],
					id: "project-done",
					lastManualProjectUpdate: null,
					lifecycleStatus: PROJECT_LIFECYCLE.completed,
					name: "Shipped",
					stageNames: ["Operate"],
					targetDate: "2026-05-01",
				},
				{
					archived: true,
					enabledAreas: ["Work"],
					id: "project-old",
					lastManualProjectUpdate: null,
					lifecycleStatus: PROJECT_LIFECYCLE.completed,
					name: "Vault",
					stageNames: ["Maintain"],
					targetDate: null,
				},
			],
		};
		const saved = saveCrossProjectList(DEFAULT_LAYOUT, {
			columns: ["name", "lifecycle", "lastReportedHealth"],
			conditions: {
				archived: false,
				enabledAreas: ["GitHub"],
				lifecycleStatuses: [PROJECT_LIFECYCLE.active],
				stageNames: ["Build"],
				targetDateOnOrAfter: "2026-08-01",
				targetDateOnOrBefore: "2026-10-01",
			},
			grouping: "lifecycle",
			id: "list-active-github",
			name: "Active GitHub",
			sort: { column: "name", direction: "asc" },
		});
		expect(saved.status).toBe("ok");
		if (saved.status !== "ok") {
			throw new Error("expected saved list");
		}
		const overview = workspaceOverview(sources, saved.layout);
		expect(overview.savedLists).toEqual([
			{
				columns: ["name", "lifecycle", "lastReportedHealth"],
				conditions: {
					archived: false,
					enabledAreas: ["GitHub"],
					lifecycleStatuses: [PROJECT_LIFECYCLE.active],
					stageNames: ["Build"],
					targetDateOnOrAfter: "2026-08-01",
					targetDateOnOrBefore: "2026-10-01",
				},
				grouping: "lifecycle",
				groups: [
					{
						heading: PROJECT_LIFECYCLE.active,
						rows: [
							{
								areas: ["Work", "Documents", "GitHub"],
								id: "project-atlas",
								lastReportedHealth: {
									date: "2026-08-20",
									label: WORKSPACE_OVERVIEW_COPY.lastReportedHealth,
									mark: "On Track",
								},
								lifecycle: PROJECT_LIFECYCLE.active,
								name: "Atlas",
								stage: "Build",
								targetDate: "2026-09-01",
							},
						],
					},
				],
				id: "list-active-github",
				kind: CROSS_PROJECT_LIST_KIND,
				name: "Active GitHub",
				rows: [
					{
						areas: ["Work", "Documents", "GitHub"],
						id: "project-atlas",
						lastReportedHealth: {
							date: "2026-08-20",
							label: WORKSPACE_OVERVIEW_COPY.lastReportedHealth,
							mark: "On Track",
						},
						lifecycle: PROJECT_LIFECYCLE.active,
						name: "Atlas",
						stage: "Build",
						targetDate: "2026-09-01",
					},
				],
				sort: { column: "name", direction: "asc" },
			},
		]);
		expect(overview.layout.savedLists[0]?.id).toBe("list-active-github");
		const widened = saveCrossProjectList(saved.layout, {
			conditions: {
				archived: false,
				lifecycleStatuses: [PROJECT_LIFECYCLE.completed],
			},
			id: "list-active-github",
			name: "Completed unarchived",
		});
		expect(widened.status).toBe("ok");
		if (widened.status !== "ok") {
			throw new Error("expected updated list");
		}
		const next = workspaceOverview(sources, widened.layout);
		const [completed] = next.savedLists;
		if (!completed) {
			throw new Error("expected updated list");
		}
		expect(completed.id).toBe("list-active-github");
		expect(completed.rows.map((row) => row.name)).toEqual(["Shipped"]);
		expect(JSON.stringify(next.savedLists)).not.toContain("Vault");
		expect(JSON.stringify(next.savedLists)).not.toContain("Atlas");
	});

	it("rejects drag-on membership and does not mint Portfolio, Program, or parent Project records", () => {
		const sources: WorkspaceOverviewSources = {
			...EMPTY_SOURCES,
			projects: [
				{
					archived: false,
					enabledAreas: ["Work"],
					id: "project-atlas",
					lastManualProjectUpdate: null,
					lifecycleStatus: PROJECT_LIFECYCLE.pending,
					name: "Atlas",
					stageNames: ["Discovery"],
					targetDate: null,
				},
			],
		};
		const saved = saveCrossProjectList(DEFAULT_LAYOUT, {
			conditions: { lifecycleStatuses: [PROJECT_LIFECYCLE.active] },
			id: "list-active",
			name: "Active only",
		});
		expect(saved.status).toBe("ok");
		if (saved.status !== "ok") {
			throw new Error("expected saved list");
		}
		const overview = workspaceOverview(sources, saved.layout);
		expect(overview.savedLists[0]?.rows).toEqual([]);
		const dragged = addCrossProjectListMemberByDrag(
			overview,
			"list-active",
			"project-atlas"
		);
		expect(dragged).toEqual({
			copy: WORKSPACE_OVERVIEW_COPY.membershipFromConditions,
			reason: "membership-from-conditions",
			status: "rejected",
		});
		const afterDrag = workspaceOverview(sources, saved.layout);
		expect(afterDrag.savedLists[0]?.rows).toEqual([]);
		expect(JSON.stringify(afterDrag.savedLists)).not.toMatch(
			FORBIDDEN_LIST_PATTERN
		);
		expect(afterDrag.savedLists[0]?.kind).toBe(CROSS_PROJECT_LIST_KIND);
		expect(CROSS_PROJECT_LIST_KIND).toBe("workspaceCrossProjectList");
	});

	it("stores supported columns, sort, and grouping without becoming report truth or a Smart Collection", () => {
		const sources: WorkspaceOverviewSources = {
			...EMPTY_SOURCES,
			projects: [
				{
					archived: false,
					enabledAreas: ["Tests"],
					id: "project-beta",
					lastManualProjectUpdate: {
						date: "2026-08-01",
						mark: "At Risk",
					},
					lifecycleStatus: PROJECT_LIFECYCLE.pending,
					name: "Beta",
					stageNames: ["Validate"],
					targetDate: "2026-12-01",
				},
				{
					archived: false,
					enabledAreas: ["Work"],
					id: "project-alpha",
					lastManualProjectUpdate: null,
					lifecycleStatus: PROJECT_LIFECYCLE.active,
					name: "Alpha",
					stageNames: ["Build"],
					targetDate: "2026-09-01",
				},
			],
			smartCollections: [
				{
					id: "collection-1",
					membershipRule: "type = Feature",
					title: "Features",
				},
			],
		};
		const listed = saveCrossProjectList(DEFAULT_LAYOUT, {
			columns: ["name", "lifecycle", "stage"],
			grouping: "lifecycle",
			id: "list-sorted",
			name: "By lifecycle",
			sort: { column: "name", direction: "asc" },
		});
		expect(listed.status).toBe("ok");
		if (listed.status !== "ok") {
			throw new Error("expected saved list");
		}
		const overview = workspaceOverview(sources, listed.layout);
		const [evaluated] = overview.savedLists;
		if (!evaluated) {
			throw new Error("expected evaluated list");
		}
		expect(evaluated.columns).toEqual(["name", "lifecycle", "stage"]);
		expect(evaluated.sort).toEqual({
			column: "name",
			direction: "asc",
		});
		expect(evaluated.grouping).toBe("lifecycle");
		expect(evaluated.rows.map((row) => row.name)).toEqual(["Alpha", "Beta"]);
		expect(evaluated.groups?.map((group) => group.heading)).toEqual([
			PROJECT_LIFECYCLE.active,
			PROJECT_LIFECYCLE.pending,
		]);
		expect(evaluated.kind).not.toBe("smartCollection");
		expect(JSON.stringify(overview.savedLists)).not.toContain("Features");
		expect(JSON.stringify(overview.savedLists)).not.toContain("type = Feature");
		for (const key of HEALTH_KEYS) {
			expect(JSON.stringify(evaluated)).not.toContain(key);
		}
		expect(overview.copy.lastReportedHealth).toBe("Last reported health");
		const health = evaluated.rows.find(
			(row) => row.id === "project-beta"
		)?.lastReportedHealth;
		expect(health).toEqual({
			date: "2026-08-01",
			label: "Last reported health",
			mark: "At Risk",
		});
		expect(health?.date).toBeTruthy();
		const bare = evaluated.rows.find(
			(row) => row.id === "project-alpha"
		)?.lastReportedHealth;
		expect(bare).toBeNull();
	});
});

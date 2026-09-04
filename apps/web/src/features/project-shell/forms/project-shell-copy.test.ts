import { expect, test } from "vitest";

import {
	CONFIGURATION_MODE_EDITORS,
	isWorkShellAnchor,
	PROJECT_SHELL_COPY,
	pinnedNavigationAreas,
	projectNavPinnedAreas,
	projectNavRecordAreas,
	projectPersistentNav,
	projectShellAnchor,
	projectShellChrome,
	projectShellHashForWorkSelect,
	projectShellSearch,
	projectShellShowsWorkSurface,
	STARTER_CONFIGURATIONS,
	structureCopyPreviewItems,
	workSavedViewIsBoard,
	workSavedViewIsList,
	workSavedViewIsRoadmap,
} from "./project-shell-copy";

const COPY_BRANDING_PATTERN = /color|CSS|font/i;

test("English chrome uses Project Name and Short code", () => {
	expect(projectShellChrome()).toMatchObject({
		addStage: "Add stage",
		allTools: "All Tools",
		areaNotAvailable: "This area is not available yet.",
		configurationMode: "Configuration Mode",
		copyProjectStructure: "Copy project structure",
		create: "Create",
		createProject: "Create Project",
		customField: "Custom field",
		dismiss: "Dismiss",
		edit: "Edit",
		enable: "Enable",
		hide: "Hide",
		noProjects: "No Projects yet.",
		notPlanned: "Not Planned",
		overview: "Overview",
		pinToNavigation: "Pin to navigation",
		planning: "Planning",
		priorityMetrics: "Priority metrics",
		projectName: "Project Name",
		ready: "Ready",
		recordAction: "Record Action",
		removeStage: "Remove stage",
		restoreDefaultNavigation: "Restore default navigation",
		save: "Save",
		savedViews: "Saved views",
		shortCode: "Short code",
		shortCodeLocked: "Short code is locked after the first Work.",
		stageNameRequired: "Stage name is required.",
		starterConfiguration: "Starter Configuration",
		status: "Status",
		workContextCardLayout: "Work Context Card layout",
		workStatusLabelRequired: "Work status label is required.",
		workTemplate: "Work Template",
	});
	expect(STARTER_CONFIGURATIONS).toEqual([
		"Blank Project",
		"Solo SaaS",
		"Open Source Library",
		"Mobile Application",
	]);
	expect(JSON.stringify(PROJECT_SHELL_COPY)).not.toMatch(COPY_BRANDING_PATTERN);
});

test("Overview Work Documents File Attachment and All Tools are in-page destinations", () => {
	const destinations = [
		projectShellAnchor("Overview"),
		projectShellAnchor("Work"),
		projectShellAnchor("Documents"),
		projectShellAnchor("File Attachment"),
		projectShellAnchor("All Tools"),
	];
	expect(destinations).toEqual([
		"overview",
		"work",
		"documents",
		"file-attachment",
		"all-tools",
	]);
	expect(new Set(destinations).size).toBe(destinations.length);
	expect(projectShellAnchor("Technical Diagrams")).toBe("technical-diagrams");
	expect(projectShellAnchor("GitHub")).toBe("github");
	expect(projectShellAnchor("Work")).not.toBe(
		projectShellAnchor("Technical Diagrams")
	);
	expect(
		pinnedNavigationAreas(
			["Discovery", "Decisions", "Design", "Tests", "Releases"],
			["Work", "Documents", "Decisions", "Design", "Tests", "Releases"]
		)
	).toEqual(["Decisions", "Design", "Tests", "Releases"]);
	expect(projectPersistentNav([], ["Work", "Documents"])).toEqual([
		"Work",
		"Documents",
		"File Attachment",
	]);
	expect(
		projectPersistentNav(
			["Discovery", "Decisions", "Design", "Tests", "Releases"],
			["Work", "Documents", "Decisions", "Design", "Tests", "Releases"]
		)
	).toEqual([
		"Work",
		"Documents",
		"File Attachment",
		"Decisions",
		"Design",
		"Tests",
		"Releases",
	]);
});

test("Configuration Mode is presentation search, not a Project write", () => {
	expect(projectShellSearch({})).toEqual({});
	expect(
		projectShellSearch({
			configurationEditor: CONFIGURATION_MODE_EDITORS.customField,
			configurationMode: "1",
		})
	).toEqual({
		configurationEditor: "custom-field",
		configurationMode: true,
	});
	expect(
		projectShellSearch({
			configurationEditor: CONFIGURATION_MODE_EDITORS.workContextCardLayout,
			configurationMode: true,
		})
	).toEqual({
		configurationEditor: "work-context-card-layout",
		configurationMode: true,
	});
	expect(
		projectShellSearch({
			configurationEditor: CONFIGURATION_MODE_EDITORS.customField,
		})
	).toEqual({});
	expect(projectShellSearch({ work: "work_1" })).toEqual({ work: "work_1" });
	expect(projectShellSearch({ decision: "decision_1" })).toEqual({
		decision: "decision_1",
	});
	expect(projectShellSearch({ assumption: "assumption_1" })).toEqual({
		assumption: "assumption_1",
	});
	expect(projectShellSearch({ goal: "goal_1" })).toEqual({ goal: "goal_1" });
});

test("Copy project structure preview lists structure without records", () => {
	expect(
		structureCopyPreviewItems({
			customFieldDefinitions: [],
			enabledAreas: ["Work", "Documents", "Tests"],
			priorityMetricDefinitions: [],
			selectedSkeletons: [
				{
					emptyHeadings: [
						"Primary Navigation",
						"Secondary Navigation",
						"Utility",
						"External",
					],
					name: "Sitemap",
				},
			],
			stages: [{ name: "Discovery", state: "Active" }],
			workContextCardLayouts: [],
			workStatuses: [{ label: "Todo" }],
			workViews: ["Backlog", "Board"],
		})
	).toEqual([
		{
			items: ["Discovery · Active"],
			label: "Stages",
		},
		{
			items: ["Work", "Documents", "Tests"],
			label: "Project areas",
		},
		{
			items: ["Todo"],
			label: "Work statuses",
		},
		{
			items: ["Backlog", "Board"],
			label: "Saved views",
		},
		{
			items: [],
			label: "Work Context Card layout",
		},
		{
			items: [],
			label: "Custom field",
		},
		{
			items: [],
			label: "Priority metrics",
		},
		{
			items: [
				"Primary Navigation",
				"Secondary Navigation",
				"Utility",
				"External",
			],
			label: "Sitemap",
		},
	]);
});

test("Work daily actions and Saved views stay on the Work surface", () => {
	const persistent = projectPersistentNav(
		["Discovery", "Decisions"],
		["Work", "Documents", "Decisions"]
	);
	expect(projectNavRecordAreas(persistent)).toEqual([
		"Work",
		"Documents",
		"File Attachment",
	]);
	expect(projectNavPinnedAreas(persistent)).toEqual(["Decisions"]);
	expect(isWorkShellAnchor("work", ["Backlog", "Board"])).toBe(true);
	expect(isWorkShellAnchor("create", ["Backlog", "Board"])).toBe(true);
	expect(isWorkShellAnchor("board", ["Backlog", "Board"])).toBe(true);
	expect(isWorkShellAnchor("documents", ["Backlog", "Board"])).toBe(false);
	expect(workSavedViewIsList("Backlog")).toBe(true);
	expect(workSavedViewIsList("Board")).toBe(false);
	expect(workSavedViewIsBoard("Board")).toBe(true);
	expect(workSavedViewIsBoard("Backlog")).toBe(false);
	expect(workSavedViewIsRoadmap("Roadmap")).toBe(true);
	expect(workSavedViewIsRoadmap("Board")).toBe(false);
	expect(projectShellShowsWorkSurface({ anchor: "work", workId: null })).toBe(
		true
	);
	expect(
		projectShellShowsWorkSurface({
			anchor: "",
			workId: "work_1",
		})
	).toBe(true);
	expect(
		projectShellShowsWorkSurface({
			anchor: "overview",
			workId: "work_1",
		})
	).toBe(false);
	expect(projectShellHashForWorkSelect("")).toBe("work");
	expect(projectShellHashForWorkSelect("#overview")).toBe("work");
	expect(projectShellHashForWorkSelect("#documents")).toBe("work");
	expect(projectShellHashForWorkSelect("#edit")).toBe("edit");
	expect(projectShellHashForWorkSelect("#backlog")).toBe("backlog");
	expect(PROJECT_SHELL_COPY.project).toBe("Project");
	expect(PROJECT_SHELL_COPY.openNavigation).toBe("Open Project navigation");
});

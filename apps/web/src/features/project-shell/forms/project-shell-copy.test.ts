import { expect, test } from "vitest";

import {
	CONFIGURATION_MODE_EDITORS,
	PROJECT_SHELL_COPY,
	pinnedNavigationAreas,
	projectShellAnchor,
	projectShellChrome,
	projectShellSearch,
	STARTER_CONFIGURATIONS,
	structureCopyPreviewItems,
} from "./project-shell-copy";

const COPY_BRANDING_PATTERN = /color|CSS|font/i;

test("English chrome uses Project Name and Short code", () => {
	expect(projectShellChrome()).toMatchObject({
		addStage: "Add stage",
		allTools: "All Tools",
		configurationMode: "Configuration Mode",
		copyProjectStructure: "Copy project structure",
		create: "Create",
		createProject: "Create Project",
		customField: "Custom field",
		dismiss: "Dismiss",
		edit: "Edit",
		enable: "Enable",
		hide: "Hide",
		notPlanned: "Not Planned",
		overview: "Overview",
		pinToNavigation: "Pin to navigation",
		planning: "Planning",
		priorityMetrics: "Priority metrics",
		projectName: "Project Name",
		ready: "Ready",
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
	});
	expect(STARTER_CONFIGURATIONS).toEqual([
		"Blank Project",
		"Solo SaaS",
		"Open Source Library",
		"Mobile Application",
	]);
	expect(JSON.stringify(PROJECT_SHELL_COPY)).not.toMatch(COPY_BRANDING_PATTERN);
});

test("Overview Work Documents and All Tools are in-page destinations", () => {
	const destinations = [
		projectShellAnchor("Overview"),
		projectShellAnchor("Work"),
		projectShellAnchor("Documents"),
		projectShellAnchor("All Tools"),
	];
	expect(destinations).toEqual(["overview", "work", "documents", "all-tools"]);
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

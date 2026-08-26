import { expect, test } from "vitest";

import {
	CONFIGURATION_MODE_EDITORS,
	PROJECT_SHELL_COPY,
	projectShellAnchor,
	projectShellChrome,
	projectShellSearch,
	STARTER_CONFIGURATIONS,
} from "./project-shell-copy";

const COPY_BRANDING_PATTERN = /color|CSS|font/i;

test("English chrome uses Project Name and Short code", () => {
	expect(projectShellChrome()).toMatchObject({
		addStage: "Add stage",
		allTools: "All Tools",
		configurationMode: "Configuration Mode",
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
		savedViews: "Saved views",
		shortCode: "Short code",
		shortCodeLocked: "Short code is locked after the first Work.",
		starterConfiguration: "Starter Configuration",
		status: "Status",
		workContextCardLayout: "Work Context Card layout",
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

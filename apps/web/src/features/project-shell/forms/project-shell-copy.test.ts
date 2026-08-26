import { expect, test } from "vitest";

import {
	PROJECT_SHELL_COPY,
	projectShellAnchor,
	projectShellChrome,
	STARTER_CONFIGURATIONS,
} from "./project-shell-copy";

const COPY_BRANDING_PATTERN = /color|CSS|font/i;

test("English chrome uses Project Name and Short code", () => {
	expect(projectShellChrome()).toMatchObject({
		allTools: "All Tools",
		createProject: "Create Project",
		dismiss: "Dismiss",
		overview: "Overview",
		projectName: "Project Name",
		shortCode: "Short code",
		shortCodeLocked: "Short code is locked after the first Work.",
		starterConfiguration: "Starter Configuration",
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

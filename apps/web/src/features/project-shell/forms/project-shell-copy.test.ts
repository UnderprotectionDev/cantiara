import { expect, test } from "vitest";

import {
	PROJECT_SHELL_COPY,
	projectShellChrome,
	STARTER_CONFIGURATIONS,
} from "./project-shell-copy";

const COPY_BRANDING_PATTERN = /color|CSS|font/i;

test("English chrome uses Project Name and Short code", () => {
	expect(projectShellChrome()).toMatchObject({
		createProject: "Create Project",
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

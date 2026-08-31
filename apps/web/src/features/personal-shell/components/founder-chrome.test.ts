import { expect, test } from "vitest";

import {
	FOUNDER_CHROME_COPY,
	FOUNDER_CHROME_PATHS,
	FOUNDER_MAIN_ID,
	founderChromeAccountOnly,
	founderChromeNav,
	founderChromeNavIsCurrent,
	projectOverviewHref,
} from "./founder-chrome";

test("founder chrome reaches Capture and Projects, not Home or Dashboard twins", () => {
	expect(FOUNDER_CHROME_COPY.product).toBe("Cantiara");
	expect(FOUNDER_CHROME_COPY.capture).toBe("Capture");
	expect(FOUNDER_CHROME_COPY.drafts).toBe("Drafts");
	expect(FOUNDER_CHROME_COPY.dailyFocus).toBe("Daily Focus");
	expect(FOUNDER_CHROME_COPY.projects).toBe("Projects");
	expect(FOUNDER_CHROME_PATHS.workspaceHome).toBe("/dashboard");
	expect(founderChromeNav()).toEqual([
		{ label: "Capture", to: "/capture" },
		{ label: "Drafts", to: "/drafts" },
		{ label: "Daily Focus", to: "/daily-focus" },
		{ label: "Projects", to: "/projects" },
		{ label: "Personal Wiki", to: "/wiki" },
	]);
	expect(founderChromeNav().map((link) => link.label)).not.toContain("Home");
	expect(founderChromeNav().map((link) => link.label)).not.toContain(
		"Dashboard"
	);
	expect(founderChromeNav().map((link) => link.label)).not.toContain(
		"Create Project"
	);
	expect(founderChromeNav().map((link) => link.to)).not.toContain("/");
	expect(founderChromeNav().map((link) => link.to)).not.toContain("/account");
	expect(founderChromeNav().map((link) => link.to)).not.toContain("/sessions");
});

test("Preferences, Completion effects, and Sessions stay on the Account menu", () => {
	expect(founderChromeAccountOnly()).toEqual([
		"Preferences",
		"Completion effects",
		"Sessions",
	]);
	expect(FOUNDER_CHROME_COPY.account).toBe("Account");
});

test("workspace chrome marks the current surface without treating a Project as Projects", () => {
	expect(FOUNDER_CHROME_COPY.skipToMain).toBe("Skip to main content");
	expect(FOUNDER_CHROME_COPY.menu).toBe("Menu");
	expect(FOUNDER_MAIN_ID).toBe("main-content");
	expect(founderChromeNavIsCurrent("/capture", "/capture")).toBe(true);
	expect(founderChromeNavIsCurrent("/projects", "/projects")).toBe(true);
	expect(founderChromeNavIsCurrent("/projects/new", "/projects")).toBe(true);
	expect(founderChromeNavIsCurrent("/projects/proj_1", "/projects")).toBe(
		false
	);
	expect(founderChromeNavIsCurrent("/wiki", "/capture")).toBe(false);
	expect(projectOverviewHref("proj_1")).toBe("/projects/proj_1#overview");
});

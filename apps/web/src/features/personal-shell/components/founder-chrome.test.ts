import { expect, test } from "vitest";

import {
	FOUNDER_CHROME_COPY,
	FOUNDER_CHROME_PATHS,
	founderChromeAccountOnly,
	founderChromeNav,
} from "./founder-chrome";

test("founder chrome reaches Capture and Projects, not Home or Dashboard twins", () => {
	expect(FOUNDER_CHROME_COPY.product).toBe("Cantiara");
	expect(FOUNDER_CHROME_COPY.capture).toBe("Capture");
	expect(FOUNDER_CHROME_COPY.projects).toBe("Projects");
	expect(FOUNDER_CHROME_PATHS.workspaceHome).toBe("/dashboard");
	expect(founderChromeNav()).toEqual([
		{ label: "Capture", to: "/capture" },
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

test("Preferences and Sessions stay on the Account menu", () => {
	expect(founderChromeAccountOnly()).toEqual(["Preferences", "Sessions"]);
	expect(FOUNDER_CHROME_COPY.account).toBe("Account");
});

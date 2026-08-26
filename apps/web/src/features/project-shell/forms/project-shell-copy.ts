export const STARTER_CONFIGURATIONS = [
	"Blank Project",
	"Solo SaaS",
	"Open Source Library",
	"Mobile Application",
] as const;

export type StarterConfiguration = (typeof STARTER_CONFIGURATIONS)[number];

export const PROJECT_SHELL_COPY = {
	active: "Active",
	allTools: "All Tools",
	createProject: "Create Project",
	dismiss: "Dismiss",
	loading: "Loading…",
	logo: "Logo",
	overview: "Overview",
	problem: "Problem",
	projectName: "Project Name",
	projects: "Projects",
	purpose: "Purpose",
	saveShortCode: "Save Short code",
	scope: "Scope",
	shortCode: "Short code",
	shortCodeLocked: "Short code is locked after the first Work.",
	starterConfiguration: "Starter Configuration",
	targetDate: "Target date",
	unavailable: "Project is unavailable.",
} as const;

export function projectShellChrome() {
	return PROJECT_SHELL_COPY;
}

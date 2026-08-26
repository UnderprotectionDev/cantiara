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
	configurationMode: "Configuration Mode",
	create: "Create",
	createProject: "Create Project",
	customField: "Custom field",
	dismiss: "Dismiss",
	edit: "Edit",
	loading: "Loading…",
	logo: "Logo",
	overview: "Overview",
	planning: "Planning",
	priorityMetrics: "Priority metrics",
	problem: "Problem",
	projectAreas: "Project areas",
	projectName: "Project Name",
	projects: "Projects",
	purpose: "Purpose",
	savedViews: "Saved views",
	saveShortCode: "Save Short code",
	scope: "Scope",
	shortCode: "Short code",
	shortCodeLocked: "Short code is locked after the first Work.",
	stages: "Stages",
	starterConfiguration: "Starter Configuration",
	status: "Status",
	targetDate: "Target date",
	unavailable: "Project is unavailable.",
	workContextCardLayout: "Work Context Card layout",
	workStatuses: "Work statuses",
} as const;

export const CONFIGURATION_MODE_EDITORS = {
	customField: "custom-field",
	workContextCardLayout: "work-context-card-layout",
} as const;

export type ConfigurationModeEditor =
	(typeof CONFIGURATION_MODE_EDITORS)[keyof typeof CONFIGURATION_MODE_EDITORS];

export interface ProjectShellSearch {
	configurationEditor?: ConfigurationModeEditor;
	configurationMode?: true;
}

export function projectShellChrome() {
	return PROJECT_SHELL_COPY;
}

export function projectShellSearch(
	search: Record<string, unknown>
): ProjectShellSearch {
	const configurationMode =
		search.configurationMode === true ||
		search.configurationMode === "true" ||
		search.configurationMode === 1 ||
		search.configurationMode === "1"
			? true
			: undefined;
	const configurationEditor =
		search.configurationEditor === CONFIGURATION_MODE_EDITORS.customField ||
		search.configurationEditor ===
			CONFIGURATION_MODE_EDITORS.workContextCardLayout
			? search.configurationEditor
			: undefined;
	return {
		configurationEditor: configurationMode ? configurationEditor : undefined,
		configurationMode,
	};
}

const ALWAYS_ON_ANCHORS = {
	"All Tools": "all-tools",
	Documents: "documents",
	Overview: "overview",
	Work: "work",
} as const;

export function projectShellAnchor(name: string): string {
	if (name in ALWAYS_ON_ANCHORS) {
		return ALWAYS_ON_ANCHORS[name as keyof typeof ALWAYS_ON_ANCHORS];
	}
	return name
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-+|-+$/g, "");
}

export const STARTER_CONFIGURATIONS = [
	"Blank Project",
	"Solo SaaS",
	"Open Source Library",
	"Mobile Application",
] as const;

export type StarterConfiguration = (typeof STARTER_CONFIGURATIONS)[number];

export const STAGE_STATES = [
	"Not Planned",
	"Ready",
	"Active",
	"Completed",
	"Abandoned",
] as const;

export type StageState = (typeof STAGE_STATES)[number];

export const PROJECT_SHELL_COPY = {
	active: "Active",
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
	loading: "Loading…",
	logo: "Logo",
	moveDown: "Move down",
	moveUp: "Move up",
	noProjects: "No Projects yet.",
	notPlanned: "Not Planned",
	overview: "Overview",
	pinToNavigation: "Pin to navigation",
	planning: "Planning",
	priorityMetrics: "Priority metrics",
	problem: "Problem",
	projectAreas: "Project areas",
	projectName: "Project Name",
	projects: "Projects",
	purpose: "Purpose",
	ready: "Ready",
	removeStage: "Remove stage",
	restoreDefaultNavigation: "Restore default navigation",
	save: "Save",
	savedViews: "Saved views",
	saveShortCode: "Save Short code",
	scope: "Scope",
	selectProject: "Select a Project",
	shortCode: "Short code",
	shortCodeLocked: "Short code is locked after the first Work.",
	stageNameRequired: "Stage name is required.",
	stageRemovalKeepsMainRecords: "Main records are not deleted.",
	stageRemovalLeavesPresentation: "will leave presentation and filters.",
	stages: "Stages",
	starterConfiguration: "Starter Configuration",
	status: "Status",
	targetDate: "Target date",
	unavailable: "Project is unavailable.",
	workContextCardLayout: "Work Context Card layout",
	workStatuses: "Work statuses",
	workStatusLabelRequired: "Work status label is required.",
} as const;

export function pinnedNavigationAreas(
	pinnedAreas: readonly string[],
	enabledAreas: readonly string[]
): string[] {
	return pinnedAreas.filter((area) => enabledAreas.includes(area));
}

const REACHABLE_AREAS = ["Work", "Documents", "File Attachment"] as const;

export function projectPersistentNav(
	pinnedAreas: readonly string[],
	enabledAreas: readonly string[]
): string[] {
	const reachable = REACHABLE_AREAS.filter(
		(area) => area === "File Attachment" || enabledAreas.includes(area)
	);
	const listed = new Set<string>(reachable);
	const pinned = pinnedNavigationAreas(pinnedAreas, enabledAreas).filter(
		(area) => !listed.has(area)
	);
	return [...reachable, ...pinned];
}

export function stageRemovalPreviewCopy(name: string): string {
	return `${name} ${PROJECT_SHELL_COPY.stageRemovalLeavesPresentation} ${PROJECT_SHELL_COPY.stageRemovalKeepsMainRecords}`;
}

export const CONFIGURATION_MODE_EDITORS = {
	customField: "custom-field",
	priorityMetrics: "priority-metrics",
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

export function structureCopyPreviewItems(preview: {
	customFieldDefinitions: readonly { name: string }[];
	enabledAreas: readonly string[];
	priorityMetricDefinitions: readonly { name: string }[];
	selectedSkeletons: readonly {
		emptyHeadings: readonly string[];
		name: string;
	}[];
	stages: readonly { name: string; state: string }[];
	workContextCardLayouts: readonly unknown[];
	workStatuses: readonly { label: string }[];
	workViews: readonly string[];
}) {
	return [
		{
			items: preview.stages.map((stage) => `${stage.name} · ${stage.state}`),
			label: PROJECT_SHELL_COPY.stages,
		},
		{
			items: [...preview.enabledAreas],
			label: PROJECT_SHELL_COPY.projectAreas,
		},
		{
			items: preview.workStatuses.map((status) => status.label),
			label: PROJECT_SHELL_COPY.workStatuses,
		},
		{
			items: [...preview.workViews],
			label: PROJECT_SHELL_COPY.savedViews,
		},
		{
			items: preview.workContextCardLayouts.map(() => ""),
			label: PROJECT_SHELL_COPY.workContextCardLayout,
		},
		{
			items: preview.customFieldDefinitions.map(
				(definition) => definition.name
			),
			label: PROJECT_SHELL_COPY.customField,
		},
		{
			items: preview.priorityMetricDefinitions.map(
				(definition) => definition.name
			),
			label: PROJECT_SHELL_COPY.priorityMetrics,
		},
		...preview.selectedSkeletons.map((skeleton) => ({
			items: [...skeleton.emptyHeadings],
			label: skeleton.name,
		})),
	];
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
		search.configurationEditor === CONFIGURATION_MODE_EDITORS.priorityMetrics ||
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
	"File Attachment": "file-attachment",
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

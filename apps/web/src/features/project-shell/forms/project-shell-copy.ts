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
	openNavigation: "Open Project navigation",
	overview: "Overview",
	pinToNavigation: "Pin to navigation",
	planning: "Planning",
	priorityMetrics: "Priority metrics",
	problem: "Problem",
	project: "Project",
	projectAreas: "Project areas",
	projectName: "Project Name",
	projects: "Projects",
	purpose: "Purpose",
	ready: "Ready",
	recordAction: "Record Action",
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
	workTemplate: "Work Template",
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
	recordAction: "record-action",
	workContextCardLayout: "work-context-card-layout",
	workTemplate: "work-template",
} as const;

export type ConfigurationModeEditor =
	(typeof CONFIGURATION_MODE_EDITORS)[keyof typeof CONFIGURATION_MODE_EDITORS];

export interface ProjectShellSearch {
	configurationEditor?: ConfigurationModeEditor;
	configurationMode?: true;
	goal?: string;
	work?: string;
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
		search.configurationEditor === CONFIGURATION_MODE_EDITORS.recordAction ||
		search.configurationEditor ===
			CONFIGURATION_MODE_EDITORS.workContextCardLayout ||
		search.configurationEditor === CONFIGURATION_MODE_EDITORS.workTemplate
			? search.configurationEditor
			: undefined;
	const work =
		typeof search.work === "string" && search.work.length > 0
			? search.work
			: undefined;
	const goal =
		typeof search.goal === "string" && search.goal.length > 0
			? search.goal
			: undefined;
	return {
		...(configurationMode ? { configurationMode: true as const } : {}),
		...(configurationMode && configurationEditor
			? { configurationEditor }
			: {}),
		...(goal ? { goal } : {}),
		...(work ? { work } : {}),
	};
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
	workContextCardLayouts: readonly { workType: string }[];
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
			items: preview.workContextCardLayouts.map((layout) => layout.workType),
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

export function projectShellChrome() {
	return PROJECT_SHELL_COPY;
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

export const WORK_DAILY_ACTIONS = [
	PROJECT_SHELL_COPY.create,
	PROJECT_SHELL_COPY.edit,
	PROJECT_SHELL_COPY.status,
	PROJECT_SHELL_COPY.planning,
] as const;

export function projectNavRecordAreas(persistent: readonly string[]): string[] {
	return persistent.filter((area) =>
		(REACHABLE_AREAS as readonly string[]).includes(area)
	);
}

export function projectNavPinnedAreas(persistent: readonly string[]): string[] {
	return persistent.filter(
		(area) => !(REACHABLE_AREAS as readonly string[]).includes(area)
	);
}

export function isWorkShellAnchor(
	anchor: string,
	workViews: readonly string[]
): boolean {
	if (anchor === ALWAYS_ON_ANCHORS.Work) {
		return true;
	}
	if (
		WORK_DAILY_ACTIONS.some((action) => projectShellAnchor(action) === anchor)
	) {
		return true;
	}
	return workViews.some((view) => projectShellAnchor(view) === anchor);
}

export function workSavedViewIsList(view: string): boolean {
	return view === "Backlog";
}

export function workSavedViewIsBoard(view: string): boolean {
	return view === "Board";
}

export function workSavedViewIsRoadmap(view: string): boolean {
	return view === "Roadmap";
}

const HASH_PREFIX = "#";

const WORK_SELECT_RESET_ANCHORS = new Set([
	"",
	ALWAYS_ON_ANCHORS.Overview,
	ALWAYS_ON_ANCHORS["All Tools"],
	ALWAYS_ON_ANCHORS.Documents,
	ALWAYS_ON_ANCHORS["File Attachment"],
]);

export function projectShellHashAnchor(hash: string): string {
	return hash.startsWith(HASH_PREFIX) ? hash.slice(HASH_PREFIX.length) : hash;
}

export function projectShellHashForWorkSelect(hash: string): string {
	const anchor = projectShellHashAnchor(hash);
	if (WORK_SELECT_RESET_ANCHORS.has(anchor)) {
		return ALWAYS_ON_ANCHORS.Work;
	}
	return anchor;
}

export function projectShellShowsWorkSurface(input: {
	anchor: string;
	workId?: string | null;
	workViews?: readonly string[];
}): boolean {
	if (input.anchor === ALWAYS_ON_ANCHORS.Overview) {
		return false;
	}
	if (input.anchor === "" && input.workId) {
		return true;
	}
	return isWorkShellAnchor(input.anchor, input.workViews ?? []);
}

import { z } from "zod";

export const STARTER_CONFIGURATIONS = [
	"Blank Project",
	"Solo SaaS",
	"Open Source Library",
	"Mobile Application",
] as const;

export type StarterConfiguration = (typeof STARTER_CONFIGURATIONS)[number];

export const SKELETON_NAMES = [
	"Sitemap",
	"Customer Journey",
	"Persona",
	"Retrospective",
	"Launch Plan",
] as const;

export type SkeletonName = (typeof SKELETON_NAMES)[number];

export const SKELETON_SURFACES = ["Document", "Project Wall"] as const;

export type SkeletonSurface = (typeof SKELETON_SURFACES)[number];

export const STARTER_SKELETONS = [
	{
		emptyHeadings: [
			"Primary Navigation",
			"Secondary Navigation",
			"Utility",
			"External",
		],
		name: "Sitemap",
		surface: "Project Wall",
	},
	{
		emptyHeadings: [
			"Awareness",
			"Consideration",
			"Onboarding",
			"Core Use",
			"Retention",
		],
		name: "Customer Journey",
		surface: "Project Wall",
	},
	{
		emptyHeadings: [
			"Context",
			"Goals",
			"Behaviors",
			"Pain Points",
			"Constraints",
			"Evidence",
			"Open Questions",
		],
		name: "Persona",
		surface: "Document",
	},
	{
		emptyHeadings: [
			"Period",
			"What worked?",
			"What did not?",
			"What did we learn?",
			"Decisions",
			"Next changes",
			"Related records",
		],
		name: "Retrospective",
		surface: "Document",
	},
	{
		emptyHeadings: [
			"Release",
			"Audience",
			"Scope",
			"Readiness",
			"Communication",
			"Launch steps",
			"Risks",
			"Observation plan",
			"Related records",
		],
		name: "Launch Plan",
		surface: "Document",
	},
] as const;

export interface SelectedSkeleton {
	emptyHeadings: string[];
	name: SkeletonName;
	surface: SkeletonSurface;
}

export const PROJECT_AREAS = [
	"Work",
	"Documents",
	"Discovery",
	"Decisions",
	"Design",
	"Technical Diagrams",
	"Tests",
	"Releases",
	"Production",
	"GitHub",
] as const;

export type ProjectAreaName = (typeof PROJECT_AREAS)[number];

export const ALWAYS_ON_SURFACES = [
	"Overview",
	"Work",
	"Documents",
	"All Tools",
] as const;

export const PROTECTED_WORK_STATUSES = [
	"Not Started",
	"In Progress",
	"Blocked",
	"Closed",
] as const;

export type ProtectedWorkStatus = (typeof PROTECTED_WORK_STATUSES)[number];

export const STAGE_STATES = [
	"Not Planned",
	"Ready",
	"Active",
	"Completed",
	"Abandoned",
] as const;

export type StageState = (typeof STAGE_STATES)[number];

export const STAGE_STATE = {
	abandoned: "Abandoned",
	active: "Active",
	completed: "Completed",
	notPlanned: "Not Planned",
	ready: "Ready",
} as const;

export const NON_AREA_SURFACES = ["Overview", "All Tools"] as const;

export const PROJECT_LIFECYCLE = {
	abandoned: "Abandoned",
	active: "Active",
	completed: "Completed",
	pending: "Pending",
} as const;

export const PROJECT_SHELL_COPY = {
	addStage: "Add stage",
	allTools: "All Tools",
	configurationMode: "Configuration Mode",
	create: "Create",
	createProject: "Create Project",
	customField: "Custom field",
	dismiss: "Dismiss",
	edit: "Edit",
	enable: "Enable",
	firstOpenExplanations: {
		"Blank Project":
			"Blank Project set up Work and Documents with Backlog and Board. It did not install stages or extra pinned areas. Other areas stay available in All Tools. Overview and All Tools stay reachable. This is not a workflow or publish gate.",
		"Mobile Application":
			"Mobile Application set up Discovery, Design, Build, Validate, Release, and Operate, enabled every Project area, pinned Discovery, Design, Tests, Releases, and Production, and prepared Backlog, Board, and Roadmap. Overview and All Tools stay reachable. Change areas from All Tools. This is not a workflow or publish gate.",
		"Open Source Library":
			"Open Source Library set up Scope, Build, Validate, Release, and Maintain, enabled Work, Documents, Decisions, Technical Diagrams, Tests, Releases, and GitHub, pinned GitHub, Tests, and Releases, and prepared Backlog, Board, and Roadmap. Overview and All Tools stay reachable. Other areas stay available in All Tools. This is not a workflow or publish gate.",
		"Solo SaaS":
			"Solo SaaS set up Discovery, Design, Build, Validate, Release, and Operate, enabled every Project area, pinned Discovery, Decisions, Design, Tests, and Releases, and prepared Backlog, Board, and Roadmap. Overview and All Tools stay reachable. Change areas from All Tools. This is not a workflow or publish gate.",
	},
	hide: "Hide",
	logo: "Logo",
	moveDown: "Move down",
	moveUp: "Move up",
	notPlanned: "Not Planned",
	overview: "Overview",
	pinToNavigation: "Pin to navigation",
	planning: "Planning",
	priorityMetrics: "Priority metrics",
	problem: "Problem",
	projectAreas: "Project areas",
	projectName: "Project Name",
	purpose: "Purpose",
	ready: "Ready",
	removeStage: "Remove stage",
	restoreDefaultNavigation: "Restore default navigation",
	save: "Save",
	savedViews: "Saved views",
	scope: "Scope",
	shortCode: "Short code",
	shortCodeLocked: "Short code is locked after the first Work.",
	stageRemovalKeepsMainRecords: "Main records are not deleted.",
	stageRemovalLeavesPresentation: "will leave presentation and filters.",
	stages: "Stages",
	starterConfiguration: "Starter Configuration",
	status: "Status",
	targetDate: "Target date",
	workContextCardLayout: "Work Context Card layout",
	workStatuses: "Work statuses",
} as const;

export const SHORT_CODE_MIN = 2;
export const SHORT_CODE_MAX = 6;
const SHORT_CODE_FALLBACK = "PRJ";
const SHORT_CODE_PATTERN = /^[A-Z0-9]{2,6}$/;
const TARGET_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const projectAreaViewSchema = z.object({
	enabled: z.boolean(),
	name: z.enum(PROJECT_AREAS),
	pinned: z.boolean(),
});

export const projectStageViewSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	state: z.enum(STAGE_STATES),
});

export const projectViewSchema = z.object({
	allToolsAreas: z.array(projectAreaViewSchema),
	alwaysOnSurfaces: z.tuple([
		z.literal("Overview"),
		z.literal("Work"),
		z.literal("Documents"),
		z.literal("All Tools"),
	]),
	enabledAreas: z.array(z.enum(PROJECT_AREAS)),
	firstOpenExplanation: z.string().min(1).nullable(),
	firstOpenExplanationVisible: z.boolean(),
	id: z.string().min(1),
	lifecycleStatus: z.literal(PROJECT_LIFECYCLE.active),
	logoFileName: z.string().min(1).nullable(),
	name: z.string().min(1),
	pinnedAreas: z.array(z.enum(PROJECT_AREAS)),
	problem: z.string().min(1).nullable(),
	purpose: z.string().min(1).nullable(),
	revision: z.number().int().positive(),
	scope: z.string().min(1).nullable(),
	selectedSkeletons: z.array(
		z.object({
			emptyHeadings: z.array(z.string().min(1)),
			name: z.enum(SKELETON_NAMES),
			surface: z.enum(SKELETON_SURFACES),
		})
	),
	shortCode: z.string().min(SHORT_CODE_MIN).max(SHORT_CODE_MAX),
	shortCodeLocked: z.boolean(),
	stages: z.array(projectStageViewSchema),
	starterConfiguration: z.enum(STARTER_CONFIGURATIONS),
	targetDate: z.string().nullable(),
	workContextCardLayouts: z.array(z.never()),
	workStatuses: z.tuple([
		z.object({
			label: z.string().min(1),
			semantic: z.literal("Not Started"),
		}),
		z.object({
			label: z.string().min(1),
			semantic: z.literal("In Progress"),
		}),
		z.object({
			label: z.string().min(1),
			semantic: z.literal("Blocked"),
		}),
		z.object({
			label: z.string().min(1),
			semantic: z.literal("Closed"),
		}),
	]),
	workspaceId: z.string().min(1),
	workViews: z.array(z.string().min(1)),
});

export type ProjectView = z.infer<typeof projectViewSchema>;

export const createProjectPayloadSchema = z.object({
	logoFileName: z.string().nullable().optional(),
	name: z.string().optional(),
	problem: z.string().optional(),
	purpose: z.string().optional(),
	scope: z.string().optional(),
	shortCode: z.string().optional(),
	starterConfiguration: z.string().optional(),
	targetDate: z.string().nullable().optional(),
});

export type CreateProjectPayload = z.infer<typeof createProjectPayloadSchema>;

export const createProjectCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createProjectPayloadSchema,
	workspaceId: z.string().min(1),
});

export type CreateProjectCommand = z.infer<typeof createProjectCommandSchema>;

export const updateShortCodeCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	projectId: z.string().min(1),
	shortCode: z.string().min(1),
});

export type UpdateShortCodeCommand = z.infer<
	typeof updateShortCodeCommandSchema
>;

export const dismissFirstOpenExplanationCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	projectId: z.string().min(1),
});

export type DismissFirstOpenExplanationCommand = z.infer<
	typeof dismissFirstOpenExplanationCommandSchema
>;

export const structureChangeSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("add-stage"),
		name: z.string(),
	}),
	z.object({
		action: z.literal("rename-stage"),
		name: z.string(),
		stageId: z.string().min(1),
	}),
	z.object({
		action: z.literal("set-stage-state"),
		stageId: z.string().min(1),
		state: z.string(),
	}),
	z.object({
		action: z.literal("reorder-stages"),
		stageIds: z.array(z.string().min(1)),
	}),
	z.object({
		action: z.literal("remove-stage"),
		stageId: z.string().min(1),
	}),
	z.object({
		action: z.literal("set-area-enabled"),
		area: z.string(),
		enabled: z.boolean(),
	}),
	z.object({
		action: z.literal("pin-to-navigation"),
		area: z.string(),
	}),
	z.object({
		action: z.literal("unpin-from-navigation"),
		area: z.string(),
	}),
	z.object({
		action: z.literal("restore-default-navigation"),
	}),
	z.object({
		action: z.literal("rename-work-status"),
		label: z.string(),
		semantic: z.string(),
	}),
]);

export type StructureChange = z.infer<typeof structureChangeSchema>;

export const configureProjectCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	change: structureChangeSchema,
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	projectId: z.string().min(1),
});

export type ConfigureProjectCommand = z.infer<
	typeof configureProjectCommandSchema
>;

export type ProjectShellRejectionReason =
	| "missing-idempotency-key"
	| "missing-project-name"
	| "missing-starter-configuration"
	| "not-a-project-area"
	| "short-code-invalid"
	| "short-code-locked"
	| "short-code-taken"
	| "stage-name-invalid"
	| "stage-not-found"
	| "stage-order-invalid"
	| "target-not-found"
	| "unknown-project-area"
	| "unknown-stage-state"
	| "unknown-starter-configuration"
	| "unknown-structure-action"
	| "unknown-work-status"
	| "work-status-label-invalid";

export type ProjectShellOutcome =
	| { project: ProjectView; status: "committed" }
	| { project: ProjectView; status: "replayed" }
	| { conflict: "Conflict"; status: "conflict" }
	| {
			current: ProjectView;
			currentValueLabel: "Current value";
			status: "stale";
	  }
	| {
			reason: ProjectShellRejectionReason;
			status: "rejected";
	  };

export function isStarterConfiguration(
	value: string
): value is StarterConfiguration {
	return (STARTER_CONFIGURATIONS as readonly string[]).includes(value);
}

export function isProjectAreaName(value: string): value is ProjectAreaName {
	return (PROJECT_AREAS as readonly string[]).includes(value);
}

export function isSkeletonName(value: string): value is SkeletonName {
	return (SKELETON_NAMES as readonly string[]).includes(value);
}

export function isSkeletonSurface(value: string): value is SkeletonSurface {
	return (SKELETON_SURFACES as readonly string[]).includes(value);
}

export function isStageState(value: string): value is StageState {
	return (STAGE_STATES as readonly string[]).includes(value);
}

export function isProtectedWorkStatus(
	value: string
): value is ProtectedWorkStatus {
	return (PROTECTED_WORK_STATUSES as readonly string[]).includes(value);
}

export function isNonAreaSurface(value: string): boolean {
	return (NON_AREA_SURFACES as readonly string[]).includes(value);
}

export function protectedWorkStatusViews() {
	return PROTECTED_WORK_STATUSES.map((semantic) => ({
		label: semantic,
		semantic,
	}));
}

export function stageRemovalPreview(name: string) {
	return {
		filters: [name],
		mainRecordsDeleted: false,
		presentation: [name],
		workStatusWritten: false,
	};
}

export function stageRemovalPreviewCopy(name: string): string {
	return `${name} ${PROJECT_SHELL_COPY.stageRemovalLeavesPresentation} ${PROJECT_SHELL_COPY.stageRemovalKeepsMainRecords}`;
}

const STARTER_STRUCTURE: Record<
	StarterConfiguration,
	{
		enabledAreas: readonly ProjectAreaName[];
		pinnedAreas: readonly ProjectAreaName[];
		stages: readonly string[];
		workViews: readonly string[];
	}
> = {
	"Blank Project": {
		enabledAreas: ["Work", "Documents"],
		pinnedAreas: [],
		stages: [],
		workViews: ["Backlog", "Board"],
	},
	"Mobile Application": {
		enabledAreas: PROJECT_AREAS,
		pinnedAreas: ["Discovery", "Design", "Tests", "Releases", "Production"],
		stages: ["Discovery", "Design", "Build", "Validate", "Release", "Operate"],
		workViews: ["Backlog", "Board", "Roadmap"],
	},
	"Open Source Library": {
		enabledAreas: [
			"Work",
			"Documents",
			"Decisions",
			"Technical Diagrams",
			"Tests",
			"Releases",
			"GitHub",
		],
		pinnedAreas: ["GitHub", "Tests", "Releases"],
		stages: ["Scope", "Build", "Validate", "Release", "Maintain"],
		workViews: ["Backlog", "Board", "Roadmap"],
	},
	"Solo SaaS": {
		enabledAreas: PROJECT_AREAS,
		pinnedAreas: ["Discovery", "Decisions", "Design", "Tests", "Releases"],
		stages: ["Discovery", "Design", "Build", "Validate", "Release", "Operate"],
		workViews: ["Backlog", "Board", "Roadmap"],
	},
};

export function appliedStructureFor(
	starterConfiguration: StarterConfiguration
) {
	return STARTER_STRUCTURE[starterConfiguration];
}

export function selectedSkeletonsFor(
	starterConfiguration: StarterConfiguration
): SelectedSkeleton[] {
	if (starterConfiguration === "Blank Project") {
		return [];
	}
	return STARTER_SKELETONS.map((skeleton) => ({
		emptyHeadings: [...skeleton.emptyHeadings],
		name: skeleton.name,
		surface: skeleton.surface,
	}));
}

export function firstOpenExplanationFor(
	starterConfiguration: StarterConfiguration
): string {
	return PROJECT_SHELL_COPY.firstOpenExplanations[starterConfiguration];
}

export const CONFIGURATION_MODE_EDITORS = {
	customField: "custom-field",
	workContextCardLayout: "work-context-card-layout",
} as const;

export type ConfigurationModeEditor =
	(typeof CONFIGURATION_MODE_EDITORS)[keyof typeof CONFIGURATION_MODE_EDITORS];

const CONFIGURATION_MODE_HOSTS = [
	PROJECT_SHELL_COPY.stages,
	PROJECT_SHELL_COPY.workStatuses,
	PROJECT_SHELL_COPY.projectAreas,
	PROJECT_SHELL_COPY.customField,
	PROJECT_SHELL_COPY.priorityMetrics,
	PROJECT_SHELL_COPY.savedViews,
	PROJECT_SHELL_COPY.workContextCardLayout,
] as const;

const DAILY_ACTIONS = [
	PROJECT_SHELL_COPY.create,
	PROJECT_SHELL_COPY.edit,
	PROJECT_SHELL_COPY.status,
	PROJECT_SHELL_COPY.planning,
] as const;

export function configurationModeView(input: {
	editor?: ConfigurationModeEditor | null;
	open: boolean;
	savedViews: readonly string[];
}) {
	const editor = input.open ? (input.editor ?? null) : null;
	return {
		active: input.open,
		customFieldEditorOpen: editor === CONFIGURATION_MODE_EDITORS.customField,
		dailyActions: DAILY_ACTIONS,
		hosts: input.open ? CONFIGURATION_MODE_HOSTS : [],
		label: PROJECT_SHELL_COPY.configurationMode,
		savedViews: input.savedViews,
		workContextCardLayoutEditorOpen:
			editor === CONFIGURATION_MODE_EDITORS.workContextCardLayout,
	} as const;
}

export function suggestShortCodeFromName(name: string): string {
	const letters = name.toUpperCase().replace(/[^A-Z0-9]+/g, "");
	if (letters.length >= 3) {
		return letters.slice(0, 3);
	}
	if (letters.length >= SHORT_CODE_MIN) {
		return letters;
	}
	return SHORT_CODE_FALLBACK;
}

export function suggestAvailableShortCode(
	name: string,
	reserved: ReadonlySet<string>
): string {
	const base = suggestShortCodeFromName(name);
	if (!reserved.has(base)) {
		return base;
	}
	for (let n = 2; n < 1000; n += 1) {
		const suffix = String(n);
		const truncated = base.slice(0, SHORT_CODE_MAX - suffix.length);
		const candidate = `${truncated}${suffix}`;
		if (!reserved.has(candidate)) {
			return candidate;
		}
	}
	return SHORT_CODE_FALLBACK;
}

export function normalizeShortCode(value: string): string | null {
	const normalized = value.trim().toUpperCase();
	if (!SHORT_CODE_PATTERN.test(normalized)) {
		return null;
	}
	return normalized;
}

export function optionalText(value: string | null | undefined): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

export function optionalDate(value: string | null | undefined): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return null;
	}
	if (!TARGET_DATE_PATTERN.test(trimmed)) {
		return null;
	}
	return trimmed;
}

export const WORK_TYPES = [
	"Feature",
	"Bug",
	"Task",
	"Research",
	"Improvement",
] as const;

export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_STATUSES = [
	"Not Started",
	"In Progress",
	"Blocked",
	"Closed",
] as const;

export type WorkStatus = (typeof WORK_STATUSES)[number];

export const NON_TERMINAL_WORK_STATUSES = [
	"Not Started",
	"In Progress",
	"Blocked",
] as const;

export type NonTerminalWorkStatus = (typeof NON_TERMINAL_WORK_STATUSES)[number];

export const CLOSURE_RESULTS = ["Completed", "Abandoned"] as const;

export type ClosureResult = (typeof CLOSURE_RESULTS)[number];

export const WORK_LIFECYCLE_COPY = {
	abandoned: "Abandoned",
	archive: "Archive",
	archived: "Archived",
	atRisk: "At Risk",
	changeType: "Change type",
	close: "Close",
	closeAnyway: "Close anyway",
	closed: "Closed",
	closureCheck: "Closure check",
	completed: "Completed",
	confirmReopen: "Confirm reopen",
	confirmTypeChange: "Confirm type change",
	createWork: "Create Work",
	description: "Description",
	detach: "Detach",
	detachBeforeLeavingFeature:
		"Detach included Work, Feature health history, and Primary spec before leaving Feature.",
	featureHealth: "Feature health",
	fieldConflicts: "Field conflicts",
	impactPreview: "Impact preview",
	includedIn: "Included in",
	includedWork: "Included Work",
	includes: "Includes",
	keepLastingContext: "Keep lasting context",
	key: "Key",
	lightChecklist: "Checklist",
	mergeAsDuplicate: "Merge as duplicate",
	mergePreview: "Merge Preview",
	notStarted: "Not Started",
	noWork: "No Work yet.",
	offTrack: "Off Track",
	onTrack: "On Track",
	openSourceRecord: "Open source record",
	origin: "Origin",
	primarySpec: "Primary spec",
	reappearDate: "Reappear date",
	reason: "Reason",
	recordHealth: "Record Feature health",
	recreateInAnotherProject: "Recreate in another Project",
	related: "Related",
	relationsToRewrite: "Relations",
	reopen: "Reopen",
	returnToWork: "Return to work",
	save: "Save",
	scopeTree: "Scope Tree",
	status: "Status",
	survivingRecord: "Surviving record",
	targetDate: "Target date",
	title: "Title",
	type: "Type",
	unarchive: "Unarchive",
	work: "Work",
} as const;

export const FEATURE_HEALTH_STATUSES = [
	"On Track",
	"At Risk",
	"Off Track",
] as const;

export type FeatureHealthStatus = (typeof FEATURE_HEALTH_STATUSES)[number];

export function involvesFeature(fromType: string, toType: string): boolean {
	return (
		fromType !== toType && (fromType === "Feature" || toType === "Feature")
	);
}

export function isNonTerminalWorkStatus(
	value: string
): value is NonTerminalWorkStatus {
	return (NON_TERMINAL_WORK_STATUSES as readonly string[]).includes(value);
}

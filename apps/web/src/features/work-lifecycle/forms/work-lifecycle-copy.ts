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
	detachBeforeLeavingFeature:
		"Detach included Work, Feature health history, and Primary spec before leaving Feature.",
	featureHealth: "Feature health",
	impactPreview: "Impact preview",
	includedWork: "Included Work",
	keepLastingContext: "Keep lasting context",
	key: "Key",
	lightChecklist: "Checklist",
	notStarted: "Not Started",
	noWork: "No Work yet.",
	openSourceRecord: "Open source record",
	primarySpec: "Primary spec",
	reason: "Reason",
	recreateInAnotherProject: "Recreate in another Project",
	reopen: "Reopen",
	returnToWork: "Return to work",
	status: "Status",
	title: "Title",
	type: "Type",
	unarchive: "Unarchive",
	work: "Work",
} as const;

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

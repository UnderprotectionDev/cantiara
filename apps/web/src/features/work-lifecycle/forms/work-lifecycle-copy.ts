export const WORK_TYPES = [
	"Feature",
	"Bug",
	"Task",
	"Research",
	"Improvement",
] as const;

export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_LIFECYCLE_COPY = {
	changeType: "Change type",
	close: "Close",
	confirmTypeChange: "Confirm type change",
	createWork: "Create Work",
	detachBeforeLeavingFeature:
		"Detach included Work, Feature health history, and Primary spec before leaving Feature.",
	featureHealth: "Feature health",
	impactPreview: "Impact preview",
	includedWork: "Included Work",
	key: "Key",
	notStarted: "Not Started",
	noWork: "No Work yet.",
	primarySpec: "Primary spec",
	status: "Status",
	title: "Title",
	type: "Type",
	work: "Work",
} as const;

export function involvesFeature(fromType: string, toType: string): boolean {
	return (
		fromType !== toType && (fromType === "Feature" || toType === "Feature")
	);
}

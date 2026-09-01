export const ROADMAP_COPY = {
	allWorkTypes: "All Work types",
	applyNotNow: "Apply Not now",
	grounds: "Grounds",
	group: "Group",
	horizon: "Horizon",
	keepReviewLater: "Keep Review later",
	later: "Later",
	next: "Next",
	notNow: "Not now",
	now: "Now",
	openSourceRecord: "Open source record",
	place: "Place on horizon",
	preview: "Preview",
	primary: "Primary",
	problemOpportunity: "Problem/Opportunity",
	productDirection: "Product direction",
	reason: "Reason",
	reconsidering: "Reconsidering",
	reevaluationCondition: "Re-evaluation condition",
	removeReviewLater: "Remove Review later",
	reviewLater: "Review later",
	roadmap: "Roadmap",
	saveNamedView: "Save named view",
	secondary: "Secondary",
	type: "Type",
	unplaced: "No horizon",
} as const;

export const ROADMAP_HORIZONS = [
	ROADMAP_COPY.now,
	ROADMAP_COPY.next,
	ROADMAP_COPY.later,
] as const;

export type RoadmapHorizon = (typeof ROADMAP_HORIZONS)[number];

export const NOT_NOW_GROUND_KINDS = [
	"Decision",
	"Risk",
	"Feedback",
	"Source",
	"Document",
] as const;

export function isRoadmapHorizon(value: string): value is RoadmapHorizon {
	return (ROADMAP_HORIZONS as readonly string[]).includes(value);
}

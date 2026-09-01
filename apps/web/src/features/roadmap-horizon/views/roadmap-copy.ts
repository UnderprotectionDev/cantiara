export const ROADMAP_COPY = {
	allHorizons: "All",
	allWorkTypes: "All Work types",
	group: "Group",
	horizon: "Horizon",
	later: "Later",
	next: "Next",
	now: "Now",
	openSourceRecord: "Open source record",
	place: "Place on horizon",
	primary: "Primary",
	problemOpportunity: "Problem/Opportunity",
	productDirection: "Product direction",
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

export function isRoadmapHorizon(value: string): value is RoadmapHorizon {
	return (ROADMAP_HORIZONS as readonly string[]).includes(value);
}

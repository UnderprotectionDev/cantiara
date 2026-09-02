export const ROADMAP_COPY = {
	abandon: "Abandon",
	abandoned: "Abandoned",
	allWorkTypes: "All Work types",
	confirm: "Confirm",
	contributesToMilestone: "Contributes to Milestone",
	createMilestone: "Create Milestone",
	description: "Description",
	emptyMilestone: "No Milestone yet.",
	exitPresentationMode: "Exit Presentation Mode",
	group: "Group",
	horizon: "Horizon",
	later: "Later",
	milestone: "Milestone",
	milestones: "Milestones",
	next: "Next",
	now: "Now",
	openSourceRecord: "Open source record",
	place: "Place on horizon",
	placeOnPlan: "Place on plan",
	planned: "Planned",
	plannedStart: "Planned start",
	presentationMode: "Presentation Mode",
	preview: "Preview",
	primary: "Primary",
	problemOpportunity: "Problem/Opportunity",
	productDirection: "Product direction",
	reach: "Reach",
	reached: "Reached",
	roadmap: "Roadmap",
	saveNamedView: "Save named view",
	secondary: "Secondary",
	targetDate: "Target date",
	title: "Title",
	type: "Type",
	unplaced: "No horizon",
	unplannedCandidates: "Unplanned candidates",
} as const;

export const ROADMAP_HORIZONS = [
	ROADMAP_COPY.now,
	ROADMAP_COPY.next,
	ROADMAP_COPY.later,
] as const;

export type RoadmapHorizon = (typeof ROADMAP_HORIZONS)[number];

export const MILESTONE_STATUSES = [
	ROADMAP_COPY.planned,
	ROADMAP_COPY.reached,
	ROADMAP_COPY.abandoned,
] as const;

export function isRoadmapHorizon(value: string): value is RoadmapHorizon {
	return (ROADMAP_HORIZONS as readonly string[]).includes(value);
}

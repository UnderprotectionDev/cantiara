export const PROJECT_WALL_COPY = {
	align: "Align",
	collapseGroup: "Collapse",
	compact: "Compact",
	createPersistentRelation: "Create Persistent Relation",
	createProjectWall: "Create Project Wall",
	customerJourney: "Customer Journey",
	detailed: "Detailed",
	exact: "Exact",
	exitPresentationMode: "Exit Presentation Mode",
	expandGroup: "Expand",
	fitView: "Fit View",
	focusOrder: "Focus order",
	frozenCopy: "Frozen copy",
	group: "Group",
	inspect: "Inspect",
	live: "Live",
	lockPosition: "Lock Position",
	moveDown: "Move down",
	moveUp: "Move up",
	name: "Name",
	noProjectWall: "No Project Wall yet.",
	noShareGrant: "This output does not grant share access.",
	openAllInSource: "Open all in source",
	openSourceRecord: "Open Source Record",
	outline: "Outline",
	pan: "Pan",
	pdf: "PDF",
	placeLiveCard: "Place live card",
	png: "PNG",
	presentationMode: "Presentation Mode",
	preview: "Preview",
	projectWall: "Project Wall",
	select: "Select",
	sharedSource: "Shared source",
	sitemap: "Sitemap",
	visualLink: "Visual link",
	zoom: "Zoom",
} as const;

export const PROJECT_WALL_DENSITIES = [
	PROJECT_WALL_COPY.compact,
	PROJECT_WALL_COPY.preview,
	PROJECT_WALL_COPY.detailed,
] as const;

export type ProjectWallDensity = (typeof PROJECT_WALL_DENSITIES)[number];

export const PROJECT_WALL_SOURCE_KIND = {
	smartCollection: "Smart Collection",
	technicalDiagram: "Technical Diagram",
	work: "Work",
} as const;

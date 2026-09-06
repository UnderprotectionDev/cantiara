export const PROJECT_WALL_COPY = {
	compact: "Compact",
	createProjectWall: "Create Project Wall",
	detailed: "Detailed",
	exact: "Exact",
	exitPresentationMode: "Exit Presentation Mode",
	focusOrder: "Focus order",
	frozenCopy: "Frozen copy",
	live: "Live",
	name: "Name",
	noProjectWall: "No Project Wall yet.",
	noShareGrant: "This output does not grant share access.",
	openAllInSource: "Open all in source",
	openSourceRecord: "Open Source Record",
	pdf: "PDF",
	placeLiveCard: "Place live card",
	png: "PNG",
	presentationMode: "Presentation Mode",
	preview: "Preview",
	projectWall: "Project Wall",
	sharedSource: "Shared source",
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

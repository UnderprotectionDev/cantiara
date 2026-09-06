export const PROJECT_WALL_COPY = {
	compact: "Compact",
	createProjectWall: "Create Project Wall",
	detailed: "Detailed",
	name: "Name",
	noProjectWall: "No Project Wall yet.",
	openSourceRecord: "Open Source Record",
	placeLiveCard: "Place live card",
	preview: "Preview",
	projectWall: "Project Wall",
} as const;

export const PROJECT_WALL_DENSITIES = [
	PROJECT_WALL_COPY.compact,
	PROJECT_WALL_COPY.preview,
	PROJECT_WALL_COPY.detailed,
] as const;

export type ProjectWallDensity = (typeof PROJECT_WALL_DENSITIES)[number];

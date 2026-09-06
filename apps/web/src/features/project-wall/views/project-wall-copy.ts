export const PROJECT_WALL_COPY = {
	compact: "Compact",
	createPersistentRelation: "Create Persistent Relation",
	createProjectWall: "Create Project Wall",
	detailed: "Detailed",
	lockPosition: "Lock Position",
	name: "Name",
	noProjectWall: "No Project Wall yet.",
	openSourceRecord: "Open Source Record",
	placeLiveCard: "Place live card",
	preview: "Preview",
	projectWall: "Project Wall",
	visualLink: "Visual link",
} as const;

export const PROJECT_WALL_DENSITIES = [
	PROJECT_WALL_COPY.compact,
	PROJECT_WALL_COPY.preview,
	PROJECT_WALL_COPY.detailed,
] as const;

export type ProjectWallDensity = (typeof PROJECT_WALL_DENSITIES)[number];

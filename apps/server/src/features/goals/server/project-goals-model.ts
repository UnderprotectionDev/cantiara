import { z } from "zod";

export const PROJECT_GOAL_COPY = {
	create: "Create Project Goal",
	description: "Description",
	descriptionRequired: "Description is required.",
	empty: "No Project Goal yet.",
	intendedOutcome: "Intended outcome",
	loading: "Loading…",
	observedOutcome: "Observed outcome / learning",
	projectGoal: "Project Goal",
	save: "Save",
	title: "Title",
	titleRequired: "Title is required.",
} as const;

export const PROJECT_GOAL_COUNTERPARTS = {
	keyResult: false,
	milestone: false,
	projectRelease: false,
} as const;

export const PROJECT_GOAL_MEASUREMENT = {
	autoActuals: false,
	autoRollup: false,
	health: false,
	openClosedLife: false,
	progressPercent: false,
	projectArea: false,
} as const;

const projectGoalCopySchema = z.object({
	create: z.literal(PROJECT_GOAL_COPY.create),
	description: z.literal(PROJECT_GOAL_COPY.description),
	descriptionRequired: z.literal(PROJECT_GOAL_COPY.descriptionRequired),
	empty: z.literal(PROJECT_GOAL_COPY.empty),
	intendedOutcome: z.literal(PROJECT_GOAL_COPY.intendedOutcome),
	loading: z.literal(PROJECT_GOAL_COPY.loading),
	observedOutcome: z.literal(PROJECT_GOAL_COPY.observedOutcome),
	projectGoal: z.literal(PROJECT_GOAL_COPY.projectGoal),
	save: z.literal(PROJECT_GOAL_COPY.save),
	title: z.literal(PROJECT_GOAL_COPY.title),
	titleRequired: z.literal(PROJECT_GOAL_COPY.titleRequired),
});

export const projectGoalViewSchema = z.object({
	copy: projectGoalCopySchema,
	counterparts: z.object({
		keyResult: z.literal(false),
		milestone: z.literal(false),
		projectRelease: z.literal(false),
	}),
	description: z.string(),
	id: z.string(),
	intendedOutcome: z.string().nullable(),
	measurement: z.object({
		autoActuals: z.literal(false),
		autoRollup: z.literal(false),
		health: z.literal(false),
		openClosedLife: z.literal(false),
		progressPercent: z.literal(false),
		projectArea: z.literal(false),
	}),
	observedOutcome: z.string().nullable(),
	projectId: z.string(),
	revision: z.number(),
	title: z.string(),
});

export type ProjectGoalView = z.infer<typeof projectGoalViewSchema>;

export function projectGoalCatalog() {
	return {
		copy: PROJECT_GOAL_COPY,
		counterparts: PROJECT_GOAL_COUNTERPARTS,
		kind: "project-goal" as const,
		measurement: PROJECT_GOAL_MEASUREMENT,
		optional: true as const,
	};
}

export function optionalOutcome(value: string | undefined): string | null {
	const trimmed = value?.trim() ?? "";
	return trimmed.length === 0 ? null : trimmed;
}

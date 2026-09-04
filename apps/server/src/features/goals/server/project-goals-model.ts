import { z } from "zod";

export const PROJECT_GOAL_COPY = {
	contributesToGoal: "Contributes to Goal",
	create: "Create Project Goal",
	description: "Description",
	descriptionRequired: "Description is required.",
	empty: "No Project Goal yet.",
	inGoal: "In Goal",
	intendedOutcome: "Intended outcome",
	loading: "Loading…",
	noContributions: "No Contributes to Goal yet.",
	observedOutcome: "Observed outcome / learning",
	openQuestion: "Open Question",
	openSourceRecord: "Open source record",
	projectGoal: "Project Goal",
	remove: "Remove",
	risk: "Risk",
	save: "Save",
	title: "Title",
	titleRequired: "Title is required.",
	unavailable: "Project Goal is unavailable.",
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
	contributesToGoal: z.literal(PROJECT_GOAL_COPY.contributesToGoal),
	create: z.literal(PROJECT_GOAL_COPY.create),
	description: z.literal(PROJECT_GOAL_COPY.description),
	descriptionRequired: z.literal(PROJECT_GOAL_COPY.descriptionRequired),
	empty: z.literal(PROJECT_GOAL_COPY.empty),
	inGoal: z.literal(PROJECT_GOAL_COPY.inGoal),
	intendedOutcome: z.literal(PROJECT_GOAL_COPY.intendedOutcome),
	loading: z.literal(PROJECT_GOAL_COPY.loading),
	noContributions: z.literal(PROJECT_GOAL_COPY.noContributions),
	observedOutcome: z.literal(PROJECT_GOAL_COPY.observedOutcome),
	openQuestion: z.literal(PROJECT_GOAL_COPY.openQuestion),
	openSourceRecord: z.literal(PROJECT_GOAL_COPY.openSourceRecord),
	projectGoal: z.literal(PROJECT_GOAL_COPY.projectGoal),
	remove: z.literal(PROJECT_GOAL_COPY.remove),
	risk: z.literal(PROJECT_GOAL_COPY.risk),
	save: z.literal(PROJECT_GOAL_COPY.save),
	title: z.literal(PROJECT_GOAL_COPY.title),
	titleRequired: z.literal(PROJECT_GOAL_COPY.titleRequired),
	unavailable: z.literal(PROJECT_GOAL_COPY.unavailable),
});

export const projectGoalViewSchema = z.object({
	copy: projectGoalCopySchema,
	description: z.string(),
	id: z.string(),
	intendedOutcome: z.string().nullable(),
	observedOutcome: z.string().nullable(),
	projectId: z.string(),
	revision: z.number(),
	title: z.string(),
});

export type ProjectGoalView = z.infer<typeof projectGoalViewSchema>;

export const STATUS_MIX_WORK_TYPES = ["Research", "Feature"] as const;

export type StatusMixWorkType = (typeof STATUS_MIX_WORK_TYPES)[number];

export const goalContributionFromSchema = z.object({
	id: z.string(),
	kind: z.string(),
	reason: z.string().optional(),
	status: z.enum(["resolved", "broken"]),
	title: z.string().optional(),
});

export const goalContributionSchema = z.object({
	from: goalContributionFromSchema,
	id: z.string(),
	type: z.literal(PROJECT_GOAL_COPY.contributesToGoal),
});

export type GoalContribution = z.infer<typeof goalContributionSchema>;

export const goalStatusMixItemSchema = z.object({
	id: z.string(),
	kind: z.enum(["Work", "Milestone"]),
	openSourceRecord: z.literal(true),
	status: z.string(),
	title: z.string(),
	workType: z.enum(STATUS_MIX_WORK_TYPES).optional(),
});

export type GoalStatusMixItem = z.infer<typeof goalStatusMixItemSchema>;

export const goalRelatedOpenItemSchema = z.object({
	contributes: z.literal(false),
	id: z.string(),
	kind: z.enum(["Risk", "Question"]),
	openSourceRecord: z.boolean(),
	title: z.string().optional(),
});

export type GoalRelatedOpenItem = z.infer<typeof goalRelatedOpenItemSchema>;

export const goalLiveSummarySchema = z.object({
	copy: z.object({
		contributesToGoal: z.literal(PROJECT_GOAL_COPY.contributesToGoal),
		openQuestion: z.literal(PROJECT_GOAL_COPY.openQuestion),
		openSourceRecord: z.literal(PROJECT_GOAL_COPY.openSourceRecord),
		risk: z.literal(PROJECT_GOAL_COPY.risk),
	}),
	relatedOpen: z.array(goalRelatedOpenItemSchema),
	statusMix: z.array(goalStatusMixItemSchema),
});

export type GoalLiveSummary = z.infer<typeof goalLiveSummarySchema>;

export const projectGoalDetailViewSchema = projectGoalViewSchema.extend({
	contributions: z.array(goalContributionSchema),
	liveSummary: goalLiveSummarySchema,
});

export type ProjectGoalDetailView = z.infer<typeof projectGoalDetailViewSchema>;

export function emptyGoalLiveSummary(): GoalLiveSummary {
	return {
		copy: {
			contributesToGoal: PROJECT_GOAL_COPY.contributesToGoal,
			openQuestion: PROJECT_GOAL_COPY.openQuestion,
			openSourceRecord: PROJECT_GOAL_COPY.openSourceRecord,
			risk: PROJECT_GOAL_COPY.risk,
		},
		relatedOpen: [],
		statusMix: [],
	};
}

export function isStatusMixWorkType(value: string): value is StatusMixWorkType {
	return (STATUS_MIX_WORK_TYPES as readonly string[]).includes(value);
}

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

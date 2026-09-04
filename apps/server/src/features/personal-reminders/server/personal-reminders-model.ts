import { z } from "zod";

export const PERSONAL_REMINDERS_COPY = {
	archivedProject: "This Project is archived.",
	cancel: "Cancel",
	cancelled: "Cancelled",
	couldNotEvaluate: "The source life could not be evaluated.",
	dismiss: "Dismiss",
	empty: "No reminder on this record.",
	fireAt: "When",
	inAnyCase: "In any case",
	missingSection: "This section is missing.",
	onlyIfStillOpen: "Only if still open",
	permanentlyDeleted: "Permanently deleted",
	planned: "Planned",
	remindMe: "Remind me",
	reviewLater: "Review Later",
	section: "Section",
	sectionNeedsDocument: "A section target belongs on a Document.",
	sectionNotFound: "This section is not in the Document.",
	sourceNoLongerOpen: "The source is no longer open.",
	sourceRequired: "A reminder needs a supported source record.",
	stillOpenNeedsDefinedLife:
		"Only if still open needs a source with open or resolved life.",
	timeRequired: "A reminder needs a time.",
	triggered: "Triggered",
	unsupportedSource: "This record type cannot carry a reminder.",
} as const;

export const PERSONAL_REMINDER_LIFE = {
	cancelled: PERSONAL_REMINDERS_COPY.cancelled,
	planned: PERSONAL_REMINDERS_COPY.planned,
	triggered: PERSONAL_REMINDERS_COPY.triggered,
} as const;

export const PERSONAL_REMINDER_LIVES = [
	PERSONAL_REMINDER_LIFE.planned,
	PERSONAL_REMINDER_LIFE.triggered,
	PERSONAL_REMINDER_LIFE.cancelled,
] as const;

export type PersonalReminderLife = (typeof PERSONAL_REMINDER_LIVES)[number];

export const PERSONAL_REMINDER_ACTION = {
	remindMe: PERSONAL_REMINDERS_COPY.remindMe,
	reviewLater: PERSONAL_REMINDERS_COPY.reviewLater,
} as const;

export const PERSONAL_REMINDER_ACTIONS = [
	PERSONAL_REMINDER_ACTION.remindMe,
	PERSONAL_REMINDER_ACTION.reviewLater,
] as const;

export type PersonalReminderAction = (typeof PERSONAL_REMINDER_ACTIONS)[number];

export const PERSONAL_REMINDER_CONDITION = {
	inAnyCase: PERSONAL_REMINDERS_COPY.inAnyCase,
	onlyIfStillOpen: PERSONAL_REMINDERS_COPY.onlyIfStillOpen,
} as const;

export const PERSONAL_REMINDER_CONDITIONS = [
	PERSONAL_REMINDER_CONDITION.inAnyCase,
	PERSONAL_REMINDER_CONDITION.onlyIfStillOpen,
] as const;

export type PersonalReminderCondition =
	(typeof PERSONAL_REMINDER_CONDITIONS)[number];

export const PERSONAL_REMINDER_SOURCE_TYPE = {
	decision: "Decision",
	design: "Design",
	document: "Document",
	milestone: "Milestone",
	productionIncident: "Production Incident",
	project: "Project",
	projectRelease: "Project Release",
	risk: "Risk",
	source: "Source",
	testGap: "Test Gap",
	work: "Work",
} as const;

export const PERSONAL_REMINDER_SOURCE_TYPES = [
	PERSONAL_REMINDER_SOURCE_TYPE.project,
	PERSONAL_REMINDER_SOURCE_TYPE.document,
	PERSONAL_REMINDER_SOURCE_TYPE.work,
	PERSONAL_REMINDER_SOURCE_TYPE.decision,
	PERSONAL_REMINDER_SOURCE_TYPE.risk,
	PERSONAL_REMINDER_SOURCE_TYPE.design,
	PERSONAL_REMINDER_SOURCE_TYPE.source,
	PERSONAL_REMINDER_SOURCE_TYPE.milestone,
	PERSONAL_REMINDER_SOURCE_TYPE.projectRelease,
	PERSONAL_REMINDER_SOURCE_TYPE.productionIncident,
	PERSONAL_REMINDER_SOURCE_TYPE.testGap,
] as const;

export type PersonalReminderSourceType =
	(typeof PERSONAL_REMINDER_SOURCE_TYPES)[number];

export const PERSONAL_REMINDER_STILL_OPEN_SOURCE_TYPES = [
	PERSONAL_REMINDER_SOURCE_TYPE.work,
	PERSONAL_REMINDER_SOURCE_TYPE.decision,
	PERSONAL_REMINDER_SOURCE_TYPE.milestone,
] as const;

export type PersonalReminderStillOpenSourceType =
	(typeof PERSONAL_REMINDER_STILL_OPEN_SOURCE_TYPES)[number];

export function sourceTypeHasStillOpenLife(
	sourceType: PersonalReminderSourceType
): sourceType is PersonalReminderStillOpenSourceType {
	return (
		PERSONAL_REMINDER_STILL_OPEN_SOURCE_TYPES as readonly string[]
	).includes(sourceType);
}

export const PERSONAL_REMINDER_SIGNAL_ID = {
	personalReminder: "personal-reminder",
	reviewLater: "review-later",
} as const;

export const PERSONAL_REMINDER_SIGNAL_IDS = [
	PERSONAL_REMINDER_SIGNAL_ID.personalReminder,
	PERSONAL_REMINDER_SIGNAL_ID.reviewLater,
] as const;

export type PersonalReminderSignalId =
	(typeof PERSONAL_REMINDER_SIGNAL_IDS)[number];

export function signalIdForAction(
	action: PersonalReminderAction
): PersonalReminderSignalId {
	return action === PERSONAL_REMINDER_ACTION.remindMe
		? PERSONAL_REMINDER_SIGNAL_ID.personalReminder
		: PERSONAL_REMINDER_SIGNAL_ID.reviewLater;
}

export const PERSONAL_REMINDER_HISTORY_KIND = {
	archiveStopped: "archive-stopped",
	dismissed: "dismissed",
	fired: "fired",
	rescheduled: "rescheduled",
	suppressed: "suppressed",
	unevaluable: "unevaluable",
} as const;

export const PERSONAL_REMINDERS_COUNTERPARTS = {
	dailyFocus: false,
	datelessQueue: false,
	dueDateSignal: false,
	saveForLaterQueue: false,
	standaloneReminder: false,
	targetDateWrite: false,
	yenidenGorunmeTarihiWrite: false,
} as const;

export const PERSONAL_REMINDERS_PLANNING_WRITES = {
	backlog: false,
	closureResult: false,
	dailyFocus: false,
	focusPeriod: false,
	horizon: false,
	kanban: false,
	priority: false,
	reappearDate: false,
	stage: false,
	status: false,
	targetDate: false,
} as const;

export function personalRemindersCatalog() {
	return {
		actions: PERSONAL_REMINDER_ACTIONS,
		conditions: PERSONAL_REMINDER_CONDITIONS,
		copy: PERSONAL_REMINDERS_COPY,
		counterparts: PERSONAL_REMINDERS_COUNTERPARTS,
		kind: "personal-reminders",
		lives: PERSONAL_REMINDER_LIVES,
		planningWrites: PERSONAL_REMINDERS_PLANNING_WRITES,
		signalIds: PERSONAL_REMINDER_SIGNAL_IDS,
		sourceTypes: PERSONAL_REMINDER_SOURCE_TYPES,
		stillOpenSourceTypes: PERSONAL_REMINDER_STILL_OPEN_SOURCE_TYPES,
	};
}

export const personalReminderOpenTargetSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("record") }),
	z.object({
		heading: z.string(),
		kind: z.literal("document-section"),
		sectionId: z.string().min(1),
	}),
	z.object({
		explanation: z.literal(PERSONAL_REMINDERS_COPY.missingSection),
		kind: z.literal("missing-section"),
		sectionId: z.string().min(1),
	}),
	z.object({
		kind: z.literal("broken-reference"),
		reason: z.literal(PERSONAL_REMINDERS_COPY.permanentlyDeleted),
	}),
]);

export const personalReminderViewSchema = z.object({
	accountId: z.string().min(1),
	createdByAction: z.enum(PERSONAL_REMINDER_ACTIONS),
	documentSectionId: z.string().min(1).nullable(),
	fireAt: z.string().datetime(),
	id: z.string().min(1),
	life: z.enum(PERSONAL_REMINDER_LIVES),
	openTarget: personalReminderOpenTargetSchema,
	sourceId: z.string().min(1),
	sourceType: z.enum(PERSONAL_REMINDER_SOURCE_TYPES),
	stillOpenCondition: z.enum(PERSONAL_REMINDER_CONDITIONS),
});

export const personalReminderConditionEvaluationSchema = z.object({
	condition: z.enum(PERSONAL_REMINDER_CONDITIONS),
	holds: z.boolean(),
	reason: z.string().nullable(),
	sourceLife: z.enum(["open", "resolved", "not-applicable", "unevaluable"]),
});

export type PersonalReminderConditionEvaluation = z.infer<
	typeof personalReminderConditionEvaluationSchema
>;

export type PersonalReminderView = z.infer<typeof personalReminderViewSchema>;

export const personalReminderHistoryEntrySchema = z.object({
	at: z.string().datetime(),
	kind: z.enum([
		PERSONAL_REMINDER_HISTORY_KIND.archiveStopped,
		PERSONAL_REMINDER_HISTORY_KIND.dismissed,
		PERSONAL_REMINDER_HISTORY_KIND.fired,
		PERSONAL_REMINDER_HISTORY_KIND.rescheduled,
		PERSONAL_REMINDER_HISTORY_KIND.suppressed,
		PERSONAL_REMINDER_HISTORY_KIND.unevaluable,
	]),
	reason: z.string().nullable(),
	signalId: z.enum(PERSONAL_REMINDER_SIGNAL_IDS).nullable(),
	sourceLife: z
		.enum(["open", "resolved", "not-applicable", "unevaluable"])
		.nullable(),
});

export type PersonalReminderHistoryEntry = z.infer<
	typeof personalReminderHistoryEntrySchema
>;

export const personalReminderSignalViewSchema = z.object({
	dismissed: z.boolean(),
	reason: z.string().nullable(),
	reminderId: z.string().min(1),
	signalId: z.enum(PERSONAL_REMINDER_SIGNAL_IDS),
	sourceId: z.string().min(1),
	sourceType: z.enum(PERSONAL_REMINDER_SOURCE_TYPES),
});

export type PersonalReminderSignalView = z.infer<
	typeof personalReminderSignalViewSchema
>;

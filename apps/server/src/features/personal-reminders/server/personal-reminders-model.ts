import { z } from "zod";

export const PERSONAL_REMINDERS_COPY = {
	cancel: "Cancel",
	cancelled: "Cancelled",
	empty: "No reminder on this record.",
	fireAt: "When",
	planned: "Planned",
	remindMe: "Remind me",
	reviewLater: "Review Later",
	sourceRequired: "A reminder needs a supported source record.",
	timeRequired: "A reminder needs a time.",
	unsupportedSource: "This record type cannot carry a reminder.",
} as const;

export const PERSONAL_REMINDER_LIFE = {
	cancelled: PERSONAL_REMINDERS_COPY.cancelled,
	planned: PERSONAL_REMINDERS_COPY.planned,
} as const;

export const PERSONAL_REMINDER_LIVES = [
	PERSONAL_REMINDER_LIFE.planned,
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
		copy: PERSONAL_REMINDERS_COPY,
		counterparts: PERSONAL_REMINDERS_COUNTERPARTS,
		kind: "personal-reminders",
		lives: PERSONAL_REMINDER_LIVES,
		planningWrites: PERSONAL_REMINDERS_PLANNING_WRITES,
		sourceTypes: PERSONAL_REMINDER_SOURCE_TYPES,
	};
}

export const personalReminderViewSchema = z.object({
	accountId: z.string().min(1),
	createdByAction: z.enum(PERSONAL_REMINDER_ACTIONS),
	fireAt: z.string().datetime(),
	id: z.string().min(1),
	life: z.enum(PERSONAL_REMINDER_LIVES),
	sourceId: z.string().min(1),
	sourceType: z.enum(PERSONAL_REMINDER_SOURCE_TYPES),
});

export type PersonalReminderView = z.infer<typeof personalReminderViewSchema>;

export const PERSONAL_REMINDERS_COPY = {
	cancel: "Cancel",
	cancelled: "Cancelled",
	empty: "No reminder on this record.",
	fireAt: "When",
	planned: "Planned",
	remindMe: "Remind me",
	reviewLater: "Review Later",
} as const;

export const PERSONAL_REMINDER_ACTIONS = [
	PERSONAL_REMINDERS_COPY.remindMe,
	PERSONAL_REMINDERS_COPY.reviewLater,
] as const;

export type PersonalReminderAction = (typeof PERSONAL_REMINDER_ACTIONS)[number];

export const PERSONAL_REMINDER_SOURCE_TYPE = {
	document: "Document",
	work: "Work",
} as const;

import { MUTATION_COPY } from "../../../lib/mutation";

export const PERSONAL_REMINDERS_COPY = {
	cancel: "Cancel",
	cancelled: "Cancelled",
	couldNotWrite: "This reminder could not be written.",
	empty: "No reminder on this record.",
	fireAt: "When",
	planned: "Planned",
	remindMe: "Remind me",
	reviewLater: "Review Later",
	sourceRequired: "A reminder needs a supported source record.",
	timeRequired: "A reminder needs a time.",
} as const;

export type PersonalReminderWriteOutcome =
	| { status: "committed" }
	| { status: "conflict" }
	| { reason: string; status: "invalid" }
	| { status: "not-found" };

export function presentPersonalReminderWriteError(
	outcome: PersonalReminderWriteOutcome
): string | null {
	if (outcome.status === "committed") {
		return null;
	}
	if (outcome.status === "invalid") {
		return outcome.reason;
	}
	if (outcome.status === "conflict") {
		return MUTATION_COPY.conflict;
	}
	return PERSONAL_REMINDERS_COPY.sourceRequired;
}

export const PERSONAL_REMINDER_ACTIONS = [
	PERSONAL_REMINDERS_COPY.remindMe,
	PERSONAL_REMINDERS_COPY.reviewLater,
] as const;

export type PersonalReminderAction = (typeof PERSONAL_REMINDER_ACTIONS)[number];

export const PERSONAL_REMINDER_SOURCE_TYPE = {
	document: "Document",
	work: "Work",
} as const;

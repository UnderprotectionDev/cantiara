import { MUTATION_COPY } from "../../../lib/mutation";

export const PERSONAL_REMINDERS_COPY = {
	cancel: "Cancel",
	cancelled: "Cancelled",
	couldNotWrite: "This reminder could not be written.",
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
	sourceRequired: "A reminder needs a supported source record.",
	timeRequired: "A reminder needs a time.",
	triggered: "Triggered",
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

export const PERSONAL_REMINDER_CONDITIONS = [
	PERSONAL_REMINDERS_COPY.inAnyCase,
	PERSONAL_REMINDERS_COPY.onlyIfStillOpen,
] as const;

export type PersonalReminderCondition =
	(typeof PERSONAL_REMINDER_CONDITIONS)[number];

export const PERSONAL_REMINDER_SOURCE_TYPE = {
	document: "Document",
	work: "Work",
} as const;

const HEADING_LINE =
	/^(#{1,6})[ \t]+(.+?)(?:[ \t]+\{#([A-Za-z0-9_-]+)\})?[ \t]*$/;

export function listDocumentHeadingSections(body: string): {
	heading: string;
	sectionId: string;
}[] {
	const sections: { heading: string; sectionId: string }[] = [];
	for (const line of body.split("\n")) {
		const match = HEADING_LINE.exec(line);
		const sectionId = match?.[3];
		if (!sectionId) {
			continue;
		}
		sections.push({
			heading: match?.[2]?.trim() ?? "",
			sectionId,
		});
	}
	return sections;
}

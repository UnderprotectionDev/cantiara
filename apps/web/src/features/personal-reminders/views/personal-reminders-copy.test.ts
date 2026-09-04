import { expect, test } from "vitest";

import { MUTATION_COPY } from "../../../lib/mutation";

import {
	listDocumentHeadingSections,
	PERSONAL_REMINDERS_COPY,
	presentPersonalReminderWriteError,
} from "./personal-reminders-copy";

const FORBIDDEN_SURFACE =
	/Save for Later|standalone reminder|due-date|Target date|Yeniden görünme/i;

test("English Personal Reminders copy uses Remind me, Planned, and Cancelled", () => {
	expect(PERSONAL_REMINDERS_COPY.remindMe).toBe("Remind me");
	expect(PERSONAL_REMINDERS_COPY.reviewLater).toBe("Review Later");
	expect(PERSONAL_REMINDERS_COPY.planned).toBe("Planned");
	expect(PERSONAL_REMINDERS_COPY.cancelled).toBe("Cancelled");
	expect(PERSONAL_REMINDERS_COPY.fireAt).toBe("When");
	expect(PERSONAL_REMINDERS_COPY.cancel).toBe("Cancel");
	expect(PERSONAL_REMINDERS_COPY.inAnyCase).toBe("In any case");
	expect(PERSONAL_REMINDERS_COPY.onlyIfStillOpen).toBe("Only if still open");
	expect(PERSONAL_REMINDERS_COPY.section).toBe("Section");
	expect(PERSONAL_REMINDERS_COPY.missingSection).toBe(
		"This section is missing."
	);
	expect(JSON.stringify(PERSONAL_REMINDERS_COPY)).not.toMatch(
		FORBIDDEN_SURFACE
	);
});

test("a missing source is not shown as Conflict", () => {
	expect(presentPersonalReminderWriteError({ status: "committed" })).toBeNull();
	expect(presentPersonalReminderWriteError({ status: "conflict" })).toBe(
		MUTATION_COPY.conflict
	);
	expect(
		presentPersonalReminderWriteError({
			reason: PERSONAL_REMINDERS_COPY.timeRequired,
			status: "invalid",
		})
	).toBe(PERSONAL_REMINDERS_COPY.timeRequired);
	expect(presentPersonalReminderWriteError({ status: "not-found" })).toBe(
		PERSONAL_REMINDERS_COPY.sourceRequired
	);
	expect(presentPersonalReminderWriteError({ status: "not-found" })).not.toBe(
		MUTATION_COPY.conflict
	);
});

test("Document heading sections follow the stable section id", () => {
	expect(
		listDocumentHeadingSections(
			"# Risks {#sec-risks}\n\nWatch.\n\n## Later {#sec-later}"
		)
	).toEqual([
		{ heading: "Risks", sectionId: "sec-risks" },
		{ heading: "Later", sectionId: "sec-later" },
	]);
});

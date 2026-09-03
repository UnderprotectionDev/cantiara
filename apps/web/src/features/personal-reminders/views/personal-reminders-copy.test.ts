import { expect, test } from "vitest";

import { PERSONAL_REMINDERS_COPY } from "./personal-reminders-copy";

const FORBIDDEN_SURFACE =
	/Save for Later|standalone reminder|due-date|Target date|Yeniden görünme/i;

test("English Personal Reminders copy uses Remind me, Planned, and Cancelled", () => {
	expect(PERSONAL_REMINDERS_COPY.remindMe).toBe("Remind me");
	expect(PERSONAL_REMINDERS_COPY.reviewLater).toBe("Review Later");
	expect(PERSONAL_REMINDERS_COPY.planned).toBe("Planned");
	expect(PERSONAL_REMINDERS_COPY.cancelled).toBe("Cancelled");
	expect(PERSONAL_REMINDERS_COPY.fireAt).toBe("When");
	expect(PERSONAL_REMINDERS_COPY.cancel).toBe("Cancel");
	expect(JSON.stringify(PERSONAL_REMINDERS_COPY)).not.toMatch(
		FORBIDDEN_SURFACE
	);
});

import type { AccountPreferencesInput } from "@cantiara/auth/account-preferences-model";
import { expect, test } from "vitest";

import { sessionLastActivityDisplay } from "./session-last-activity";

const INSTANT = "2026-03-29T12:00:00.000Z";

const istanbul: AccountPreferencesInput = {
	appearance: "dark",
	dateFormat: "locale",
	firstDayOfWeek: "Monday",
	locale: "en-GB",
	timeZone: "Europe/Istanbul",
};

test("Sessions last activity display follows the Hesap locale and time zone", () => {
	expect(sessionLastActivityDisplay(INSTANT, istanbul)).toBe(
		"29/03/2026, 15:00"
	);
	expect(
		sessionLastActivityDisplay(INSTANT, {
			...istanbul,
			locale: "en-US",
			timeZone: "America/New_York",
		})
	).toBe("03/29/2026, 08:00 AM");
});

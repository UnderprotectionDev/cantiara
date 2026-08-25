import { expect, test } from "vitest";

import { isLoggedOutGetSessionBody } from "./get-session-body";

test("native Better Auth logged-out get-session is JSON null", () => {
	expect(isLoggedOutGetSessionBody(null)).toBe(true);
});

test("a session object without user is logged out for the Better Auth client", () => {
	expect(isLoggedOutGetSessionBody({ session: null })).toBe(true);
	expect(isLoggedOutGetSessionBody({ session: null, user: null })).toBe(true);
	expect(isLoggedOutGetSessionBody({ user: null })).toBe(true);
});

test("a live product session is not logged out", () => {
	expect(
		isLoggedOutGetSessionBody({
			session: { id: "sess_1" },
			user: { id: "acc_1", name: "Founder" },
		})
	).toBe(false);
});

import { expect, test } from "vitest";

import { sessionUser } from "./session-user";

test("Better Auth signed-out get-session bodies do not expose a user to the header", () => {
	expect(sessionUser(null)).toBeNull();
	expect(sessionUser({ session: null })).toBeNull();
	expect(sessionUser({ session: null, user: null })).toBeNull();
});

test("a product session still in the cookie cache without a user is signed out in the header", () => {
	expect(sessionUser({ session: { id: "sess_1" } })).toBeNull();
});

test("the header reads the Account name from the Better Auth user", () => {
	expect(
		sessionUser({
			session: { id: "sess_1" },
			user: { email: "founder@example.com", name: "Founder" },
		})
	).toEqual({ email: "founder@example.com", name: "Founder" });
});

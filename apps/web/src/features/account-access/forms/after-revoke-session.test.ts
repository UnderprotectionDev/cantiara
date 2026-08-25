import { expect, test } from "bun:test";

import { afterRevokeSession } from "./after-revoke-session";

test("Revoke Session on the current product session requires sign-in again", () => {
	expect(afterRevokeSession(true)).toBe("/login");
});

test("Revoke Session on another device stays on Sessions", () => {
	expect(afterRevokeSession(false)).toBeNull();
});

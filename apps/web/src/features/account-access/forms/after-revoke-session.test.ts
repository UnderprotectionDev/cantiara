import { expect, test } from "vitest";

import { afterRevokeSession } from "./after-revoke-session";

test("Revoke Session on the current product session returns to Sessions after sign-in", () => {
	expect(afterRevokeSession(true)).toBe("/login?redirect=/sessions");
});

test("Revoke Session on another device stays on Sessions", () => {
	expect(afterRevokeSession(false)).toBeNull();
});

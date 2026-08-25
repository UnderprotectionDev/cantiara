import { expect, test } from "vitest";

import {
	isGitHubSignInWaiting,
	WAITING_FOR_GITHUB,
} from "./waiting-for-github";

test("new GitHub sign-in waits visibly when GitHub is unreachable", () => {
	expect(isGitHubSignInWaiting("waiting")).toBe(true);
	expect(WAITING_FOR_GITHUB).toBe("Waiting for GitHub");
});

test("new GitHub sign-in does not wait when GitHub is reachable", () => {
	expect(isGitHubSignInWaiting("up")).toBe(false);
	expect(isGitHubSignInWaiting(undefined)).toBe(false);
});

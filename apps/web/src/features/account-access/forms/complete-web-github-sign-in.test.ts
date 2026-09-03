import { expect, test } from "vitest";

import {
	completeWebGitHubSignIn,
	githubSignInCodeFromSearch,
} from "./complete-web-github-sign-in";

test("GitHub sign-in completion reads the one-time code from the login URL", () => {
	expect(githubSignInCodeFromSearch({ code: "abc" })).toBe("abc");
	expect(githubSignInCodeFromSearch({})).toBeNull();
	expect(githubSignInCodeFromSearch({ code: "" })).toBeNull();
});

test("an empty GitHub sign-in code does not call exchange", async () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = () => {
		throw new Error("exchange must not run");
	};
	try {
		await expect(completeWebGitHubSignIn("")).resolves.toEqual({
			ok: false,
			redirect: "/dashboard",
		});
	} finally {
		globalThis.fetch = originalFetch;
	}
});

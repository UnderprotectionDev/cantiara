import { expect, test } from "vitest";

import { postSignInPath } from "./post-sign-in-path";

test("GitHub sign-in opens Sessions when that is the intended path", () => {
	expect(postSignInPath("/sessions")).toBe("/sessions");
});

test("GitHub sign-in opens Dashboard when no Sessions return is asked", () => {
	expect(postSignInPath(undefined)).toBe("/dashboard");
	expect(postSignInPath("/dashboard")).toBe("/dashboard");
});

test("GitHub sign-in ignores an untrusted return path", () => {
	expect(postSignInPath("https://evil.example/phish")).toBe("/dashboard");
	expect(postSignInPath("//evil.example")).toBe("/dashboard");
	expect(postSignInPath("/login")).toBe("/dashboard");
	expect(postSignInPath("/sessions/../login")).toBe("/dashboard");
});

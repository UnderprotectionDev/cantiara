import { expect, test } from "vitest";

import {
	confirmGitHubIdentityStatus,
	githubWaitCopy,
	githubWaitPollMs,
} from "./github-wait";

test("login and Confirm GitHub Identity show the GitHub wait copy from the Account Access report", () => {
	expect(
		githubWaitCopy({ message: "Waiting for GitHub", status: "waiting" })
	).toBe("Waiting for GitHub");
});

test("GitHub wait copy stays hidden while GitHub is up or Confirm GitHub Identity is ready", () => {
	expect(githubWaitCopy({ status: "up" })).toBeUndefined();
	expect(githubWaitCopy({ status: "ready" })).toBeUndefined();
	expect(githubWaitCopy(undefined)).toBeUndefined();
});

test("GitHub wait polling runs only while the report is waiting", () => {
	expect(githubWaitPollMs("waiting")).toBe(15_000);
	expect(githubWaitPollMs("up")).toBe(false);
	expect(githubWaitPollMs("ready")).toBe(false);
	expect(githubWaitPollMs(undefined)).toBe(false);
});

test("Confirm GitHub Identity shows a loading status before the Account Access report arrives", () => {
	expect(confirmGitHubIdentityStatus({ isPending: true })).toEqual({
		text: "Loading…",
		waiting: false,
	});
});

test("Confirm GitHub Identity waits with the GitHub wait copy", () => {
	expect(
		confirmGitHubIdentityStatus({
			confirmation: { message: "Waiting for GitHub", status: "waiting" },
		})
	).toEqual({ text: "Waiting for GitHub", waiting: true });
});

test("Confirm GitHub Identity is visible when GitHub is ready and is not offered as a password or MFA prompt", () => {
	expect(
		confirmGitHubIdentityStatus({ confirmation: { status: "ready" } })
	).toEqual({
		text: "This confirms the GitHub identity bound to this Account. It is not a password or MFA prompt.",
		waiting: false,
	});
});

test("Confirm GitHub Identity stays fail-closed when the report cannot be loaded", () => {
	expect(confirmGitHubIdentityStatus({ isError: true })).toEqual({
		text: "Confirm GitHub Identity is unavailable.",
		waiting: false,
	});
});

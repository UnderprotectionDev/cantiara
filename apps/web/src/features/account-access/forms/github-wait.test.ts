import { expect, test } from "vitest";

import { githubWaitCopy, githubWaitPollMs } from "./github-wait";

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

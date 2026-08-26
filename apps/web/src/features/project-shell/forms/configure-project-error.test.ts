import { expect, test } from "vitest";

import { configureProjectError } from "./configure-project-error";

test("a committed or replayed configure does not show an error", () => {
	expect(configureProjectError({ status: "committed" })).toBeNull();
	expect(configureProjectError({ status: "replayed" })).toBeNull();
});

test("a conflicting configure shows Conflict", () => {
	expect(configureProjectError({ status: "conflict" })).toBe("Conflict");
});

test("a stale configure shows Current value", () => {
	expect(
		configureProjectError({
			currentValueLabel: "Current value",
			status: "stale",
		})
	).toBe("Current value");
});

test("an empty stage name shows Stage name is required", () => {
	expect(
		configureProjectError({
			reason: "stage-name-invalid",
			status: "rejected",
		})
	).toBe("Stage name is required.");
});

test("an empty Work status label shows Work status label is required", () => {
	expect(
		configureProjectError({
			reason: "work-status-label-invalid",
			status: "rejected",
		})
	).toBe("Work status label is required.");
});

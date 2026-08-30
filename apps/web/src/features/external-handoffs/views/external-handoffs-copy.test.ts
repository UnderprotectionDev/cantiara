import { expect, test } from "vitest";

import {
	EXTERNAL_HANDOFFS_COPY,
	presentHandoffCard,
	presentHandoffWriteError,
} from "./external-handoffs-copy";

const FORBIDDEN_PRODUCT =
	/coding session|agent task|independent Handoff main record|commit arrived/i;

test("English UI uses External Execution Handoff and Start Handoff", () => {
	expect(EXTERNAL_HANDOFFS_COPY).toMatchObject({
		confirm: "Confirm",
		constraints: "Constraints",
		couldNotComplete: "This action could not be completed.",
		executor: "Executor",
		executorSummary: "Executor summary",
		expectedOutput: "Expected output",
		externalExecutionHandoff: "External Execution Handoff",
		followUpWork: "Follow-up Work",
		github: "GitHub",
		goingPackage: "Going package",
		open: "Open",
		purpose: "Purpose",
		reconcile: "Reconcile",
		reconciled: "Reconciled",
		recordReturn: "Record return",
		reject: "Reject",
		removeSelectedVersion: "Remove selected version",
		resultReturned: "Result returned",
		selectedVersions: "Selected versions",
		sourceOfTruth: "Source of truth is in the app",
		startHandoff: "Start Handoff",
	});
	expect(JSON.stringify(EXTERNAL_HANDOFFS_COPY)).not.toMatch(FORBIDDEN_PRODUCT);
});

test("a rejected Start Handoff is not shown as Conflict", () => {
	expect(presentHandoffWriteError({ status: "committed" })).toBeNull();
	expect(presentHandoffWriteError({ status: "replayed" })).toBeNull();
	expect(presentHandoffWriteError({ status: "conflict" })).toBe("Conflict");
	expect(
		presentHandoffWriteError({
			reason: "invalid-handoff",
			status: "rejected",
		})
	).toBe(EXTERNAL_HANDOFFS_COPY.couldNotComplete);
	expect(presentHandoffWriteError({ status: "refused" })).toBe(
		EXTERNAL_HANDOFFS_COPY.couldNotComplete
	);
});

test("Open handoff card leads with purpose, not a raw identity", () => {
	expect(
		presentHandoffCard({
			goingPackage: { producedAt: "2026-08-30T12:00:00.000Z" },
			purpose: "Code checkout outside the app.",
			status: EXTERNAL_HANDOFFS_COPY.open,
		})
	).toEqual({
		producedAt: "2026-08-30T12:00:00.000Z",
		status: EXTERNAL_HANDOFFS_COPY.open,
		title: "Code checkout outside the app.",
	});
	expect(
		presentHandoffCard({
			goingPackage: { producedAt: "2026-08-30T12:00:00.000Z" },
			purpose: "   ",
			status: EXTERNAL_HANDOFFS_COPY.open,
		}).title
	).toBe(EXTERNAL_HANDOFFS_COPY.externalExecutionHandoff);
});

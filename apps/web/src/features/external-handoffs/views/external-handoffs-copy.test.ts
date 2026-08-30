import { expect, test } from "vitest";

import {
	EXTERNAL_HANDOFFS_COPY,
	presentHandoffCard,
	presentHandoffHistoryKind,
} from "./external-handoffs-copy";

const FORBIDDEN_PRODUCT =
	/coding session|agent task|independent Handoff main record|commit arrived/i;

test("English UI uses External Execution Handoff and Start Handoff", () => {
	expect(EXTERNAL_HANDOFFS_COPY).toMatchObject({
		constraints: "Constraints",
		executor: "Executor",
		expectedOutput: "Expected output",
		externalExecutionHandoff: "External Execution Handoff",
		github: "GitHub",
		goingPackage: "Going package",
		newPackageVersion: "New package version",
		open: "Open",
		packageVersion: "Package version",
		purpose: "Purpose",
		removeSelectedVersion: "Remove selected version",
		selectedVersions: "Selected versions",
		sourceOfTruth: "Source of truth is in the app",
		startHandoff: "Start Handoff",
	});
	expect(JSON.stringify(EXTERNAL_HANDOFFS_COPY)).not.toMatch(FORBIDDEN_PRODUCT);
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

test("Work change history uses Start Handoff and Going package labels", () => {
	expect(presentHandoffHistoryKind("started")).toBe(
		EXTERNAL_HANDOFFS_COPY.startHandoff
	);
	expect(presentHandoffHistoryKind("package-exported")).toBe(
		EXTERNAL_HANDOFFS_COPY.goingPackage
	);
});

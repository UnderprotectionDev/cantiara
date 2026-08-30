import { expect, test } from "vitest";

import { EXTERNAL_HANDOFFS_COPY } from "./external-handoffs-copy";

const FORBIDDEN_PRODUCT =
	/coding session|agent task|independent Handoff main record|commit arrived/i;

test("English UI uses External Execution Handoff and Start Handoff", () => {
	expect(EXTERNAL_HANDOFFS_COPY).toMatchObject({
		constraints: "Constraints",
		executor: "Executor",
		expectedOutput: "Expected output",
		externalExecutionHandoff: "External Execution Handoff",
		github: "GitHub",
		open: "Open",
		purpose: "Purpose",
		selectedVersions: "Selected versions",
		sourceOfTruth: "Source of truth is in the app",
		startHandoff: "Start Handoff",
	});
	expect(JSON.stringify(EXTERNAL_HANDOFFS_COPY)).not.toMatch(FORBIDDEN_PRODUCT);
});

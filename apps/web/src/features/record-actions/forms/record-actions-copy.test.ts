import { expect, test } from "vitest";

import {
	RECORD_ACTION_COPY,
	RECORD_ACTION_STEP_KINDS,
	START_WORK_STEPS,
} from "./record-actions-copy";

const FORBIDDEN_SURFACE =
	/javascript|free script|outbound HTTP|webhook marketplace|macro marketplace|createRecord|githubMutation/i;

test("English Record Action labels match the closed catalog", () => {
	expect(RECORD_ACTION_COPY.recordAction).toBe("Record Action");
	expect(RECORD_ACTION_COPY.startWork).toBe("Start Work");
	expect(RECORD_ACTION_COPY.useStartWork).toBe("Use Start Work");
	expect(RECORD_ACTION_COPY.addRecordAction).toBe("Add Record Action");
	expect(RECORD_ACTION_STEP_KINDS).toEqual([
		"setWorkStatus",
		"dailyFocusMembership",
		"setExistingField",
	]);
	expect(START_WORK_STEPS).toEqual([
		{ kind: "setWorkStatus", status: "In Progress" },
		{ kind: "dailyFocusMembership", operation: "add" },
	]);
	expect(JSON.stringify(RECORD_ACTION_STEP_KINDS)).not.toMatch(
		FORBIDDEN_SURFACE
	);
});

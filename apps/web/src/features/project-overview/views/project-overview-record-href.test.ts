import { expect, test } from "vitest";

import { projectOverviewRecordHref } from "./project-overview-record-href";

test("Open source record stays on Overview or the matching Project area", () => {
	expect(projectOverviewRecordHref("Work", "work_1")).toBe("?work=work_1#work");
	expect(projectOverviewRecordHref("Decisions", "decision_1")).toBe(
		"?decision=decision_1#decisions"
	);
	expect(projectOverviewRecordHref("Documents", "doc_1")).toBe("#documents");
	expect(projectOverviewRecordHref("Purpose", "proj_1")).toBe("#overview");
	expect(projectOverviewRecordHref("Lifecycle", "proj_1")).toBe("#overview");
	expect(projectOverviewRecordHref("Goals", "goal_1")).toBe(
		"?goal=goal_1#overview"
	);
	expect(projectOverviewRecordHref("Risks", "risk_1")).toBe(
		"?risk=risk_1#risks"
	);
});

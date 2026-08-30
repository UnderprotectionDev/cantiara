import { expect, test } from "vitest";

import { workspaceOverviewRecordHref } from "./workspace-overview-record-href";

test("Open source record jumps to the Project or Work surface", () => {
	expect(
		workspaceOverviewRecordHref({
			heading: "Active Projects",
			recordId: "proj_1",
		})
	).toBe("/projects/proj_1#overview");
	expect(
		workspaceOverviewRecordHref({
			heading: "Upcoming",
			recordId: "proj_1",
		})
	).toBe("/projects/proj_1#overview");
	expect(
		workspaceOverviewRecordHref({
			heading: "Recent Work",
			projectId: "proj_1",
			recordId: "work_1",
		})
	).toBe("/projects/proj_1?work=work_1#work");
	expect(
		workspaceOverviewRecordHref({
			heading: "Recent Work",
			recordId: "work_1",
		})
	).toBeNull();
	expect(
		workspaceOverviewRecordHref({
			heading: "Attention Required",
			recordId: "attn_1",
		})
	).toBeNull();
});

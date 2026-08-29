import { expect, test } from "vitest";

import { cellForColumn } from "./saved-cross-project-lists-model";

test("Last reported health cell keeps the dated label and is not a dateless badge", () => {
	expect(
		cellForColumn(
			{
				areas: ["Work"],
				id: "project-atlas",
				lastReportedHealth: {
					date: "2026-08-20",
					label: "Last reported health",
					mark: "On Track",
				},
				lifecycle: "Active",
				name: "Atlas",
				stage: "Build",
				targetDate: "2026-09-01",
			},
			"lastReportedHealth"
		)
	).toBe("Last reported health · On Track · 2026-08-20");
	expect(
		cellForColumn(
			{
				areas: ["Work"],
				id: "project-alpha",
				lastReportedHealth: null,
				lifecycle: "Active",
				name: "Alpha",
				stage: "Build",
				targetDate: null,
			},
			"lastReportedHealth"
		)
	).toBe("");
});

import { expect, test } from "vitest";

import { PRIORITY_COPY, PRIORITY_RANKS } from "./priority-copy";

const SCORE_WSJF_PATTERN = /wsjf|auto-?sort|auto-?fill|single score|weighting/i;

test("English priority catalog is the closed five ranks", () => {
	expect(PRIORITY_COPY.priorityMetrics).toBe("Priority metrics");
	expect(PRIORITY_COPY.priorityMap).toBe("Priority Map");
	expect(PRIORITY_COPY.evidenceStrength).toBe("Evidence strength");
	expect(PRIORITY_COPY.unevaluated).toBe("Unevaluated");
	expect(PRIORITY_COPY.addPriorityMetric).toBe("Add priority metric");
	expect(PRIORITY_COPY.enable).toBe("Enable");
	expect(PRIORITY_RANKS).toEqual([
		"Very low",
		"Low",
		"Medium",
		"High",
		"Very high",
	]);
	expect(JSON.stringify(PRIORITY_COPY)).not.toMatch(SCORE_WSJF_PATTERN);
	expect(JSON.stringify(PRIORITY_RANKS)).not.toMatch(SCORE_WSJF_PATTERN);
});

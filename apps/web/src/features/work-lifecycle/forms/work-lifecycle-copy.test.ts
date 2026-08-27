import { expect, test } from "vitest";

import {
	involvesFeature,
	WORK_LIFECYCLE_COPY,
	WORK_TYPES,
} from "./work-lifecycle-copy";

const HIERARCHY_PATTERN = /epic|subtask/i;

test("English chrome uses Work types and impact preview", () => {
	expect(WORK_LIFECYCLE_COPY.work).toBe("Work");
	expect(WORK_LIFECYCLE_COPY.createWork).toBe("Create Work");
	expect(WORK_LIFECYCLE_COPY.title).toBe("Title");
	expect(WORK_LIFECYCLE_COPY.type).toBe("Type");
	expect(WORK_LIFECYCLE_COPY.key).toBe("Key");
	expect(WORK_LIFECYCLE_COPY.notStarted).toBe("Not Started");
	expect(WORK_LIFECYCLE_COPY.changeType).toBe("Change type");
	expect(WORK_LIFECYCLE_COPY.impactPreview).toBe("Impact preview");
	expect(WORK_LIFECYCLE_COPY.includedWork).toBe("Included Work");
	expect(WORK_LIFECYCLE_COPY.primarySpec).toBe("Primary spec");
	expect(WORK_LIFECYCLE_COPY.featureHealth).toBe("Feature health");
	expect(WORK_LIFECYCLE_COPY.confirmTypeChange).toBe("Confirm type change");
	expect(WORK_TYPES).toEqual([
		"Feature",
		"Bug",
		"Task",
		"Research",
		"Improvement",
	]);
	expect(JSON.stringify(WORK_LIFECYCLE_COPY)).not.toMatch(HIERARCHY_PATTERN);
	expect(involvesFeature("Task", "Bug")).toBe(false);
	expect(involvesFeature("Task", "Feature")).toBe(true);
	expect(involvesFeature("Feature", "Bug")).toBe(true);
});

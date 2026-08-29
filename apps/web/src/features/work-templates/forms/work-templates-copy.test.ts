import { expect, test } from "vitest";

import { WORK_TEMPLATE_COPY, WORK_TEMPLATE_TYPES } from "./work-templates-copy";

const OTHER_TEMPLATE_SURFACES =
	/personal review|starter configuration|bug capture|feedback capture|research fragment|\{\{field\}\}|marketplace|licensed pack/i;

test("English Work Template copy is not a Document, Starter, or capture surface", () => {
	expect(WORK_TEMPLATE_COPY.workTemplate).toBe("Work Template");
	expect(WORK_TEMPLATE_COPY.plannedStart).toBe("Planned start");
	expect(WORK_TEMPLATE_COPY.targetDate).toBe("Target date");
	expect(WORK_TEMPLATE_COPY.checklist).toBe("Checklist");
	expect(WORK_TEMPLATE_TYPES).toEqual([
		"Feature",
		"Bug",
		"Task",
		"Research",
		"Improvement",
	]);
	expect(JSON.stringify(WORK_TEMPLATE_COPY)).not.toMatch(
		OTHER_TEMPLATE_SURFACES
	);
	expect(WORK_TEMPLATE_COPY).not.toHaveProperty("createFromTemplate");
	expect(WORK_TEMPLATE_COPY.duplicateWork).toBe("Duplicate Work");
	expect(WORK_TEMPLATE_COPY.fieldsToCopy).toBe("Fields to copy");
});

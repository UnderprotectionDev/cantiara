import { expect, test } from "vitest";

import { FOCUS_PERIOD_COPY } from "./focus-period-copy";

const FORBIDDEN_SURFACE =
	/sprint|velocity|cadence|Milestone|Project Release|critical path|mermaid/i;

test("English Focus Period copy is Focus Period", () => {
	expect(FOCUS_PERIOD_COPY.focusPeriod).toBe("Focus Period");
	expect(FOCUS_PERIOD_COPY.planned).toBe("Planned");
	expect(FOCUS_PERIOD_COPY.active).toBe("Active");
	expect(FOCUS_PERIOD_COPY.closed).toBe("Closed");
	expect(FOCUS_PERIOD_COPY.canceled).toBe("Canceled");
	expect(FOCUS_PERIOD_COPY.purpose).toBe("Purpose");
	expect(FOCUS_PERIOD_COPY.purposeRequired).toBe("Purpose is required.");
	expect(FOCUS_PERIOD_COPY.startDate).toBe("Start date");
	expect(FOCUS_PERIOD_COPY.endDate).toBe("End date");
	expect(FOCUS_PERIOD_COPY.stillOpenWork).toBe("Still-open Work");
	expect(FOCUS_PERIOD_COPY.create).toBe("Create Focus Period");
	expect(FOCUS_PERIOD_COPY.dependencies).toBe("Dependencies");
	expect(FOCUS_PERIOD_COPY.openSourceRecord).toBe("Open source record");
	expect(FOCUS_PERIOD_COPY.blocks).toBe("Blocks");
	expect(FOCUS_PERIOD_COPY.blockedBy).toBe("Blocked by");
	expect(FOCUS_PERIOD_COPY.cycle).toBe("These records wait on each other.");
	expect(FOCUS_PERIOD_COPY.resolved).toBe("Resolved");
	expect(FOCUS_PERIOD_COPY.windowMustBeOneToEightWeeks).toBe(
		"Focus Period must be 1–8 weeks."
	);
	expect(JSON.stringify(FOCUS_PERIOD_COPY)).not.toMatch(FORBIDDEN_SURFACE);
});

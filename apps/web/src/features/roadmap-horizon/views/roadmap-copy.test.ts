import { expect, test } from "vitest";

import {
	MILESTONE_STATUSES,
	ROADMAP_COPY,
	ROADMAP_HORIZONS,
} from "./roadmap-copy";

const FORBIDDEN_PATTERN =
	/Show on Roadmap|Initiative|Parked|Theme record|Kanban column|sprint/i;

test("English Roadmap copy uses Roadmap, Now, Next, Later", () => {
	expect(ROADMAP_COPY.roadmap).toBe("Roadmap");
	expect(ROADMAP_COPY.now).toBe("Now");
	expect(ROADMAP_COPY.next).toBe("Next");
	expect(ROADMAP_COPY.later).toBe("Later");
	expect(ROADMAP_COPY.productDirection).toBe("Product direction");
	expect(ROADMAP_COPY.allWorkTypes).toBe("All Work types");
	expect(ROADMAP_COPY.unplaced).toBe("No horizon");
	expect(ROADMAP_COPY.openSourceRecord).toBe("Open source record");
	expect(ROADMAP_COPY.unplannedCandidates).toBe("Unplanned candidates");
	expect(ROADMAP_COPY.presentationMode).toBe("Presentation Mode");
	expect(ROADMAP_COPY.placeOnPlan).toBe("Place on plan");
	expect(ROADMAP_HORIZONS).toEqual(["Now", "Next", "Later"]);
	expect(ROADMAP_COPY.milestone).toBe("Milestone");
	expect(ROADMAP_COPY.planned).toBe("Planned");
	expect(ROADMAP_COPY.reached).toBe("Reached");
	expect(ROADMAP_COPY.abandoned).toBe("Abandoned");
	expect(ROADMAP_COPY.contributesToMilestone).toBe("Contributes to Milestone");
	expect(ROADMAP_COPY.createMilestone).toBe("Create Milestone");
	expect(ROADMAP_COPY.reach).toBe("Reach");
	expect(ROADMAP_COPY.abandon).toBe("Abandon");
	expect(MILESTONE_STATUSES).toEqual(["Planned", "Reached", "Abandoned"]);
	expect(JSON.stringify(ROADMAP_COPY)).not.toMatch(FORBIDDEN_PATTERN);
});
